<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Method, Question, QuestStage } from '../data/methods'

type AnswerValue = string | string[] | Record<string, string>
type GroupScore = { correct: number; total: number }
type QuestAnswer = {
  questionId: string
  type: Question['type']
  skill: Question['skill']
  selected: AnswerValue
  correct: AnswerValue
  isCorrect: boolean
  hintsUsed?: number
  retries?: number
}
type QuestStep = { id: string; stage: QuestStage; question?: Question; kind: 'question' | 'content' | 'remediation' }

const props = defineProps<{ method: Method; profileId?: string }>()
const emit = defineEmits<{
  back: []
  finish: [result: {
    methodId: string
    completedAt: string
    elapsedSeconds: number
    answers: QuestAnswer[]
    correctCount: number
    total: number
    score: number
    bySkill: Record<string, GroupScore>
    byType: Record<string, GroupScore>
    assessedQuestionIds: string[]
    questMode: Method['quest']['mode']
  }]
}>()

const steps = ref<QuestStep[]>([])
const currentIndex = ref(0)
const highestUnlocked = ref(0)
const draftAnswers = ref<Record<string, AnswerValue>>({})
const submittedAnswers = ref<Record<string, QuestAnswer>>({})
const hintCounts = ref<Record<string, number>>({})
const retryCounts = ref<Record<string, number>>({})
const validationMessage = ref('')
const coachMessage = ref('')
const elapsedSeconds = ref(0)
let startedAt = Date.now()
let timer: ReturnType<typeof setInterval> | undefined
let ready = false

const step = computed(() => steps.value[currentIndex.value])
const question = computed(() => step.value?.question)
const response = computed(() => question.value ? submittedAnswers.value[question.value.id] : undefined)
const questionCount = computed(() => steps.value.filter(item => item.question).length)
const answeredCount = computed(() => steps.value.filter(item => item.question && submittedAnswers.value[item.question.id]).length)
const targetCount = computed(() => props.method.quest.mode === 'adaptive' ? Math.min(6, props.method.quiz.length) : questionCount.value)
const completionPercent = computed(() => targetCount.value ? Math.round(answeredCount.value / targetCount.value * 100) : 0)
const stagePosition = computed(() => props.method.quest.stages.findIndex(item => item.id === step.value?.stage.id) + 1)
const currentHints = computed(() => question.value?.hints?.slice(0, hintCounts.value[question.value.id] ?? 0) ?? [])

function storageKey() {
  return `edulab.quest-draft.v1.${props.profileId || 'local'}.${props.method.id}`
}

function makeStep(stage: QuestStage, question?: Question): QuestStep {
  return { id: question?.id ?? stage.id, stage, question, kind: question ? 'question' : 'content' }
}

function stageSteps(stage: QuestStage): QuestStep[] {
  if (!stage.questionIds.length) return [makeStep(stage)]
  return stage.questionIds.flatMap(id => {
    const found = props.method.quiz.find(item => item.id === id)
    return found ? [makeStep(stage, found)] : []
  })
}

function initialSteps(): QuestStep[] {
  const quest = props.method.quest
  if (quest.mode === 'mastery') return stageSteps(quest.stages[0]!)
  if (quest.mode === 'adaptive') {
    const first = props.method.quiz.find(item => item.difficulty === 'medium') ?? props.method.quiz[0]
    return first ? [makeStep(quest.stages[0]!, first)] : []
  }
  return quest.stages.flatMap(stageSteps)
}

function serialize() {
  if (!ready) return
  try {
    localStorage.setItem(storageKey(), JSON.stringify({
      stepIds: steps.value.map(item => item.id),
      currentIndex: currentIndex.value,
      highestUnlocked: highestUnlocked.value,
      draftAnswers: draftAnswers.value,
      submittedAnswers: submittedAnswers.value,
      hintCounts: hintCounts.value,
      retryCounts: retryCounts.value,
      elapsedSeconds: elapsedSeconds.value,
    }))
  } catch { /* Local storage may be disabled. */ }
}

function restore() {
  const defaults = initialSteps()
  steps.value = defaults
  currentIndex.value = 0
  highestUnlocked.value = 0
  draftAnswers.value = {}
  submittedAnswers.value = {}
  hintCounts.value = {}
  retryCounts.value = {}
  validationMessage.value = ''
  coachMessage.value = ''
  elapsedSeconds.value = 0
  try {
    const raw = localStorage.getItem(storageKey())
    if (raw) {
      const saved = JSON.parse(raw)
      const candidates = Array.isArray(saved.stepIds) ? saved.stepIds : []
      const restored = candidates.map((id: string) => {
        const stage = props.method.quest.stages.find(item => item.id === id)
        if (stage && !stage.questionIds.length) return makeStep(stage)
        if (id === '__remediation' && props.method.quest.remediation) {
          return { id, stage: { id, title: props.method.quest.remediation.title, objective: 'Повторіть складні моменти', content: props.method.quest.remediation.content, questionIds: [] }, kind: 'remediation' as const }
        }
        const q = props.method.quiz.find(item => item.id === id)
        const owner = props.method.quest.stages.find(item => item.questionIds.includes(id))
        return q && owner ? makeStep(owner, q) : undefined
      }).filter((item: QuestStep | undefined): item is QuestStep => Boolean(item))
      if (restored.length === candidates.length && restored.length && defaults.every((item, index) => item.id === restored[index]?.id)) {
        steps.value = restored
        highestUnlocked.value = Math.min(Math.max(Number(saved.highestUnlocked) || 0, 0), steps.value.length - 1)
        currentIndex.value = Math.min(Math.max(Number(saved.currentIndex) || 0, 0), highestUnlocked.value)
        draftAnswers.value = saved.draftAnswers && typeof saved.draftAnswers === 'object' ? saved.draftAnswers : {}
        submittedAnswers.value = saved.submittedAnswers && typeof saved.submittedAnswers === 'object' ? saved.submittedAnswers : {}
        hintCounts.value = saved.hintCounts && typeof saved.hintCounts === 'object' ? saved.hintCounts : {}
        retryCounts.value = saved.retryCounts && typeof saved.retryCounts === 'object' ? saved.retryCounts : {}
        elapsedSeconds.value = Math.max(0, Number(saved.elapsedSeconds) || 0)
      }
    }
  } catch { /* Start a fresh quest if a draft cannot be parsed. */ }
  startedAt = Date.now() - elapsedSeconds.value * 1000
  ready = true
}

watch(() => [props.method.id, props.profileId], () => { ready = false; restore() }, { immediate: true })
watch([steps, currentIndex, highestUnlocked, draftAnswers, submittedAnswers, hintCounts, retryCounts], serialize, { deep: true })
onMounted(() => {
  timer = setInterval(() => { elapsedSeconds.value = Math.floor((Date.now() - startedAt) / 1000) }, 1000)
})
onUnmounted(() => { if (timer) clearInterval(timer); serialize() })

function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function setDraft(id: string, value: AnswerValue) {
  draftAnswers.value = { ...draftAnswers.value, [id]: value }
  validationMessage.value = ''
  coachMessage.value = ''
}

function selectedSingle(q: Question) { return typeof draftAnswers.value[q.id] === 'string' ? draftAnswers.value[q.id] as string : '' }
function selectedMultiple(q: Question) { return Array.isArray(draftAnswers.value[q.id]) ? draftAnswers.value[q.id] as string[] : [] }
function selectSingle(q: Question, id: string) { if (!submittedAnswers.value[q.id]) setDraft(q.id, id) }
function toggleMultiple(q: Question, id: string) {
  if (submittedAnswers.value[q.id]) return
  const current = selectedMultiple(q)
  setDraft(q.id, current.includes(id) ? current.filter(item => item !== id) : [...current, id])
}
function initialOrder(q: Question) {
  if (q.type !== 'order') return []
  const ids = q.items.map(item => item.id)
  return ids.join('|') === q.correctOrder.join('|') && ids.length > 1 ? [...ids.slice(1), ids[0]!] : ids
}
function selectedOrder(q: Question) { return Array.isArray(draftAnswers.value[q.id]) ? draftAnswers.value[q.id] as string[] : initialOrder(q) }
function orderLabel(q: Question, id: string) { return q.type === 'order' ? q.items.find(item => item.id === id)?.label ?? id : id }
function moveOrder(q: Question, index: number, direction: -1 | 1) {
  if (submittedAnswers.value[q.id]) return
  const next = [...selectedOrder(q)]
  const destination = index + direction
  if (destination < 0 || destination >= next.length) return
  ;[next[index], next[destination]] = [next[destination]!, next[index]!]
  setDraft(q.id, next)
}
function selectedMatch(q: Question): Record<string, string> {
  const value = draftAnswers.value[q.id]
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}
function setMatch(q: Question, leftId: string, event: Event) {
  if (!submittedAnswers.value[q.id]) setDraft(q.id, { ...selectedMatch(q), [leftId]: (event.target as HTMLSelectElement).value })
}
function correctFor(q: Question): AnswerValue {
  if (q.type === 'order') return [...q.correctOrder]
  if (q.type === 'match') return Object.fromEntries(q.pairs.map(pair => [pair.id, pair.id]))
  if (q.type === 'multiple') return [...q.correct]
  return q.correct
}
function isCorrect(q: Question, selected: AnswerValue) {
  const expected = correctFor(q)
  if (q.type === 'single') return typeof selected === 'string' && selected === expected
  if (q.type === 'multiple' && Array.isArray(selected) && Array.isArray(expected)) return selected.length === expected.length && [...selected].sort().every((id, index) => id === [...expected].sort()[index])
  if (q.type === 'order' && Array.isArray(selected) && Array.isArray(expected)) return selected.length === expected.length && selected.every((id, index) => id === expected[index])
  if (q.type === 'match' && typeof selected === 'object' && !Array.isArray(selected)) return q.pairs.every(pair => selected[pair.id] === pair.id)
  return false
}
function revealHint() {
  const q = question.value
  if (!q?.hints?.length || response.value) return
  hintCounts.value = { ...hintCounts.value, [q.id]: Math.min((hintCounts.value[q.id] ?? 0) + 1, q.hints.length) }
}
function submitAnswer() {
  const q = question.value
  if (!q || response.value) return
  let selected: AnswerValue
  if (q.type === 'single') {
    selected = selectedSingle(q)
    if (!selected) { validationMessage.value = 'Оберіть одну відповідь.'; return }
  } else if (q.type === 'multiple') {
    selected = [...selectedMultiple(q)]
    if (!selected.length) { validationMessage.value = 'Оберіть принаймні одну відповідь.'; return }
  } else if (q.type === 'order') {
    selected = [...selectedOrder(q)]
  } else {
    selected = { ...selectedMatch(q) }
    const chosen = q.pairs.map(pair => (selected as Record<string, string>)[pair.id]).filter(Boolean)
    if (chosen.length !== q.pairs.length || new Set(chosen).size !== chosen.length) {
      validationMessage.value = 'Доберіть різну відповідність для кожного рядка.'
      return
    }
  }
  const correct = isCorrect(q, selected)
  if (props.method.quest.mode === 'zpd' && !correct && (retryCounts.value[q.id] ?? 0) < 1) {
    retryCounts.value = { ...retryCounts.value, [q.id]: 1 }
    hintCounts.value = { ...hintCounts.value, [q.id]: Math.min(Math.max(hintCounts.value[q.id] ?? 0, 1), q.hints?.length ?? 0) }
    coachMessage.value = 'Спробуйте ще раз. Скористайтеся підказкою та перевірте ознаки повідомлення.'
    draftAnswers.value = { ...draftAnswers.value, [q.id]: q.type === 'single' ? '' : q.type === 'match' ? {} : [] }
    return
  }
  submittedAnswers.value = { ...submittedAnswers.value, [q.id]: {
    questionId: q.id, type: q.type, skill: q.skill, selected, correct: correctFor(q), isCorrect: correct,
    hintsUsed: hintCounts.value[q.id] ?? 0, retries: retryCounts.value[q.id] ?? 0,
  } }
  validationMessage.value = ''
  coachMessage.value = ''
}

function formatAnswer(q: Question, answer: AnswerValue): string {
  if (q.type === 'single' && typeof answer === 'string') return q.options.find(item => item.id === answer)?.label ?? answer
  if (q.type === 'multiple' && Array.isArray(answer)) return answer.map(id => q.options.find(item => item.id === id)?.label ?? id).join('; ')
  if (q.type === 'order' && Array.isArray(answer)) return answer.map((id, index) => `${index + 1}. ${orderLabel(q, id)}`).join(' → ')
  if (q.type === 'match' && typeof answer === 'object' && !Array.isArray(answer)) return q.pairs.map(pair => `${pair.left} — ${q.pairs.find(item => item.id === answer[pair.id])?.right ?? '—'}`).join('; ')
  return '—'
}

function selectAdaptiveNext(previous: Question, wasCorrect: boolean): Question | undefined {
  const used = new Set(steps.value.map(item => item.question?.id))
  const difficultyIndex = { easy: 0, medium: 1, hard: 2 }
  const desired = Math.max(0, Math.min(2, difficultyIndex[previous.difficulty] + (wasCorrect ? 1 : -1)))
  const skillCounts = Object.fromEntries(['recognition', 'application', 'analysis'].map(skill => [skill, steps.value.filter(item => item.question?.skill === skill).length]))
  return props.method.quiz.filter(item => !used.has(item.id)).sort((a, b) =>
    Math.abs(difficultyIndex[a.difficulty] - desired) - Math.abs(difficultyIndex[b.difficulty] - desired)
    || skillCounts[a.skill]! - skillCounts[b.skill]!
    || a.id.localeCompare(b.id),
  )[0]
}

function groupScores(answers: QuestAnswer[], key: 'skill' | 'type') {
  return answers.reduce<Record<string, GroupScore>>((groups, answer) => {
    const group = groups[answer[key]] ?? { correct: 0, total: 0 }
    group.total += 1
    if (answer.isCorrect) group.correct += 1
    groups[answer[key]] = group
    return groups
  }, {})
}

function finishQuest() {
  const all = steps.value.flatMap(item => item.question ? [submittedAnswers.value[item.question.id]] : []).filter((item): item is QuestAnswer => Boolean(item))
  const verification = props.method.quest.mode === 'mastery' && steps.value.some(item => item.stage.id === 'verification')
  const assessedIds = verification ? new Set(props.method.quest.stages.find(item => item.id === 'verification')?.questionIds) : new Set(all.map(item => item.questionId))
  const assessed = all.filter(item => assessedIds.has(item.questionId))
  const correctCount = assessed.filter(item => item.isCorrect).length
  const total = assessed.length
  try { localStorage.removeItem(storageKey()) } catch { /* Local storage may be disabled. */ }
  ready = false
  emit('finish', {
    methodId: props.method.id, completedAt: new Date().toISOString(), elapsedSeconds: elapsedSeconds.value,
    answers: all, correctCount, total, score: total ? Math.round(correctCount / total * 100) : 0,
    bySkill: groupScores(assessed, 'skill'), byType: groupScores(assessed, 'type'),
    assessedQuestionIds: assessed.map(item => item.questionId), questMode: props.method.quest.mode,
  })
}

function continueQuest() {
  const active = step.value
  if (!active || active.question && !response.value) return
  if (currentIndex.value < steps.value.length - 1) {
    currentIndex.value += 1
  } else if (props.method.quest.mode === 'mastery' && active.stage.id === 'diagnostic') {
    const ids = props.method.quest.stages[0]?.questionIds ?? []
    const passed = ids.length > 0 && ids.every(id => submittedAnswers.value[id]?.isCorrect)
    if (passed) { finishQuest(); return }
    const remedy = props.method.quest.remediation
    const verification = props.method.quest.stages.find(item => item.id === 'verification')
    if (!remedy || !verification) { finishQuest(); return }
    steps.value = [...steps.value, {
      id: '__remediation', kind: 'remediation',
      stage: { id: '__remediation', title: remedy.title, objective: 'Виправте прогалини перед повторною перевіркою', content: remedy.content, questionIds: [] },
    }, ...stageSteps(verification)]
    currentIndex.value += 1
  } else if (props.method.quest.mode === 'adaptive' && active.question && questionCount.value < Math.min(6, props.method.quiz.length)) {
    const next = selectAdaptiveNext(active.question, response.value?.isCorrect ?? false)
    if (!next) { finishQuest(); return }
    steps.value = [...steps.value, makeStep(props.method.quest.stages[0]!, next)]
    currentIndex.value += 1
  } else {
    finishQuest()
    return
  }
  highestUnlocked.value = Math.max(highestUnlocked.value, currentIndex.value)
  validationMessage.value = ''
  coachMessage.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function navigateTo(index: number) {
  if (index < 0 || index > highestUnlocked.value) return
  currentIndex.value = index
  validationMessage.value = ''
  coachMessage.value = ''
}
</script>

<template>
  <section class="quest-shell" :style="{ '--accent': method.accent || '#8b7aff' }">
    <div class="quest-top"><button type="button" class="back-button" @click="emit('back')">← До методики</button><span>ВЕБКВЕСТ · {{ method.shortTitle }}</span></div>
    <header class="quest-header"><span class="kicker">ТЕМА · {{ method.quest.topic }}</span><h1>{{ method.quest.mission }}</h1><p>{{ method.quest.briefing }}</p><div class="strategy"><strong>Як працює цей маршрут</strong><span>{{ method.quest.strategy }}</span></div></header>

    <div v-if="step" class="quest-grid">
      <main class="step-card">
        <div class="progress-line"><span :style="{ width: `${completionPercent}%` }"></span></div>
        <div class="step-overline"><span>КРОК {{ String(currentIndex + 1).padStart(2, '0') }} / {{ String(steps.length).padStart(2, '0') }}</span><span>{{ formatTime(elapsedSeconds) }}</span></div>
        <div class="stage-heading"><span class="stage-dot"></span><div><span class="stage-index">{{ stagePosition > 0 ? `ЕТАП ${stagePosition} / ${method.quest.stages.length}` : 'НАВЧАЛЬНА ПІДТРИМКА' }}</span><h2>{{ step.stage.title }}</h2><p>{{ step.stage.objective }}</p></div></div>
        <div class="stage-content">{{ step.stage.content }}</div>

        <template v-if="question">
          <div class="question-heading"><span>{{ question.difficulty === 'easy' ? 'БАЗОВЕ' : question.difficulty === 'medium' ? 'СЕРЕДНЄ' : 'СКЛАДНЕ' }} ЗАВДАННЯ</span><h3>{{ question.prompt }}</h3><p v-if="question.context">{{ question.context }}</p></div>
          <div v-if="question.type === 'single' || question.type === 'multiple'" class="options">
            <label v-for="(option, index) in question.options" :key="option.id" class="option" :class="{ selected: question.type === 'single' ? selectedSingle(question) === option.id : selectedMultiple(question).includes(option.id) }">
              <input :type="question.type === 'single' ? 'radio' : 'checkbox'" :name="`question-${question.id}`" :value="option.id" :checked="question.type === 'single' ? selectedSingle(question) === option.id : selectedMultiple(question).includes(option.id)" :disabled="Boolean(response)" @change="question.type === 'single' ? selectSingle(question, option.id) : toggleMultiple(question, option.id)">
              <span class="option-letter">{{ String.fromCharCode(65 + index) }}</span><span>{{ option.label }}</span>
            </label>
          </div>
          <div v-else-if="question.type === 'order'" class="order-list">
            <div v-for="(id, index) in selectedOrder(question)" :key="id" class="order-row"><span>{{ index + 1 }}.</span><span>{{ orderLabel(question, id) }}</span><div><button type="button" :disabled="Boolean(response) || index === 0" :aria-label="`Перемістити ${orderLabel(question, id)} вище`" @click="moveOrder(question, index, -1)">↑</button><button type="button" :disabled="Boolean(response) || index === selectedOrder(question).length - 1" :aria-label="`Перемістити ${orderLabel(question, id)} нижче`" @click="moveOrder(question, index, 1)">↓</button></div></div>
          </div>
          <div v-else-if="question.type === 'match'" class="match-list"><label v-for="pair in question.pairs" :key="pair.id"><span>{{ pair.left }}</span><select :value="selectedMatch(question)[pair.id] || ''" :disabled="Boolean(response)" @change="setMatch(question, pair.id, $event)"><option value="">Оберіть відповідність</option><option v-for="item in [...question.pairs].reverse()" :key="item.id" :value="item.id">{{ item.right }}</option></select></label></div>

          <div v-if="method.quest.mode === 'zpd' && question.hints?.length && !response" class="hint-box"><button type="button" :disabled="currentHints.length >= question.hints.length" @click="revealHint">{{ currentHints.length ? 'Наступна підказка' : 'Потрібна підказка?' }}</button><p v-for="(hint, index) in currentHints" :key="index"><strong>Підказка {{ index + 1 }}.</strong> {{ hint }}</p></div>
          <p v-if="coachMessage" class="coach" role="status">{{ coachMessage }}</p>
          <p v-if="validationMessage" class="validation" role="alert">{{ validationMessage }}</p>
          <div v-if="response" class="feedback" :class="response.isCorrect ? 'correct' : 'incorrect'"><strong>{{ response.isCorrect ? 'Влучне рішення' : 'Розберіть рішення' }}</strong><p>{{ question.explanation }}</p><p v-if="!response.isCorrect"><b>Безпечна відповідь:</b> {{ formatAnswer(question, response.correct) }}</p><p v-if="method.quest.mode === 'zpd' && (response.hintsUsed || response.retries)">Використано підказок: {{ response.hintsUsed || 0 }} · Повторних спроб: {{ response.retries || 0 }}</p></div>
        </template>
        <div class="step-actions"><button type="button" class="secondary" :disabled="currentIndex === 0" @click="navigateTo(currentIndex - 1)">← Назад</button><button v-if="question && !response" type="button" class="primary" @click="submitAnswer">Перевірити рішення ↗</button><button v-else type="button" class="primary" @click="continueQuest">{{ currentIndex === steps.length - 1 ? 'Продовжити маршрут →' : 'Далі →' }}</button></div>
      </main>
      <aside class="quest-sidebar"><div class="sidebar-block"><span class="side-label">ВАШ МАРШРУТ</span><strong>{{ answeredCount }} / {{ targetCount }}</strong><p>завдань виконано</p><div class="side-track"><span :style="{ width: `${completionPercent}%` }"></span></div></div><div class="sidebar-block"><span class="side-label">ЕТАПИ</span><div class="step-nav"><button v-for="(item, index) in steps" :key="`${item.id}-${index}`" type="button" :disabled="index > highestUnlocked" :class="{ active: currentIndex === index, done: item.question ? Boolean(submittedAnswers[item.question.id]) : index < highestUnlocked }" @click="navigateTo(index)"><span>{{ index + 1 }}</span>{{ item.stage.title }}</button></div></div><div class="side-note">Прогрес цього проходження зберігається у браузері для активного локального профілю.</div></aside>
    </div>
    <div v-else class="empty-state"><h2>Маршрут готується</h2><p>Для цієї методики ще немає завдань.</p><button type="button" class="primary" @click="emit('back')">До методики</button></div>
  </section>
</template>

<style scoped>
.quest-shell{width:min(1220px,calc(100% - 48px));margin:0 auto;padding:28px 0 90px;color:#f0f4ff}.quest-top{display:flex;align-items:center;justify-content:space-between;gap:20px;color:#8593ae;font-size:.71rem;font-weight:800;letter-spacing:.12em}.back-button{border:0;background:none;color:#cbd5e8;font:inherit;font-size:.85rem;font-weight:700;letter-spacing:0;cursor:pointer}.quest-header{padding:38px 0 30px;max-width:860px}.kicker,.stage-index,.side-label{font-size:.68rem;font-weight:800;letter-spacing:.14em;color:var(--accent)}.quest-header h1{font-size:clamp(2rem,4vw,3.2rem);line-height:1.12;letter-spacing:-.05em;margin:13px 0}.quest-header>p{color:#b2bfd5;line-height:1.65;margin:0 0 20px}.strategy{display:grid;gap:6px;background:color-mix(in srgb,var(--accent) 10%,#151e2e);border:1px solid color-mix(in srgb,var(--accent) 28%,#263349);border-radius:13px;padding:16px 19px;font-size:.88rem;line-height:1.5;color:#c9d4e7}.strategy strong{color:#fff}.quest-grid{display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:20px;align-items:start}.step-card,.sidebar-block{background:#151e2d;border:1px solid #2b384d;border-radius:18px}.step-card{overflow:hidden;padding:0 30px 28px;min-width:0}.progress-line,.side-track{height:5px;background:#2b3649;overflow:hidden}.progress-line{margin:0 -30px 25px}.progress-line span,.side-track span{display:block;height:100%;background:var(--accent);transition:width .2s}.step-overline{display:flex;justify-content:space-between;color:#92a0b9;font-size:.68rem;font-weight:800;letter-spacing:.13em}.stage-heading{display:flex;gap:14px;align-items:flex-start;margin:28px 0 18px}.stage-dot{width:12px;height:12px;margin-top:5px;border-radius:50%;flex:none;background:var(--accent);box-shadow:0 0 0 6px color-mix(in srgb,var(--accent) 16%,transparent)}.stage-heading h2{font-size:1.6rem;letter-spacing:-.03em;margin:6px 0}.stage-heading p{color:#aebbd0;margin:0;line-height:1.5}.stage-content{white-space:pre-line;color:#d3ddeb;line-height:1.65;background:#1c293b;border-left:3px solid var(--accent);padding:17px 19px;border-radius:0 11px 11px 0}.question-heading{margin-top:29px}.question-heading>span{font-size:.67rem;font-weight:800;letter-spacing:.14em;color:#92a1bd}.question-heading h3{font-size:1.28rem;line-height:1.42;letter-spacing:-.015em;margin:9px 0 14px}.question-heading p{color:#b8c6da;line-height:1.6}.options{display:grid;gap:10px}.option{display:flex;align-items:center;gap:13px;border:1px solid #35435a;border-radius:11px;padding:14px 15px;color:#dce5f3;cursor:pointer;line-height:1.45;background:#182334}.option.selected{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,#182334)}.option input{accent-color:var(--accent)}.option-letter{display:grid;place-items:center;flex:none;width:26px;height:26px;border-radius:7px;background:#2a3850;color:#c8d4e7;font-size:.7rem;font-weight:800}.order-list,.match-list{display:grid;gap:9px}.order-row,.match-list label{display:flex;align-items:center;gap:12px;border:1px solid #35435a;border-radius:10px;padding:11px 13px;background:#182334}.order-row>span:nth-child(2){flex:1}.order-row>div{display:flex;gap:4px}.order-row button{background:#2a3850;color:#e8effb;border:0;border-radius:7px;width:32px;height:32px;cursor:pointer}.order-row button:disabled{opacity:.4;cursor:default}.match-list label{justify-content:space-between}.match-list label>span{max-width:48%}.match-list select{max-width:52%;min-height:39px;border:1px solid #495a75;border-radius:7px;color:#eef3ff;background:#223047;padding:6px}.hint-box{margin-top:18px;padding:16px;background:#202c3e;border:1px dashed #60718e;border-radius:11px}.hint-box button{border:0;background:none;color:#c5b8ff;font:inherit;font-weight:800;cursor:pointer;padding:0}.hint-box button:disabled{opacity:.55;cursor:default}.hint-box p{color:#d1dbea;line-height:1.5;margin:11px 0 0}.coach,.validation{color:#ffcb9c;line-height:1.5}.feedback{margin-top:22px;border-radius:11px;padding:16px 19px;background:#2a2b38;border:1px solid #a06f53}.feedback.correct{background:#17382f;border-color:#3d9272}.feedback strong{color:#fff}.feedback p{margin:7px 0 0;color:#d8e3ed;line-height:1.55}.step-actions{display:flex;justify-content:space-between;gap:12px;margin-top:25px}.primary,.secondary{font:inherit;font-size:.85rem;font-weight:800;border-radius:9px;padding:12px 17px;cursor:pointer}.primary{background:var(--accent);border:1px solid var(--accent);color:#101824}.secondary{background:#202c3e;border:1px solid #3d4b63;color:#e0e8f5}.secondary:disabled{opacity:.4;cursor:default}.quest-sidebar{display:grid;gap:14px}.sidebar-block{padding:20px}.sidebar-block>strong{display:block;font-size:2rem;margin-top:8px}.sidebar-block>p{color:#98a9c2;margin:2px 0 15px;font-size:.84rem}.side-track{border-radius:5px}.step-nav{display:grid;gap:7px;margin-top:15px}.step-nav button{display:flex;gap:10px;align-items:center;width:100%;text-align:left;background:#1b2738;color:#c7d3e5;border:1px solid transparent;border-radius:8px;padding:9px;font:inherit;font-size:.77rem;cursor:pointer}.step-nav button span{display:grid;place-items:center;flex:none;width:23px;height:23px;border-radius:6px;background:#304059;font-size:.68rem}.step-nav button.active{border-color:var(--accent);color:#fff}.step-nav button.done span{background:var(--accent);color:#101824}.step-nav button:disabled{opacity:.5;cursor:default}.side-note{font-size:.77rem;color:#90a0ba;line-height:1.5;padding:0 5px}.empty-state{padding:40px;background:#151e2d;border-radius:16px}.empty-state p{color:#aebbd0}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--accent);outline-offset:3px}@media(max-width:900px){.quest-grid{grid-template-columns:1fr}.quest-sidebar{grid-template-columns:1fr 1fr}.step-nav{max-height:220px;overflow:auto}}@media(max-width:600px){.quest-shell{width:calc(100% - 28px);padding-top:16px}.quest-top>span{display:none}.quest-header{padding-top:27px}.step-card{padding:0 17px 22px}.progress-line{margin-left:-17px;margin-right:-17px}.quest-sidebar{grid-template-columns:1fr}.step-actions{flex-wrap:wrap}.step-actions button{flex:1}.match-list label{display:grid}.match-list label>span,.match-list select{max-width:100%;width:100%}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;scroll-behavior:auto!important}}
</style>

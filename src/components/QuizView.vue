<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

type QuestionType = 'single' | 'multiple' | 'order' | 'match'
type AnswerValue = string | string[] | Record<string, string>
type GroupScore = { correct: number; total: number }

interface Question {
  id: string
  type: QuestionType
  difficulty: 'easy' | 'medium' | 'hard'
  skill: 'recognition' | 'application' | 'analysis'
  prompt: string
  context?: string
  options?: { id: string; label: string }[]
  correct?: string | string[]
  items?: { id: string; label: string }[]
  correctOrder?: string[]
  pairs?: { id: string; left: string; right: string }[]
  explanation: string
}

interface QuizAnswer {
  questionId: string
  type: QuestionType
  skill: Question['skill']
  selected: AnswerValue
  correct: AnswerValue
  isCorrect: boolean
}

const props = defineProps<{ method: any }>()
const emit = defineEmits<{
  finish: [result: {
    methodId: string
    completedAt: string
    elapsedSeconds: number
    answers: QuizAnswer[]
    correctCount: number
    total: number
    score: number
    bySkill: Record<string, GroupScore>
    byType: Record<string, GroupScore>
  }]
  back: []
}>()

const questions = computed<Question[]>(() => Array.isArray(props.method?.quiz) ? props.method.quiz : [])
const questionCardRef = ref<HTMLElement | null>(null)
const currentIndex = ref(0)
const draftAnswers = ref<Record<string, AnswerValue>>({})
const submittedAnswers = ref<Record<string, QuizAnswer>>({})
const validationMessage = ref('')
const elapsedSeconds = ref(0)
let startedAt = Date.now()
let timer: ReturnType<typeof setInterval> | undefined

const question = computed<Question | undefined>(() => questions.value[currentIndex.value])
const submittedCount = computed(() => Object.keys(submittedAnswers.value).length)
const currentResponse = computed(() => question.value ? submittedAnswers.value[question.value.id] : undefined)
const isSubmitted = computed(() => Boolean(currentResponse.value))
const currentProgress = computed(() => questions.value.length ? Math.round(((currentIndex.value + 1) / questions.value.length) * 100) : 0)
const completionProgress = computed(() => questions.value.length ? Math.round((submittedCount.value / questions.value.length) * 100) : 0)

const typeNames: Record<QuestionType, string> = {
  single: 'Одна відповідь',
  multiple: 'Кілька відповідей',
  order: 'Послідовність',
  match: 'Відповідність',
}
const skillNames: Record<Question['skill'], string> = {
  recognition: 'Розпізнавання',
  application: 'Застосування',
  analysis: 'Аналіз',
}
const difficultyNames: Record<Question['difficulty'], string> = {
  easy: 'Базовий',
  medium: 'Середній',
  hard: 'Поглиблений',
}

function resetQuiz() {
  currentIndex.value = 0
  draftAnswers.value = {}
  submittedAnswers.value = {}
  validationMessage.value = ''
  elapsedSeconds.value = 0
  startedAt = Date.now()
}

watch(() => props.method?.id, resetQuiz)
onMounted(() => {
  startedAt = Date.now()
  timer = setInterval(() => {
    elapsedSeconds.value = Math.floor((Date.now() - startedAt) / 1000)
  }, 1000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function setDraft(id: string, value: AnswerValue) {
  draftAnswers.value = { ...draftAnswers.value, [id]: value }
  validationMessage.value = ''
}

function selectedSingle(q: Question): string {
  const value = draftAnswers.value[q.id]
  return typeof value === 'string' ? value : ''
}

function selectedMultiple(q: Question): string[] {
  const value = draftAnswers.value[q.id]
  return Array.isArray(value) ? value : []
}

function selectSingle(q: Question, id: string) {
  if (!submittedAnswers.value[q.id]) setDraft(q.id, id)
}

function toggleMultiple(q: Question, id: string) {
  if (submittedAnswers.value[q.id]) return
  const current = selectedMultiple(q)
  setDraft(q.id, current.includes(id) ? current.filter(item => item !== id) : [...current, id])
}

function initialOrder(q: Question): string[] {
  const ids = (q.items ?? []).map(item => item.id)
  const key = ids.join('|')
  if (ids.length > 1 && key === (q.correctOrder ?? []).join('|')) {
    return [...ids.slice(1), ids[0]!]
  }
  return ids
}

function selectedOrder(q: Question): string[] {
  const value = draftAnswers.value[q.id]
  return Array.isArray(value) ? value : initialOrder(q)
}

function moveOrder(q: Question, index: number, direction: -1 | 1) {
  if (submittedAnswers.value[q.id]) return
  const next = [...selectedOrder(q)]
  const destination = index + direction
  if (destination < 0 || destination >= next.length) return
  ;[next[index], next[destination]] = [next[destination]!, next[index]!]
  setDraft(q.id, next)
}

function orderLabel(q: Question, id: string) {
  return q.items?.find(item => item.id === id)?.label ?? id
}

function selectedMatch(q: Question): Record<string, string> {
  const value = draftAnswers.value[q.id]
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function setMatch(q: Question, leftId: string, event: Event) {
  if (submittedAnswers.value[q.id]) return
  const rightId = (event.target as HTMLSelectElement).value
  setDraft(q.id, { ...selectedMatch(q), [leftId]: rightId })
}

function correctFor(q: Question): AnswerValue {
  if (q.type === 'order') return [...(q.correctOrder ?? [])]
  if (q.type === 'match') return Object.fromEntries((q.pairs ?? []).map(pair => [pair.id, pair.id]))
  if (q.type === 'multiple') return Array.isArray(q.correct) ? [...q.correct] : []
  return typeof q.correct === 'string' ? q.correct : ''
}

function isAnswerCorrect(q: Question, selected: AnswerValue): boolean {
  const expected = correctFor(q)
  if (q.type === 'single') return typeof selected === 'string' && selected === expected
  if (q.type === 'multiple' && Array.isArray(selected) && Array.isArray(expected)) {
    return selected.length === expected.length && [...selected].sort().every((id, index) => id === [...expected].sort()[index])
  }
  if (q.type === 'order' && Array.isArray(selected) && Array.isArray(expected)) {
    return selected.length === expected.length && selected.every((id, index) => id === expected[index])
  }
  if (q.type === 'match' && selected && typeof selected === 'object' && !Array.isArray(selected)) {
    return (q.pairs ?? []).every(pair => selected[pair.id] === pair.id)
  }
  return false
}

function submitAnswer() {
  const q = question.value
  if (!q || submittedAnswers.value[q.id]) return

  let selected: AnswerValue
  if (q.type === 'single') {
    selected = selectedSingle(q)
    if (!selected) { validationMessage.value = 'Оберіть одну відповідь.'; return }
  } else if (q.type === 'multiple') {
    selected = [...selectedMultiple(q)]
    if (!selected.length) { validationMessage.value = 'Оберіть принаймні одну відповідь.'; return }
  } else if (q.type === 'order') {
    selected = [...selectedOrder(q)]
    if (selected.length !== (q.items ?? []).length || new Set(selected).size !== selected.length) {
      validationMessage.value = 'Розташуйте всі кроки в послідовності.'
      return
    }
  } else {
    selected = { ...selectedMatch(q) }
    const chosen = (q.pairs ?? []).map(pair => (selected as Record<string, string>)[pair.id]).filter(Boolean)
    if (chosen.length !== (q.pairs ?? []).length) {
      validationMessage.value = 'Доберіть відповідність для кожного рядка.'
      return
    }
    if (new Set(chosen).size !== chosen.length) {
      validationMessage.value = 'Кожен варіант можна використати лише один раз.'
      return
    }
  }

  submittedAnswers.value = {
    ...submittedAnswers.value,
    [q.id]: {
      questionId: q.id,
      type: q.type,
      skill: q.skill,
      selected,
      correct: correctFor(q),
      isCorrect: isAnswerCorrect(q, selected),
    },
  }
  validationMessage.value = ''
}

function formatAnswer(q: Question, answer: AnswerValue): string {
  if (q.type === 'single' && typeof answer === 'string') {
    return q.options?.find(option => option.id === answer)?.label ?? answer
  }
  if (q.type === 'multiple' && Array.isArray(answer)) {
    return answer.map(id => q.options?.find(option => option.id === id)?.label ?? id).join('; ')
  }
  if (q.type === 'order' && Array.isArray(answer)) {
    return answer.map((id, index) => `${index + 1}. ${orderLabel(q, id)}`).join(' → ')
  }
  if (q.type === 'match' && answer && typeof answer === 'object' && !Array.isArray(answer)) {
    return (q.pairs ?? []).map(pair => `${pair.left} — ${q.pairs?.find(item => item.id === answer[pair.id])?.right ?? '—'}`).join('; ')
  }
  return '—'
}

function navigateTo(index: number) {
  if (index < 0 || index >= questions.value.length || index > submittedCount.value) return
  currentIndex.value = index
  validationMessage.value = ''
  nextTick(() => {
    if (window.matchMedia('(max-width: 900px)').matches) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      questionCardRef.value?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
    }
  })
}

function groupScores(answers: QuizAnswer[], key: 'skill' | 'type') {
  return answers.reduce<Record<string, GroupScore>>((groups, answer) => {
    const group = groups[answer[key]] ?? { correct: 0, total: 0 }
    group.total += 1
    if (answer.isCorrect) group.correct += 1
    groups[answer[key]] = group
    return groups
  }, {})
}

function finishQuiz() {
  if (!questions.value.length || questions.value.some(q => !submittedAnswers.value[q.id])) return
  const answers = questions.value.map(q => submittedAnswers.value[q.id]!)
  const correctCount = answers.filter(answer => answer.isCorrect).length
  const total = questions.value.length
  const finalElapsed = Math.floor((Date.now() - startedAt) / 1000)
  emit('finish', {
    methodId: props.method.id,
    completedAt: new Date().toISOString(),
    elapsedSeconds: finalElapsed,
    answers,
    correctCount,
    total,
    score: Math.round((correctCount / total) * 100),
    bySkill: groupScores(answers, 'skill'),
    byType: groupScores(answers, 'type'),
  })
}

function continueQuiz() {
  if (!isSubmitted.value) return
  if (currentIndex.value < questions.value.length - 1) navigateTo(currentIndex.value + 1)
  else finishQuiz()
}
</script>

<template>
  <section class="quiz-shell" :style="{ '--method-accent': method.accent || '#8b7aff' }">
    <div class="quiz-topline">
      <button class="text-button" type="button" @click="emit('back')"><span aria-hidden="true">←</span> До методики</button>
      <span class="quiz-module">ІНТЕРАКТИВНИЙ ПРАКТИКУМ <span class="module-dot"></span> {{ method.shortTitle || method.title }}</span>
    </div>

    <div class="quiz-heading">
      <div>
        <span class="eyebrow"><span class="pulse-dot"></span> РЕЖИМ ПЕРЕВІРКИ</span>
        <h1>Перевірте знання <span>на практиці.</span></h1>
        <p>Проаналізуйте ситуації, оберіть рішення та отримайте пояснення до кожного кроку.</p>
      </div>
      <div class="timer-chip" aria-label="Час проходження"><span class="timer-icon" aria-hidden="true">◷</span> {{ formatTime(elapsedSeconds) }}</div>
    </div>

    <div v-if="question" class="quiz-layout">
      <section ref="questionCardRef" class="question-card" aria-label="Поточне завдання">
        <div class="question-progress"><span :style="{ width: `${currentProgress}%` }"></span></div>
        <div class="question-meta">
          <span class="question-number">ЗАВДАННЯ {{ String(currentIndex + 1).padStart(2, '0') }} <span>/ {{ String(questions.length).padStart(2, '0') }}</span></span>
          <div class="question-tags">
            <span>{{ typeNames[question.type] }}</span>
            <span>{{ difficultyNames[question.difficulty] }}</span>
          </div>
        </div>

        <div class="question-copy">
          <span class="question-skill"><span aria-hidden="true">✦</span> {{ skillNames[question.skill] }}</span>
          <h2>{{ question.prompt }}</h2>
          <p v-if="question.context" class="scenario">{{ question.context }}</p>
        </div>

        <div class="answer-area">
          <p class="answer-label">{{ question.type === 'order' ? 'РОЗТАШУЙТЕ КРОКИ' : question.type === 'match' ? 'УСТАНОВІТЬ ВІДПОВІДНІСТЬ' : 'ОБЕРІТЬ ВІДПОВІДЬ' }}</p>

          <div v-if="question.type === 'single' || question.type === 'multiple'" class="option-list">
            <label
              v-for="(option, index) in question.options || []"
              :key="option.id"
              class="option"
              :class="{ selected: question.type === 'single' ? selectedSingle(question) === option.id : selectedMultiple(question).includes(option.id), locked: isSubmitted }"
            >
              <input
                :type="question.type === 'single' ? 'radio' : 'checkbox'"
                :name="`question-${question.id}`"
                :value="option.id"
                :checked="question.type === 'single' ? selectedSingle(question) === option.id : selectedMultiple(question).includes(option.id)"
                :disabled="isSubmitted"
                @change="question.type === 'single' ? selectSingle(question, option.id) : toggleMultiple(question, option.id)"
              >
              <span class="option-letter" aria-hidden="true">{{ String.fromCharCode(65 + index) }}</span>
              <span class="option-text">{{ option.label }}</span>
              <span class="option-indicator" aria-hidden="true">✓</span>
            </label>
          </div>

          <div v-else-if="question.type === 'order'" class="order-list">
            <div v-for="(id, index) in selectedOrder(question)" :key="id" class="order-row">
              <span class="order-index">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="order-text">{{ orderLabel(question, id) }}</span>
              <div class="order-controls">
                <button type="button" :disabled="isSubmitted || index === 0" :aria-label="`Перемістити «${orderLabel(question, id)}» вище`" @click="moveOrder(question, index, -1)">↑</button>
                <button type="button" :disabled="isSubmitted || index === selectedOrder(question).length - 1" :aria-label="`Перемістити «${orderLabel(question, id)}» нижче`" @click="moveOrder(question, index, 1)">↓</button>
              </div>
            </div>
            <p class="input-hint">Користуйтеся стрілками, щоб змінити порядок кроків.</p>
          </div>

          <div v-else-if="question.type === 'match'" class="match-list">
            <label v-for="pair in question.pairs || []" :key="pair.id" class="match-row">
              <span class="match-term">{{ pair.left }}</span>
              <span class="match-arrow" aria-hidden="true">→</span>
              <select :value="selectedMatch(question)[pair.id] || ''" :disabled="isSubmitted" :aria-label="`Відповідність для «${pair.left}»`" @change="setMatch(question, pair.id, $event)">
                <option value="">Оберіть варіант</option>
                <option v-for="answer in [...(question.pairs || [])].reverse()" :key="answer.id" :value="answer.id">{{ answer.right }}</option>
              </select>
            </label>
          </div>
        </div>

        <p v-if="validationMessage" class="validation" role="alert">{{ validationMessage }}</p>

        <div v-if="currentResponse" class="feedback" :class="currentResponse.isCorrect ? 'feedback-correct' : 'feedback-incorrect'" aria-live="polite">
          <span class="feedback-icon" aria-hidden="true">{{ currentResponse.isCorrect ? '✓' : '↗' }}</span>
          <div>
            <strong>{{ currentResponse.isCorrect ? 'Влучно! Саме так.' : 'Є над чим поміркувати.' }}</strong>
            <p>{{ question.explanation }}</p>
            <p v-if="!currentResponse.isCorrect" class="correct-answer"><b>Правильна відповідь:</b> {{ formatAnswer(question, currentResponse.correct) }}</p>
          </div>
        </div>

        <div class="question-actions">
          <button class="secondary-button" type="button" :disabled="currentIndex === 0" @click="navigateTo(currentIndex - 1)">← Попереднє</button>
          <button v-if="!isSubmitted" class="primary-button" type="button" @click="submitAnswer">Перевірити відповідь <span aria-hidden="true">↗</span></button>
          <button v-else class="primary-button" type="button" @click="continueQuiz">{{ currentIndex === questions.length - 1 ? 'Переглянути результат' : 'Наступне завдання' }} <span aria-hidden="true">→</span></button>
        </div>
      </section>

      <aside class="quiz-sidebar" aria-label="Прогрес тестування">
        <div class="sidebar-title"><span class="sidebar-icon" aria-hidden="true">◈</span><span>Ваш маршрут</span></div>
        <div class="sidebar-progress-copy"><strong>{{ submittedCount }} <span>/ {{ questions.length }}</span></strong><span>завдань завершено</span></div>
        <div class="sidebar-progress" role="progressbar" :aria-valuenow="submittedCount" :aria-valuemin="0" :aria-valuemax="questions.length" aria-label="Виконано завдань"><span :style="{ width: `${completionProgress}%` }"></span></div>
        <div class="question-nav" aria-label="Навігація завданнями">
          <button
            v-for="(item, index) in questions"
            :key="item.id"
            type="button"
            :class="{ active: currentIndex === index, done: Boolean(submittedAnswers[item.id]) }"
            :disabled="index > submittedCount"
            :aria-label="`Завдання ${index + 1}${submittedAnswers[item.id] ? ', перевірено' : ''}`"
            :aria-current="currentIndex === index ? 'step' : undefined"
            @click="navigateTo(index)"
          >{{ submittedAnswers[item.id] ? '✓' : String(index + 1).padStart(2, '0') }}</button>
        </div>
        <div class="sidebar-note"><span aria-hidden="true">✧</span><p>Після перевірки кожного завдання ви побачите пояснення, яке допоможе закріпити методику.</p></div>
      </aside>
    </div>
    <div v-else class="empty-state">
      <h2>Завдань поки немає</h2>
      <p>Для цієї методики ще не додано тестових ситуацій.</p>
      <button class="primary-button" type="button" @click="emit('back')">Повернутися до методики</button>
    </div>
  </section>
</template>

<style scoped>
.quiz-shell{--surface:var(--panel,#151c2b);--border:var(--line,rgba(190,207,240,.13));--ink:var(--text,#f3f6ff);--soft:var(--muted,#a1acc3);width:min(1250px,calc(100% - 48px));margin:0 auto;padding:28px 0 96px;color:var(--ink)}
.quiz-topline,.quiz-heading,.question-meta,.question-actions,.sidebar-title,.sidebar-progress-copy{display:flex;align-items:center;justify-content:space-between;gap:20px}
button{font:inherit;cursor:pointer}.text-button{border:0;background:none;color:#c4cee1;padding:9px 0;font-weight:600;transition:color .2s}.text-button:hover{color:#fff}.text-button span{margin-right:9px}.quiz-module{font-size:.68rem;letter-spacing:.17em;color:#828ea8;font-weight:800;text-align:right}.module-dot{display:inline-block;width:4px;height:4px;border-radius:50%;background:var(--method-accent);margin:0 7px 2px}
.quiz-heading{align-items:end;margin:46px 0 34px}.eyebrow{display:inline-flex;align-items:center;gap:9px;color:var(--method-accent);font-size:.7rem;font-weight:800;letter-spacing:.17em}.pulse-dot{width:7px;height:7px;border-radius:50%;background:var(--method-accent);box-shadow:0 0 0 5px color-mix(in srgb,var(--method-accent) 15%,transparent)}h1,h2,p{margin-top:0}.quiz-heading h1{font-size:clamp(2rem,4vw,3.35rem);line-height:1.1;letter-spacing:-.055em;margin:13px 0 13px;font-weight:780}.quiz-heading h1 span{color:var(--method-accent)}.quiz-heading p{max-width:650px;color:var(--soft);font-size:.98rem;line-height:1.65;margin-bottom:0}.timer-chip{align-self:end;white-space:nowrap;border:1px solid var(--border);background:rgba(255,255,255,.035);padding:12px 17px;border-radius:14px;color:#dce5fa;font-weight:700;font-variant-numeric:tabular-nums}.timer-icon{font-size:1.25rem;color:var(--method-accent);vertical-align:-1px;margin-right:7px}
.quiz-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:22px;align-items:start}.question-card,.quiz-sidebar,.empty-state{border:1px solid var(--border);background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.012)),var(--surface);box-shadow:0 22px 65px rgba(0,0,0,.16);border-radius:24px}.question-card{position:relative;overflow:hidden;padding:37px 42px 34px}.question-progress{position:absolute;top:0;left:0;right:0;height:3px;background:rgba(255,255,255,.055)}.question-progress span,.sidebar-progress span{display:block;height:100%;background:linear-gradient(90deg,var(--method-accent),#62d7ea);transition:width .35s ease}.question-number{color:var(--method-accent);letter-spacing:.17em;font-size:.72rem;font-weight:800}.question-number span{color:#6e7b95}.question-tags{display:flex;gap:8px;flex-wrap:wrap}.question-tags span{font-size:.68rem;font-weight:700;color:#b1bdd5;border:1px solid var(--border);border-radius:50px;padding:6px 10px}.question-copy{margin:40px 0 37px}.question-skill{display:inline-flex;align-items:center;gap:8px;color:#bec9de;font-size:.76rem;font-weight:700}.question-skill span{color:var(--method-accent)}.question-copy h2{font-size:clamp(1.45rem,2.35vw,2.2rem);line-height:1.31;letter-spacing:-.035em;margin:17px 0 0;max-width:760px}.scenario{margin:19px 0 0;border-left:2px solid var(--method-accent);padding:12px 18px;color:#c3cde0;background:rgba(255,255,255,.028);line-height:1.65;border-radius:0 9px 9px 0}.answer-label{font-size:.68rem;letter-spacing:.16em;color:#8190aa;font-weight:800;margin-bottom:15px}.option-list,.order-list,.match-list{display:grid;gap:10px}.option{position:relative;display:flex;align-items:center;gap:15px;min-height:66px;padding:13px 17px;border:1px solid var(--border);background:rgba(8,15,30,.28);border-radius:13px;cursor:pointer;transition:border-color .2s,background .2s,transform .2s}.option:hover:not(.locked){border-color:color-mix(in srgb,var(--method-accent) 60%,transparent);background:rgba(255,255,255,.055);transform:translateX(3px)}.option.selected{border-color:var(--method-accent);background:color-mix(in srgb,var(--method-accent) 10%,transparent)}.option.locked{cursor:default}.option input{position:absolute;opacity:0;width:1px;height:1px}.option:focus-within{outline:2px solid var(--method-accent);outline-offset:3px}.option-letter{width:32px;height:32px;flex:0 0 32px;display:grid;place-items:center;border:1px solid var(--border);border-radius:8px;color:#8795b1;font-size:.73rem;font-weight:800}.option.selected .option-letter{border-color:var(--method-accent);color:var(--method-accent)}.option-text{line-height:1.45;font-size:.92rem;color:#e0e7f4;flex:1}.option-indicator{opacity:0;color:var(--method-accent);font-weight:900}.option.selected .option-indicator{opacity:1}
.order-row{display:flex;align-items:center;gap:15px;min-height:68px;padding:12px 14px;border:1px solid var(--border);background:rgba(8,15,30,.28);border-radius:13px}.order-index{width:32px;flex:none;color:var(--method-accent);font-size:.74rem;font-weight:800}.order-text{flex:1;color:#e0e7f4;line-height:1.4;font-size:.9rem}.order-controls{display:flex;gap:5px}.order-controls button{width:31px;height:31px;border-radius:8px;border:1px solid var(--border);background:rgba(255,255,255,.04);color:#d8e3fa}.order-controls button:hover:not(:disabled){border-color:var(--method-accent);color:#fff}.order-controls button:disabled{opacity:.3;cursor:default}.input-hint{color:#8290a9;font-size:.77rem;margin:4px 0 0}.match-row{display:grid;grid-template-columns:minmax(0,1fr) 20px minmax(0,1fr);gap:14px;align-items:center;min-height:70px;padding:12px 15px;border:1px solid var(--border);background:rgba(8,15,30,.28);border-radius:13px}.match-term{color:#e0e7f4;font-size:.9rem;line-height:1.35}.match-arrow{text-align:center;color:var(--method-accent)}.match-row select{width:100%;min-width:0;border:1px solid var(--border);border-radius:8px;padding:11px 12px;background:#202a3b;color:#eaf0ff;font:inherit;font-size:.84rem}.match-row select:focus-visible,.order-controls button:focus-visible,.question-nav button:focus-visible,.primary-button:focus-visible,.secondary-button:focus-visible,.text-button:focus-visible{outline:2px solid var(--method-accent);outline-offset:3px}
.validation{color:#ffadad;font-size:.84rem;margin:18px 0 0}.feedback{display:flex;gap:13px;margin-top:24px;border:1px solid rgba(87,215,177,.27);background:rgba(57,191,148,.08);border-radius:14px;padding:18px;color:#d7f5e9}.feedback-incorrect{border-color:rgba(255,181,117,.28);background:rgba(255,181,117,.07);color:#ffe3c9}.feedback-icon{display:grid;place-items:center;flex:0 0 27px;width:27px;height:27px;border-radius:50%;background:rgba(75,220,175,.2);color:#70efc2;font-weight:800}.feedback-incorrect .feedback-icon{background:rgba(255,181,117,.17);color:#ffd0a3}.feedback strong{display:block;font-size:.91rem;margin:2px 0 5px}.feedback p{font-size:.83rem;line-height:1.56;margin:0}.feedback .correct-answer{margin-top:8px}.question-actions{border-top:1px solid var(--border);padding-top:26px;margin-top:32px}.primary-button,.secondary-button{min-height:45px;border-radius:10px;padding:11px 17px;font-size:.84rem;font-weight:800;transition:transform .2s,filter .2s,border-color .2s}.primary-button{border:1px solid transparent;background:var(--method-accent);color:#07111c;box-shadow:0 8px 26px color-mix(in srgb,var(--method-accent) 22%,transparent)}.primary-button:hover{transform:translateY(-2px);filter:brightness(1.12)}.primary-button span{margin-left:12px}.secondary-button{border:1px solid var(--border);background:rgba(255,255,255,.035);color:#d0d9ea}.secondary-button:hover:not(:disabled){border-color:#788aa8}.secondary-button:disabled{opacity:.4;cursor:default}
.quiz-sidebar{padding:24px 22px}.sidebar-title{justify-content:flex-start;color:#f0f4ff;font-size:.89rem;font-weight:800}.sidebar-icon{display:grid;place-items:center;width:34px;height:34px;border:1px solid color-mix(in srgb,var(--method-accent) 30%,transparent);border-radius:9px;color:var(--method-accent);background:color-mix(in srgb,var(--method-accent) 10%,transparent);font-size:1.2rem}.sidebar-progress-copy{align-items:end;margin:32px 0 13px}.sidebar-progress-copy strong{font-size:2.1rem;letter-spacing:-.06em;line-height:1}.sidebar-progress-copy strong span{color:#71809b;font-size:1.05rem}.sidebar-progress-copy>span{color:#8290aa;font-size:.71rem}.sidebar-progress{height:6px;background:rgba(255,255,255,.09);overflow:hidden;border-radius:6px}.question-nav{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:26px}.question-nav button{aspect-ratio:1;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,.035);color:#94a2bb;font-size:.77rem;font-weight:800}.question-nav button.active{border-color:var(--method-accent);color:var(--method-accent);background:color-mix(in srgb,var(--method-accent) 13%,transparent)}.question-nav button.done:not(.active){color:#7ee7c2;border-color:rgba(126,231,194,.3);background:rgba(126,231,194,.07)}.question-nav button:disabled{opacity:.4;cursor:default}.sidebar-note{display:flex;align-items:start;gap:10px;border-top:1px solid var(--border);margin-top:26px;padding-top:22px}.sidebar-note span{color:var(--method-accent);font-size:1.2rem;line-height:1}.sidebar-note p{color:#8998b1;font-size:.74rem;line-height:1.55;margin:0}.empty-state{padding:60px;text-align:center}.empty-state h2{font-size:1.5rem}.empty-state p{color:var(--soft)}
@media(max-width:900px){.quiz-layout{grid-template-columns:1fr}.quiz-sidebar{order:initial}.question-nav{grid-template-columns:repeat(10,1fr)}.sidebar-note{display:none}.sidebar-progress-copy{margin-top:18px}}@media(max-width:650px){.quiz-shell{width:min(100% - 30px,1250px);padding-top:15px}.quiz-module{display:none}.quiz-heading{margin:34px 0 25px;align-items:start}.quiz-heading h1{font-size:2.25rem}.timer-chip{font-size:.8rem;padding:9px 11px}.question-card{padding:30px 20px 24px;border-radius:18px}.question-meta{align-items:start;flex-direction:column;gap:13px}.question-copy{margin:30px 0}.question-copy h2{font-size:1.5rem}.match-row{grid-template-columns:1fr;gap:7px}.match-arrow{display:none}.question-nav{grid-template-columns:repeat(5,1fr)}.question-actions{gap:9px}.primary-button,.secondary-button{font-size:.74rem;padding:10px 11px}.primary-button span{margin-left:4px}}
@media(max-width:400px){.question-actions{flex-direction:column-reverse;align-items:stretch}.question-actions button{min-width:0;white-space:normal}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;animation:none!important}}
</style>

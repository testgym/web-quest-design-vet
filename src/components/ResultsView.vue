<script setup lang="ts">
import { computed } from 'vue'

type AnswerValue = string | string[] | Record<string, string>
type GroupScore = { correct: number; total: number }
type Dimension = 'skill' | 'type'

interface Question {
  id: string
  type: 'single' | 'multiple' | 'order' | 'match'
  skill: 'recognition' | 'application' | 'analysis'
  prompt: string
  options?: { id: string; label: string }[]
  items?: { id: string; label: string }[]
  pairs?: { id: string; left: string; right: string }[]
  explanation: string
}

interface QuizAnswer {
  questionId: string
  type: Question['type']
  skill: Question['skill']
  selected: AnswerValue
  correct: AnswerValue
  isCorrect: boolean
}

const props = defineProps<{ method: any; result: any }>()
const emit = defineEmits<{ retry: []; back: []; home: [] }>()

const questions = computed<Question[]>(() => Array.isArray(props.method?.quiz) ? props.method.quiz : [])
const answers = computed<QuizAnswer[]>(() => Array.isArray(props.result?.answers) ? props.result.answers : [])
const score = computed(() => Math.max(0, Math.min(100, Number(props.result?.score) || 0)))
const correctCount = computed(() => Number(props.result?.correctCount) || 0)
const total = computed(() => Number(props.result?.total) || questions.value.length)
const missed = computed(() => answers.value
  .map((answer, index) => ({ question: questions.value.find(question => question.id === answer.questionId), answer, index }))
  .filter((item): item is { question: Question; answer: QuizAnswer; index: number } => Boolean(item.question && !item.answer.isCorrect)))
const assessmentNote = computed(() => props.result?.questMode === 'mastery' && answers.value.length > total.value
  ? 'Підсумковий бал обчислено за новими завданнями після корекції. Помилки першої перевірки також є нижче.'
  : props.result?.questMode === 'adaptive'
    ? 'Маршрут змінював складність після кожного рішення. Бал обчислено за отриманими завданнями.'
    : props.result?.questMode === 'zpd'
      ? 'Підказки й повторні спроби допомагали під час квесту; перегляньте їх разом із результатом.'
      : 'Бал обчислено за виконаними завданнями цього маршруту.')

const skillNames: Record<Question['skill'], string> = {
  recognition: 'Розпізнавання',
  application: 'Застосування',
  analysis: 'Аналіз',
}
const typeNames: Record<Question['type'], string> = {
  single: 'Одна відповідь',
  multiple: 'Кілька відповідей',
  order: 'Послідовність',
  match: 'Відповідність',
}

const mastery = computed(() => {
  if (props.result?.questMode === 'mastery') {
    return score.value === 100
      ? { label: 'Мету опановано', description: 'У підсумковій перевірці всі рішення безпечні. Можна переходити до складніших випадків.', tone: 'excellent' }
      : { label: 'Потрібна ще одна спроба', description: 'Перегляньте пояснення до помилок і пройдіть маршрут знову для повного опанування.', tone: 'review' }
  }
  if (score.value >= 85) return { label: 'Впевнене рішення', description: 'Ви добре розпізнаєте ризики фішингу та обираєте безпечні дії.', tone: 'excellent' }
  if (score.value >= 70) return { label: 'Сформована основа', description: 'Більшість рішень безпечні. Перегляньте пояснення до помилок.', tone: 'good' }
  if (score.value >= 50) return { label: 'Потрібна практика', description: 'Повторіть складні ситуації та спробуйте маршрут ще раз.', tone: 'developing' }
  return { label: 'Потрібне повторення', description: 'Прочитайте пояснення до рішень і поверніться до квесту.', tone: 'review' }
})

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Number(seconds) || 0)
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(Math.floor(safeSeconds % 60)).padStart(2, '0')}`
}

function groupsFor(dimension: Dimension): { key: string; label: string; correct: number; total: number; percent: number }[] {
  const names = dimension === 'skill' ? skillNames : typeNames
  const provided = (dimension === 'skill' ? props.result?.bySkill : props.result?.byType) as Record<string, GroupScore> | undefined
  const keys = Object.keys(names)
  return keys.map(key => {
    const fallbackAnswers = answers.value.filter(answer => answer[dimension] === key)
    const group = provided?.[key] ?? { correct: fallbackAnswers.filter(answer => answer.isCorrect).length, total: fallbackAnswers.length }
    return {
      key,
      label: names[key as keyof typeof names] || key,
      correct: group.correct,
      total: group.total,
      percent: group.total ? Math.round((group.correct / group.total) * 100) : 0,
    }
  }).filter(group => group.total > 0)
}

const bySkill = computed(() => groupsFor('skill'))
const byType = computed(() => groupsFor('type'))

function formatAnswer(q: Question, value: AnswerValue): string {
  if (q.type === 'single' && typeof value === 'string') {
    return q.options?.find(option => option.id === value)?.label ?? value
  }
  if (q.type === 'multiple' && Array.isArray(value)) {
    return value.map(id => q.options?.find(option => option.id === id)?.label ?? id).join('; ')
  }
  if (q.type === 'order' && Array.isArray(value)) {
    return value.map((id, index) => `${index + 1}. ${q.items?.find(item => item.id === id)?.label ?? id}`).join(' → ')
  }
  if (q.type === 'match' && value && typeof value === 'object' && !Array.isArray(value)) {
    return (q.pairs ?? []).map(pair => `${pair.left} — ${q.pairs?.find(item => item.id === value[pair.id])?.right ?? '—'}`).join('; ')
  }
  return '—'
}
</script>

<template>
  <section class="results-shell" :style="{ '--method-accent': method.accent || '#8b7aff' }">
    <div class="results-topline">
      <button type="button" class="text-button" @click="emit('home')"><span aria-hidden="true">←</span> До каталогу</button>
      <span class="results-module">РЕЗУЛЬТАТ ВЕБКВЕСТУ <span class="module-dot"></span> {{ method.shortTitle || method.title }}</span>
    </div>

    <header class="results-heading">
      <span class="eyebrow"><span class="pulse-dot"></span> ПІДСУМКИ НАВЧАННЯ</span>
      <h1>Ваш результат <span>готовий.</span></h1>
      <p>{{ method.quest.topic }} · {{ assessmentNote }}</p>
    </header>

    <div class="result-hero">
      <div class="score-ring" :style="{ '--score': `${score}%` }" :aria-label="`Результат ${score} відсотків`" role="img">
        <div class="ring-inner"><strong>{{ score }}<span>%</span></strong><small>ЗАГАЛЬНИЙ БАЛ</small></div>
      </div>
      <div class="hero-copy">
        <span class="mastery-badge" :class="mastery.tone"><span aria-hidden="true">✦</span> {{ mastery.label }}</span>
        <h2>{{ score >= 70 ? 'Ви просунулися в захисті акаунта.' : 'Продовжуйте тренувати безпечні рішення.' }}</h2>
        <p>{{ mastery.description }}</p>
        <div class="hero-actions">
          <button class="primary-button" type="button" @click="emit('retry')">Спробувати ще раз <span aria-hidden="true">↗</span></button>
          <button class="secondary-button" type="button" @click="emit('back')">Переглянути маршрут</button>
        </div>
      </div>
      <div class="hero-glow" aria-hidden="true"></div>
    </div>

    <div class="stat-grid">
      <div class="stat-card"><span class="stat-icon correct" aria-hidden="true">✓</span><span class="stat-label">ПРАВИЛЬНІ ВІДПОВІДІ</span><strong>{{ correctCount }} <small>/ {{ total }}</small></strong><span class="stat-caption">завдань виконано вірно</span></div>
      <div class="stat-card"><span class="stat-icon time" aria-hidden="true">◷</span><span class="stat-label">ЧАС ПРОХОДЖЕННЯ</span><strong>{{ formatTime(result.elapsedSeconds) }}</strong><span class="stat-caption">хвилини : секунди</span></div>
      <div class="stat-card"><span class="stat-icon level" aria-hidden="true">◈</span><span class="stat-label">РІВЕНЬ ЗАСВОЄННЯ</span><strong class="tier-value">{{ mastery.label }}</strong><span class="stat-caption">за підсумком практикуму</span></div>
    </div>

    <div class="breakdown-grid">
      <section class="breakdown-card" aria-labelledby="skill-title">
        <div class="section-top"><span class="section-mark" aria-hidden="true">✧</span><div><span class="section-kicker">АНАЛІТИКА</span><h2 id="skill-title">За навичками</h2></div></div>
        <div class="bar-list">
          <div v-for="group in bySkill" :key="group.key" class="bar-row">
            <div class="bar-copy"><span>{{ group.label }}</span><strong>{{ group.correct }} / {{ group.total }}</strong></div>
            <div class="bar-track" :aria-label="`${group.label}: ${group.correct} з ${group.total}`" role="meter" :aria-valuenow="group.correct" :aria-valuemin="0" :aria-valuemax="group.total"><span :style="{ width: `${group.percent}%` }"></span></div>
          </div>
        </div>
      </section>
      <section class="breakdown-card" aria-labelledby="type-title">
        <div class="section-top"><span class="section-mark alternate" aria-hidden="true">◇</span><div><span class="section-kicker">ФОРМАТИ</span><h2 id="type-title">За типами завдань</h2></div></div>
        <div class="bar-list">
          <div v-for="group in byType" :key="group.key" class="bar-row">
            <div class="bar-copy"><span>{{ group.label }}</span><strong>{{ group.correct }} / {{ group.total }}</strong></div>
            <div class="bar-track alternate-track" :aria-label="`${group.label}: ${group.correct} з ${group.total}`" role="meter" :aria-valuenow="group.correct" :aria-valuemin="0" :aria-valuemax="group.total"><span :style="{ width: `${group.percent}%` }"></span></div>
          </div>
        </div>
      </section>
    </div>

    <section class="review-section" aria-labelledby="review-title">
      <div class="review-heading"><div><span class="section-kicker">РОБОТА НАД ПОМИЛКАМИ</span><h2 id="review-title">{{ missed.length ? 'Розберіть складні моменти' : 'Усі відповіді правильні' }}</h2></div><span class="review-count">{{ missed.length }} {{ missed.length === 1 ? 'завдання' : 'завдань' }}</span></div>
      <div v-if="missed.length" class="review-list">
        <details v-for="item in missed" :key="item.question.id" class="review-item">
          <summary><span class="review-number">{{ String(item.index + 1).padStart(2, '0') }}</span><span class="review-prompt">{{ item.question.prompt }}</span><span class="review-chevron" aria-hidden="true">⌄</span></summary>
          <div v-if="item.answer" class="review-detail">
            <div class="answer-compare"><div><span>ВАША ВІДПОВІДЬ</span><p>{{ formatAnswer(item.question, item.answer.selected) }}</p></div><div><span>ПРАВИЛЬНА ВІДПОВІДЬ</span><p>{{ formatAnswer(item.question, item.answer.correct) }}</p></div></div>
            <p class="review-explanation"><span aria-hidden="true">✦</span> {{ item.question.explanation }}</p>
          </div>
        </details>
      </div>
      <p v-else class="perfect-note">Усі отримані завдання розв’язано правильно. Можете обрати інший маршрут цієї теми.</p>
    </section>

    <div class="bottom-actions"><button type="button" class="secondary-button" @click="emit('home')">← До каталогу методик</button><button type="button" class="primary-button" @click="emit('retry')">Повторити вебквест <span aria-hidden="true">↗</span></button></div>
  </section>
</template>

<style scoped>
.results-shell{--surface:var(--panel,#151c2b);--border:var(--line,rgba(190,207,240,.13));--ink:var(--text,#f3f6ff);--soft:var(--muted,#a1acc3);width:min(1250px,calc(100% - 48px));margin:0 auto;padding:28px 0 96px;color:var(--ink)}button{font:inherit;cursor:pointer}.results-topline{display:flex;align-items:center;justify-content:space-between;gap:20px}.text-button{border:0;background:none;color:#c4cee1;padding:9px 0;font-weight:600;transition:color .2s}.text-button:hover{color:#fff}.text-button span{margin-right:9px}.results-module{font-size:.68rem;letter-spacing:.17em;color:#828ea8;font-weight:800;text-align:right}.module-dot{display:inline-block;width:4px;height:4px;border-radius:50%;background:var(--method-accent);margin:0 7px 2px}.results-heading{margin:46px 0 33px}.eyebrow{display:inline-flex;align-items:center;gap:9px;color:var(--method-accent);font-size:.7rem;font-weight:800;letter-spacing:.17em}.pulse-dot{width:7px;height:7px;border-radius:50%;background:var(--method-accent);box-shadow:0 0 0 5px color-mix(in srgb,var(--method-accent) 15%,transparent)}h1,h2,p{margin-top:0}.results-heading h1{font-size:clamp(2rem,4vw,3.35rem);line-height:1.1;letter-spacing:-.055em;margin:13px 0;font-weight:780}.results-heading h1 span{color:var(--method-accent)}.results-heading p{color:var(--soft);font-size:.98rem;line-height:1.6;margin:0}
.result-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:245px minmax(0,1fr);align-items:center;gap:45px;min-height:310px;padding:36px 55px;border:1px solid color-mix(in srgb,var(--method-accent) 27%,var(--border));border-radius:24px;background:radial-gradient(circle at 15% 50%,color-mix(in srgb,var(--method-accent) 16%,transparent),transparent 34%),linear-gradient(115deg,rgba(255,255,255,.045),rgba(255,255,255,.008)),var(--surface);box-shadow:0 24px 65px rgba(0,0,0,.18)}.hero-glow{position:absolute;width:300px;height:300px;right:-120px;top:-140px;border:1px solid color-mix(in srgb,var(--method-accent) 23%,transparent);border-radius:50%;box-shadow:0 0 0 35px color-mix(in srgb,var(--method-accent) 3%,transparent),0 0 0 85px color-mix(in srgb,var(--method-accent) 2%,transparent);pointer-events:none}.score-ring{width:215px;height:215px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--method-accent) var(--score),rgba(255,255,255,.09) 0);box-shadow:0 0 45px color-mix(in srgb,var(--method-accent) 15%,transparent);transform:rotate(-90deg)}.ring-inner{width:181px;height:181px;border-radius:50%;background:#121a29;display:flex;align-items:center;justify-content:center;flex-direction:column;transform:rotate(90deg)}.ring-inner strong{font-size:4.1rem;letter-spacing:-.09em;line-height:1;font-variant-numeric:tabular-nums}.ring-inner strong span{font-size:1.8rem;letter-spacing:-.04em;color:var(--method-accent)}.ring-inner small{color:#8b99b4;font-size:.62rem;font-weight:800;letter-spacing:.13em;margin-top:13px}.hero-copy{position:relative;z-index:1}.mastery-badge{display:inline-flex;align-items:center;gap:8px;color:#8ff0cb;background:rgba(92,220,174,.1);border:1px solid rgba(92,220,174,.24);border-radius:50px;padding:8px 12px;font-size:.72rem;font-weight:800}.mastery-badge.developing,.mastery-badge.review{color:#ffcd9b;background:rgba(255,185,121,.1);border-color:rgba(255,185,121,.25)}.hero-copy h2{font-size:clamp(1.6rem,2.4vw,2.5rem);line-height:1.14;letter-spacing:-.04em;margin:18px 0 12px}.hero-copy p{color:#acbad1;line-height:1.64;max-width:560px;font-size:.91rem;margin-bottom:24px}.hero-actions,.bottom-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.primary-button,.secondary-button{min-height:45px;border-radius:10px;padding:11px 17px;font-size:.84rem;font-weight:800;transition:transform .2s,filter .2s,border-color .2s}.primary-button{border:1px solid transparent;background:var(--method-accent);color:#07111c;box-shadow:0 8px 26px color-mix(in srgb,var(--method-accent) 22%,transparent)}.primary-button:hover{transform:translateY(-2px);filter:brightness(1.12)}.primary-button span{margin-left:11px}.secondary-button{border:1px solid var(--border);background:rgba(255,255,255,.035);color:#d0d9ea}.secondary-button:hover{border-color:#788aa8}.primary-button:focus-visible,.secondary-button:focus-visible,.text-button:focus-visible,.review-item summary:focus-visible{outline:2px solid var(--method-accent);outline-offset:3px}
.stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:20px}.stat-card,.breakdown-card,.review-section{border:1px solid var(--border);background:linear-gradient(145deg,rgba(255,255,255,.04),rgba(255,255,255,.008)),var(--surface);border-radius:19px;box-shadow:0 18px 55px rgba(0,0,0,.1)}.stat-card{position:relative;min-height:160px;padding:24px;display:flex;flex-direction:column;align-items:flex-start}.stat-icon{position:absolute;top:20px;right:21px;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-size:1.1rem;color:#82ebc3;background:rgba(96,220,172,.1)}.stat-icon.time{color:#b7a5ff;background:rgba(159,135,255,.12)}.stat-icon.level{color:#79d7ee;background:rgba(94,209,238,.11)}.stat-label{color:#8290aa;font-size:.65rem;letter-spacing:.13em;font-weight:800;margin-bottom:21px}.stat-card strong{font-size:2rem;letter-spacing:-.05em;line-height:1.1}.stat-card strong small{font-size:1rem;color:#71809b;letter-spacing:0}.stat-card .tier-value{font-size:1.31rem;letter-spacing:-.02em;line-height:1.24}.stat-caption{font-size:.73rem;color:#8290aa;margin-top:7px}
.breakdown-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:20px}.breakdown-card{padding:26px 28px 30px}.section-top{display:flex;align-items:center;gap:13px}.section-mark{display:grid;place-items:center;flex:0 0 40px;height:40px;border-radius:11px;background:color-mix(in srgb,var(--method-accent) 12%,transparent);color:var(--method-accent);font-size:1.4rem}.section-mark.alternate{background:rgba(92,204,226,.11);color:#75ddec}.section-kicker{font-size:.62rem;font-weight:800;letter-spacing:.16em;color:#7e8ca6}.section-top h2{font-size:1.16rem;letter-spacing:-.025em;margin:3px 0 0}.bar-list{display:grid;gap:19px;margin-top:27px}.bar-copy{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:9px;font-size:.82rem;color:#c8d3e7}.bar-copy strong{font-size:.75rem;color:#e8edfa;font-variant-numeric:tabular-nums}.bar-track{height:7px;border-radius:7px;background:rgba(255,255,255,.08);overflow:hidden}.bar-track span{display:block;height:100%;border-radius:7px;background:linear-gradient(90deg,var(--method-accent),#b1a6ff)}.alternate-track span{background:linear-gradient(90deg,#4ab8dc,#88e7d4)}
.review-section{margin-top:20px;padding:28px}.review-heading{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:20px}.review-heading h2{font-size:1.35rem;letter-spacing:-.03em;margin:6px 0 0}.review-count{white-space:nowrap;color:#8695ae;font-size:.76rem}.review-list{display:grid;gap:9px}.review-item{border:1px solid var(--border);border-radius:12px;background:rgba(8,15,30,.28);overflow:hidden}.review-item summary{display:flex;align-items:center;gap:16px;list-style:none;padding:17px 19px;cursor:pointer}.review-item summary::-webkit-details-marker{display:none}.review-number{color:var(--method-accent);font-size:.75rem;font-weight:800}.review-prompt{flex:1;color:#e1e8f4;font-size:.87rem;line-height:1.4}.review-chevron{color:#9ba9c2;font-size:1.4rem;line-height:1;transition:transform .2s}.review-item[open] .review-chevron{transform:rotate(180deg)}.review-detail{padding:0 19px 20px 51px}.answer-compare{display:grid;grid-template-columns:1fr 1fr;gap:15px}.answer-compare>div{border:1px solid var(--border);border-radius:9px;padding:13px;background:rgba(255,255,255,.025)}.answer-compare span{font-size:.63rem;font-weight:800;letter-spacing:.13em;color:#8493ad}.answer-compare>div:last-child span{color:#8ce6c5}.answer-compare p{color:#d5deef;font-size:.79rem;line-height:1.5;margin:8px 0 0}.review-explanation{color:#b1c0d8;font-size:.82rem;line-height:1.6;margin:17px 0 0}.review-explanation span{color:var(--method-accent);margin-right:6px}.perfect-note{color:#b4c2d8;font-size:.87rem;line-height:1.6;margin:0}.bottom-actions{justify-content:space-between;margin-top:27px}
@media(max-width:800px){.result-hero{grid-template-columns:190px 1fr;gap:25px;padding:32px}.score-ring{width:180px;height:180px}.ring-inner{width:150px;height:150px}.ring-inner strong{font-size:3.4rem}.stat-grid{gap:10px}.stat-card{padding:19px}}@media(max-width:650px){.results-shell{width:min(100% - 30px,1250px);padding-top:15px}.results-module{display:none}.results-heading{margin:34px 0 25px}.results-heading h1{font-size:2.25rem}.result-hero{grid-template-columns:1fr;justify-items:start;gap:25px;padding:29px}.score-ring{width:160px;height:160px}.ring-inner{width:134px;height:134px}.ring-inner strong{font-size:3rem}.ring-inner small{font-size:.51rem}.stat-grid,.breakdown-grid{grid-template-columns:1fr}.stat-card{min-height:140px}.review-section{padding:21px 16px}.answer-compare{grid-template-columns:1fr}.review-detail{padding-left:18px}.hero-actions{align-items:stretch}.hero-actions button{flex:1}.bottom-actions{gap:10px}.bottom-actions button{flex:1;font-size:.73rem;padding:10px}.review-count{display:none}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;animation:none!important}}
</style>

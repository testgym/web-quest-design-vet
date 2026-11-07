<script setup lang="ts">
import { computed } from 'vue'
import type { Method } from '../data/methods'
import { getInteractiveQuest, type InteractiveResult } from '../data/activities'

const props = defineProps<{ method: Method; result: InteractiveResult }>()
const emit = defineEmits<{ retry: []; back: []; home: [] }>()
const quest = computed(() => getInteractiveQuest(props.method.id))
const records = computed(() => props.result.records ?? [])
const assessedRecords = computed(() => props.result.questMode === 'mastery'
  ? records.value.filter(record => quest.value.verification?.some(activity => activity.id === record.activityId))
  : records.value)
const criteria = computed(() => assessedRecords.value.flatMap(record => record.criteria))
const automatic = computed(() => criteria.value.filter(criterion => criterion.mode === 'automatic'))
const metCount = computed(() => automatic.value.filter(criterion => criterion.met).length)
const selfAssessed = computed(() => records.value.flatMap(record => record.criteria).filter(criterion => criterion.mode === 'self'))
const score = computed(() => Math.max(0, Math.min(100, Number(props.result.score) || 0)))
const achieved = computed(() => props.result.completed && (props.result.questMode !== 'mastery' || props.result.mastered))
const needsWork = computed(() => records.value.filter(record => record.criteria.some(criterion => !criterion.met)))
const artifacts = computed(() => props.result.artifacts ?? [])
const skillLabels: Record<string, string> = {
  recognition: 'Розпізнавання цифрових загроз',
  verification: 'Незалежна перевірка інформації',
  analysis: 'Аналіз доказів і зв’язків',
  creation: 'Створення власного рішення',
  recovery: 'Відновлення захисту акаунта',
  transfer: 'Перенесення в професійну практику',
  orientation: 'Орієнтування в ситуації',
  reflection: 'Осмислення власних дій',
}
const groups = computed(() => [...new Set(assessedRecords.value.map(record => record.skill))].map(skill => {
  const items = assessedRecords.value.filter(record => record.skill === skill).flatMap(record => record.criteria).filter(criterion => criterion.mode === 'automatic')
  const met = items.filter(criterion => criterion.met).length
  return { skill, label: skillLabels[skill] ?? 'Практичні вміння', met, total: items.length, percent: items.length ? Math.round(met / items.length * 100) : 0 }
}))
const status = computed(() => {
  if (props.result.questMode === 'mastery') {
    return achieved.value
      ? { label: 'Усі уміння опановано', title: 'Ви пройшли перевірку опанування.', description: 'Кожне цільове уміння підтверджено практичною дією. Перенесіть ці дії у свою навчальну майстерню.' }
      : { label: 'Потрібна корекція', title: 'Продовжіть опановувати складне уміння.', description: 'Для цього маршруту потрібне повне опанування кожного уміння. Перегляньте критерії та поверніться до практики.' }
  }
  return achieved.value
    ? { label: 'Мету маршруту досягнуто', title: 'Ваше рішення збережено в портфоліо.', description: 'Обговоріть створений матеріал із викладачем і перевірте, як його можна застосувати на практиці.' }
    : { label: 'Є простір для вдосконалення', title: 'Удоскональте своє рішення.', description: 'Перегляньте невиконані критерії, збережіть матеріали та повторіть потрібні дії в новому проходженні.' }
})
function formatTime(seconds: number) {
  const safe = Math.max(0, Number(seconds) || 0)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(Math.floor(safe % 60)).padStart(2, '0')}`
}
function criterionCount(items: { met: boolean }[]) { return items.filter(item => item.met).length }
function downloadPortfolio() {
  const lines = [
    'EDU.LAB — портфоліо вебквесту', props.method.title, quest.value.title,
    `Дата: ${new Date(props.result.completedAt).toLocaleString('uk-UA')}`,
    `Критерії дій: ${metCount.value} / ${automatic.value.length} (${score.value}%)`,
    `Самоперевірка власних матеріалів: ${criterionCount(selfAssessed.value)} / ${selfAssessed.value.length} (окремо від відсотка)`,
    `Статус: ${status.value.label}`, `Час: ${formatTime(props.result.elapsedSeconds)}`,
    `Самостійних етапів: ${props.result.independentCount}; підказок: ${props.result.supportCount}`,
    '', quest.value.strategy, props.result.learningNote, '', 'ЖУРНАЛ РОБОТИ',
    ...records.value.flatMap((record, index) => [
      '', `${index + 1}. ${record.title}`, record.summary,
      `Підказок: ${record.hintsUsed}; повторних спроб: ${record.retries}`,
      ...record.criteria.map(criterion => `${criterion.met ? '[+]' : '[ ]'} ${criterion.label} (${criterion.mode === 'self' ? 'самоперевірка' : 'тренажер'}). ${criterion.detail}`),
    ]),
    '', 'МОЇ МАТЕРІАЛИ', ...artifacts.value.flatMap(artifact => ['', artifact.title, artifact.text]),
    '', 'РЕФЛЕКСІЯ', props.result.reflection,
    '', 'Критерії тренажера та самоперевірка описують виконані дії. Якість аргументації й авторських матеріалів потребує обговорення з викладачем.',
  ]
  const url = URL.createObjectURL(new Blob(['\uFEFF', lines.join('\n')], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `EDU-LAB-${props.method.id}-portfolio.txt`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <section class="results-shell" :style="{ '--method-accent': method.accent }">
    <div class="results-topline"><button type="button" class="text-button" @click="emit('home')">← До каталогу</button><span class="results-module">ПОРТФОЛІО · {{ method.shortTitle }}</span></div>
    <header class="results-heading"><span class="eyebrow">ПІДСУМКИ ПРАКТИЧНОЇ РОБОТИ</span><h1>Ваші дії. <span>Ваш результат.</span></h1><p>{{ quest.title }} · {{ quest.tool }}</p></header>
    <div class="result-hero">
      <div class="score-ring" :style="{ '--score': `${score}%` }" role="img" :aria-label="`Виконано ${score} відсотків критеріїв практичних дій`"><div class="ring-inner"><strong>{{ score }}<span>%</span></strong><small>КРИТЕРІЇ ПРАКТИЧНИХ ДІЙ</small></div></div>
      <div class="hero-copy"><span class="status-badge" :class="{ 'status-badge--review': !achieved }">{{ status.label }}</span><h2>{{ status.title }}</h2><p>{{ status.description }}</p><div class="hero-actions"><button class="primary-button" type="button" @click="downloadPortfolio">Завантажити портфоліо ↓</button><button class="secondary-button" type="button" @click="emit('retry')">Нове проходження ↗</button></div></div>
    </div>
    <p class="assessment-note"><span v-if="result.questMode === 'mastery'">Відсоток розраховано за новими перевірочними випадками; тренувальні етапи збережено в журналі. </span>Відсоток відображає перевірені практичні дії. Власні матеріали та самоперевірка збережені окремо. Аргументацію й якість авторських матеріалів обговоріть із викладачем.</p>
    <div class="stat-grid">
      <div class="stat-card"><span class="stat-label">КРИТЕРІЇ ДІЙ</span><strong>{{ metCount }} <small>/ {{ automatic.length }}</small></strong><span class="stat-caption">перевірено тренажером</span></div>
      <div class="stat-card"><span class="stat-label">САМОСТІЙНІ ЕТАПИ</span><strong>{{ result.independentCount }} <small>/ {{ records.length }}</small></strong><span class="stat-caption">підказок використано: {{ result.supportCount }}</span></div>
      <div class="stat-card"><span class="stat-label">ЧАС РОБОТИ</span><strong>{{ formatTime(result.elapsedSeconds) }}</strong><span class="stat-caption">хвилини : секунди</span></div>
    </div>
    <div class="breakdown-grid">
      <section class="breakdown-card" aria-labelledby="skill-title"><span class="section-kicker">НАВЧАЛЬНИЙ ПРОГРЕС</span><h2 id="skill-title">За вміннями</h2><div class="bar-list"><div v-for="group in groups" :key="group.skill" class="bar-row"><div class="bar-copy"><span>{{ group.label }}</span><strong v-if="group.total">{{ group.met }} / {{ group.total }}</strong></div><div v-if="group.total" class="bar-track" role="meter" :aria-label="group.label" :aria-valuenow="group.met" :aria-valuemin="0" :aria-valuemax="group.total"><span :style="{ width: `${group.percent}%` }"></span></div><small v-else class="authored-skill">Власний матеріал у портфоліо · для обговорення з викладачем</small></div></div></section>
      <section class="breakdown-card" aria-labelledby="method-title"><span class="section-kicker">ЛОГІКА МЕТОДИКИ</span><h2 id="method-title">Як ви навчалися</h2><p class="learning-note">{{ quest.strategy }}</p><p class="learning-note">{{ result.learningNote }}</p><div class="rubric-modes"><div><strong>{{ criterionCount(automatic) }} / {{ automatic.length }}</strong><span>критерії тренажера</span></div><div><strong>{{ criterionCount(selfAssessed) }} / {{ selfAssessed.length }}</strong><span>критерії самоперевірки</span></div></div></section>
    </div>
    <section class="review-section" aria-labelledby="review-title"><div class="review-heading"><div><span class="section-kicker">ДІЇ ТА ЗВОРОТНИЙ ЗВ’ЯЗОК</span><h2 id="review-title">Журнал проходження</h2></div><span class="review-count">{{ records.length }} етапів</span></div><p class="section-description">{{ needsWork.length ? `Є ${needsWork.length} етапів із невиконаними критеріями. Розкрийте їх для перегляду.` : 'Усі критерії цього проходження позначено як виконані. Перегляньте докази та власні матеріали.' }}</p><div class="review-list"><details v-for="(record, index) in records" :key="`${record.activityId}-${index}`" class="review-item" :open="record.criteria.some(criterion => !criterion.met)"><summary><span class="review-number">{{ String(index + 1).padStart(2, '0') }}</span><span class="review-prompt">{{ record.title }}<small>{{ record.stage }}</small></span><span class="record-status">{{ criterionCount(record.criteria) }} / {{ record.criteria.length }}</span><span aria-hidden="true">⌄</span></summary><div class="review-detail"><p class="record-summary">{{ record.summary }}</p><p class="support-info">{{ record.independent ? 'Самостійне виконання' : 'Виконання з підтримкою' }} · Підказок: {{ record.hintsUsed }} · Повторних спроб: {{ record.retries }}</p><ul class="criteria-list"><li v-for="criterion in record.criteria" :key="criterion.id" :class="{ 'criterion--met': criterion.met }"><span class="criterion-mark" aria-hidden="true">{{ criterion.met ? '✓' : '○' }}</span><div><strong>{{ criterion.label }}</strong><span class="criterion-mode">{{ criterion.mode === 'self' ? 'Самоперевірка' : 'Тренажер' }}</span><p>{{ criterion.detail }}</p></div></li></ul></div></details></div></section>
    <section class="portfolio-section" aria-labelledby="portfolio-title"><div class="review-heading"><div><span class="section-kicker">ДЛЯ ОБГОВОРЕННЯ З ВИКЛАДАЧЕМ</span><h2 id="portfolio-title">Мої матеріали</h2></div><button class="secondary-button" type="button" @click="downloadPortfolio">Завантажити ↓</button></div><div v-if="artifacts.length" class="artifact-grid"><details v-for="(artifact, index) in artifacts" :key="`${artifact.title}-${index}`" class="artifact-card" :open="index === artifacts.length - 1"><summary><span>{{ artifact.title }}</span><span aria-hidden="true">⌄</span></summary><pre>{{ artifact.text }}</pre></details></div><p v-else class="section-description">Докази виконаних дій збережено в журналі проходження.</p><div class="reflection-card"><span class="section-kicker">МОЯ РЕФЛЕКСІЯ</span><p>{{ result.reflection }}</p></div></section>
    <div class="bottom-actions"><button type="button" class="secondary-button" @click="emit('back')">← До опису методики</button><button type="button" class="primary-button" @click="emit('home')">Обрати іншу майстерню ↗</button></div>
  </section>
</template>

<style scoped>
.authored-skill{font-size:11px;color:var(--soft);line-height:1.6;display:block}
.results-shell{--surface:var(--panel,#151c2b);--border:var(--line,#293349);--ink:var(--text,#f3f6ff);--soft:var(--muted,#a1acc3);width:min(1250px,calc(100% - 48px));margin:0 auto;padding:28px 0 80px;color:var(--ink)}button{font:inherit;cursor:pointer}.results-topline,.review-heading{display:flex;align-items:center;justify-content:space-between;gap:18px}.text-button{border:0;background:none;color:#c4cee1;padding:9px 0;font-weight:600}.results-module,.eyebrow,.section-kicker,.stat-label{font-size:10px;letter-spacing:.13em;font-weight:800}.results-module{color:#828ea8;text-align:right}.results-heading{margin:38px 0 28px}.eyebrow{color:var(--method-accent)}.results-heading h1{font-size:clamp(2rem,4vw,3.3rem);letter-spacing:-.055em;margin:13px 0}.results-heading h1 span{color:var(--method-accent)}.results-heading p{color:var(--soft);line-height:1.6}.result-hero{display:grid;grid-template-columns:215px minmax(0,1fr);align-items:center;gap:40px;padding:36px 42px;border:1px solid color-mix(in srgb,var(--method-accent) 27%,var(--border));border-radius:24px;background:radial-gradient(circle at 15% 50%,color-mix(in srgb,var(--method-accent) 15%,transparent),transparent 34%),var(--surface)}.score-ring{width:205px;height:205px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--method-accent) var(--score),#ffffff15 0);transform:rotate(-90deg)}.ring-inner{width:175px;height:175px;border-radius:50%;background:#121a29;display:flex;align-items:center;justify-content:center;flex-direction:column;transform:rotate(90deg)}.ring-inner strong{font-size:4rem;letter-spacing:-.08em;line-height:1}.ring-inner strong span{font-size:1.7rem;color:var(--method-accent)}.ring-inner small{color:#8b99b4;font-size:9px;font-weight:800;letter-spacing:.08em;margin-top:13px}.status-badge{display:inline-block;color:#8ff0cb;background:rgba(92,220,174,.1);border:1px solid rgba(92,220,174,.24);border-radius:30px;padding:8px 12px;font-size:12px;font-weight:800}.status-badge--review{color:#ffcd9b;background:rgba(255,185,121,.1);border-color:rgba(255,185,121,.25)}.hero-copy h2{font-size:clamp(1.6rem,2.4vw,2.3rem);line-height:1.18;letter-spacing:-.04em;margin:18px 0 12px}.hero-copy p,.assessment-note,.section-description,.learning-note{color:var(--soft);line-height:1.65;font-size:13px}.hero-copy p{margin-bottom:23px}.hero-actions,.bottom-actions{display:flex;gap:10px;flex-wrap:wrap}.primary-button,.secondary-button{min-height:43px;border-radius:10px;padding:11px 15px;font-size:13px;font-weight:800}.primary-button{border:1px solid transparent;background:var(--method-accent);color:#07111c}.secondary-button{border:1px solid var(--border);background:#ffffff08;color:#d0d9ea}.primary-button:hover,.secondary-button:hover{filter:brightness(1.15)}.assessment-note{padding:16px 18px;border-left:3px solid var(--method-accent);background:#ffffff06;border-radius:0 10px 10px 0;margin:18px 0}.stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.stat-card,.breakdown-card,.review-section,.portfolio-section{border:1px solid var(--border);background:var(--surface);border-radius:18px}.stat-card{padding:22px;display:flex;flex-direction:column}.stat-label{color:#8290aa;margin-bottom:18px}.stat-card strong{font-size:30px;letter-spacing:-.05em}.stat-card strong small{font-size:16px;color:#8290aa}.stat-caption{font-size:12px;color:#8290aa;margin-top:7px}.breakdown-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:20px}.breakdown-card{padding:24px}.section-kicker{color:#7e8ca6}.breakdown-card h2,.review-heading h2{font-size:21px;letter-spacing:-.03em;margin:6px 0 0}.bar-list{display:grid;gap:19px;margin-top:23px}.bar-copy{display:flex;justify-content:space-between;gap:12px;margin-bottom:9px;font-size:13px;color:#c8d3e7}.bar-copy strong{white-space:nowrap}.bar-track{height:7px;border-radius:7px;background:#ffffff14;overflow:hidden}.bar-track span{display:block;height:100%;border-radius:7px;background:var(--method-accent)}.learning-note{margin:18px 0}.rubric-modes{display:grid;grid-template-columns:1fr 1fr;gap:15px;border-top:1px solid var(--border);padding-top:18px}.rubric-modes strong,.rubric-modes span{display:block}.rubric-modes strong{font-size:21px;color:var(--method-accent)}.rubric-modes span{font-size:11px;line-height:1.5;color:var(--soft);margin-top:5px}.review-section,.portfolio-section{margin-top:20px;padding:26px}.review-count{font-size:11px;color:var(--soft);white-space:nowrap}.review-list{display:grid;gap:10px;margin-top:19px}.review-item,.artifact-card{border:1px solid var(--border);border-radius:11px;overflow:hidden;background:#10192b}.review-item summary,.artifact-card summary{cursor:pointer;display:flex;align-items:center;gap:13px;padding:16px;list-style:none}.review-item summary::-webkit-details-marker,.artifact-card summary::-webkit-details-marker{display:none}.review-number{width:29px;height:29px;display:grid;place-items:center;flex:none;border-radius:7px;background:color-mix(in srgb,var(--method-accent) 15%,transparent);color:var(--method-accent);font-size:11px;font-weight:800}.review-prompt{flex:1;font-size:13px;font-weight:700;line-height:1.45}.review-prompt small{display:block;font-size:11px;color:var(--soft);margin-top:3px;font-weight:400}.record-status{font-size:11px;color:var(--method-accent);white-space:nowrap}.review-detail{padding:0 18px 20px;border-top:1px solid var(--border)}.record-summary{font-size:13px;line-height:1.7;white-space:pre-line;color:#d0dbed}.support-info{font-size:11px;line-height:1.6;color:var(--soft)}.criteria-list{list-style:none;display:grid;gap:12px;padding:0;margin:20px 0 0}.criteria-list li{display:flex;gap:10px;align-items:flex-start}.criterion-mark{color:#ffcc9b;width:18px;flex:none;padding-top:1px}.criterion--met .criterion-mark{color:#8ff0cb}.criteria-list strong{font-size:12px;font-weight:700}.criterion-mode{display:inline-block;margin-left:8px;color:#96a7c4;font-size:10px;border:1px solid #ffffff16;border-radius:4px;padding:2px 5px}.criteria-list p{font-size:12px;color:var(--soft);line-height:1.65;margin:5px 0 0}.artifact-grid{display:grid;gap:10px;margin-top:23px}.artifact-card summary{justify-content:space-between;font-size:13px;font-weight:700;color:#d8e2f5}.artifact-card pre{margin:0;border-top:1px solid var(--border);padding:19px;font:inherit;font-size:13px;line-height:1.75;white-space:pre-wrap;overflow-wrap:anywhere;color:#bbcce4}.reflection-card{margin-top:18px;background:color-mix(in srgb,var(--method-accent) 8%,transparent);border:1px solid color-mix(in srgb,var(--method-accent) 22%,transparent);border-radius:11px;padding:20px}.reflection-card p{font-size:13px;line-height:1.75;color:#d4ddee;white-space:pre-wrap;overflow-wrap:anywhere;margin:9px 0 0}.bottom-actions{justify-content:space-between;margin-top:26px}button:focus-visible,summary:focus-visible{outline:2px solid var(--method-accent);outline-offset:3px}@media(max-width:850px){.result-hero{grid-template-columns:1fr;text-align:center;padding:30px}.score-ring{margin:auto}.hero-actions{justify-content:center}.breakdown-grid{grid-template-columns:1fr}}@media(max-width:600px){.results-shell{width:calc(100% - 24px);padding-top:15px}.results-module{display:none}.stat-grid{grid-template-columns:1fr}.stat-card{padding:18px}.stat-label{margin-bottom:10px}.review-section,.portfolio-section,.breakdown-card{padding:18px}.review-heading{align-items:flex-start;flex-wrap:wrap}.review-item summary{gap:9px;padding:13px}.criterion-mode{margin:5px 0 0;display:block;width:fit-content}.bottom-actions>button{width:100%}.result-hero{padding:25px 19px}.results-heading{margin-top:25px}}
</style>

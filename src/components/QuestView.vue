<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Method } from '../data/methods'
import { getInteractiveQuest, type Activity, type ActivityDraft, type ActivityRecord, type InteractiveResult } from '../data/activities'
import { emptyDraft, evaluateActivity } from '../data/assessment'
import { buildInteractiveResult, nextMasteryActivity, selectAdaptiveNext } from '../data/quest-flow'
import ActivityWorkbench from './ActivityWorkbench.vue'

const props = defineProps<{ method: Method; profileId?: string }>()
const emit = defineEmits<{ back: []; finish: [result: InteractiveResult] }>()
const quest = computed(() => getInteractiveQuest(props.method.id))
const bank = computed(() => [...quest.value.activities, ...(quest.value.verification ?? [])])
const sequence = ref<string[]>([])
const index = ref(0), unlocked = ref(0)
const drafts = ref<Record<string, ActivityDraft>>({})
const records = ref<Record<string, ActivityRecord>>({})
const hints = ref<Record<string, number>>({}), retries = ref<Record<string, number>>({})
const reflection = ref(''), reflectionOpen = ref(false), validation = ref(''), storageWarning = ref(false), elapsed = ref(0)
const heading = ref<HTMLHeadingElement>()
let baseElapsed = 0, startedAt = Date.now(), initialized = false, finishing = false
let timer: ReturnType<typeof setInterval> | undefined
const activity = computed(() => bank.value.find(item => item.id === sequence.value[index.value]))
const draft = computed(() => activity.value ? drafts.value[activity.value.id] ?? emptyDraft() : emptyDraft())
const response = computed(() => activity.value ? records.value[activity.value.id] : undefined)
const activeRecords = computed(() => sequence.value.flatMap(id => records.value[id] ? [records.value[id]!] : []))
const performed = computed(() => activeRecords.value.length)
const isMasteryPractice = computed(() => quest.value.mode === 'mastery' && quest.value.activities.some(item => item.id === activity.value?.id))
const isMasteryVerification = computed(() => quest.value.mode === 'mastery' && quest.value.verification?.some(item => item.id === activity.value?.id))
const allAutomaticMet = (record: ActivityRecord) => record.criteria.filter(item => item.mode === 'automatic').every(item => item.met)
const canContinue = computed(() => activity.value?.kind === 'briefing' || Boolean(response.value && (!isMasteryPractice.value || allAutomaticMet(response.value))))
const hintLimit = computed(() => activity.value?.support === 'none' ? 0 : activity.value?.support === 'fading' ? Math.min(2, activity.value.hints?.length ?? 0) : activity.value?.hints?.length ?? 0)
const hintCount = computed(() => hints.value[activity.value?.id ?? ''] ?? 0)
const lastRecord = computed(() => sequence.value.slice(0, index.value).reverse().map(id => records.value[id]).find(Boolean))
const sources = computed(() => props.method.sources.filter(source => source.url.includes('consumer.ftc.gov')))
const progressPercent = computed(() => Math.min(100, Math.round(performed.value / quest.value.targetCount * 100)))
const pendingEarlier = computed(() => sequence.value.findIndex(id => bank.value.some(item => item.id === id && item.kind !== 'briefing') && !records.value[id]))
const kinds: Record<Activity['kind'], string> = { classify:'Сортування', evidence:'Докази', simulation:'Симуляція', map:'Карта зв’язків', review:'Аудит плану', compose:'Майстерня рішень', briefing:'Орієнтир', triage:'Робоча пошта' }
const key = () => `edulab.quest.interactive.v2.${props.profileId || 'local'}.${props.method.id}`

function save() {
  if (!initialized || finishing) return
  try { localStorage.setItem(key(), JSON.stringify({ sequence:sequence.value, index:index.value, unlocked:unlocked.value, drafts:drafts.value, records:records.value, hints:hints.value, retries:retries.value, reflection:reflection.value, reflectionOpen:reflectionOpen.value, elapsed:elapsed.value })) }
  catch { storageWarning.value = true }
}
function restore() {
  const initial = quest.value.mode === 'adaptive' ? [quest.value.activities.find(item => item.difficulty === 'medium') ?? quest.value.activities[0]!] : quest.value.mode === 'mastery' ? [quest.value.activities[0]!] : quest.value.activities
  sequence.value = initial.map(item => item.id)
  index.value = 0; unlocked.value = 0; drafts.value = {}; records.value = {}; hints.value = {}; retries.value = {}; reflection.value = ''; reflectionOpen.value = false; elapsed.value = 0
  try {
    const raw = localStorage.getItem(key())
    if (raw) {
      const saved = JSON.parse(raw)
      if (Array.isArray(saved.sequence) && saved.sequence.length && new Set(saved.sequence).size === saved.sequence.length && saved.sequence.every((id: unknown) => typeof id === 'string' && bank.value.some(item => item.id === id))) {
        sequence.value = saved.sequence
        unlocked.value = Math.min(sequence.value.length - 1, Math.max(0, Number(saved.unlocked) || 0))
        index.value = Math.min(unlocked.value, Math.max(0, Number(saved.index) || 0))
        if (saved.drafts && typeof saved.drafts === 'object') drafts.value = saved.drafts
        if (saved.records && typeof saved.records === 'object') records.value = saved.records
        if (saved.hints && typeof saved.hints === 'object') hints.value = saved.hints
        if (saved.retries && typeof saved.retries === 'object') retries.value = saved.retries
        reflection.value = typeof saved.reflection === 'string' ? saved.reflection : ''
        reflectionOpen.value = saved.reflectionOpen === true
        elapsed.value = Math.max(0, Number(saved.elapsed) || 0)
      }
    }
  } catch { storageWarning.value = true }
  baseElapsed = elapsed.value; startedAt = Date.now(); initialized = true
}
watch(() => [props.method.id, props.profileId], () => { initialized = false; restore() }, { immediate:true })
watch([sequence,index,unlocked,drafts,records,hints,retries,reflection,reflectionOpen], save, { deep:true })
onMounted(() => { timer = setInterval(() => { elapsed.value = baseElapsed + Math.floor((Date.now() - startedAt) / 1000); if (elapsed.value % 10 === 0) save() }, 1000) })
onUnmounted(() => { if (timer) clearInterval(timer); save() })
function updateDraft(value: ActivityDraft) { if (activity.value && !response.value) { drafts.value = { ...drafts.value, [activity.value.id]:value }; validation.value = '' } }
function showHint() { if (activity.value && hintCount.value < hintLimit.value) hints.value = { ...hints.value, [activity.value.id]:hintCount.value + 1 } }
function submit() {
  const item = activity.value
  if (!item || response.value) return
  const evaluation = evaluateActivity(item,draft.value)
  if (!evaluation.ready) { validation.value = evaluation.summary; return }
  records.value = { ...records.value, [item.id]: { activityId:item.id, title:item.title, stage:item.stage, kind:item.kind, skill:item.skill, criteria:evaluation.criteria, summary:evaluation.summary, artifact:evaluation.artifact, hintsUsed:hintCount.value, retries:retries.value[item.id] ?? 0, independent:hintCount.value === 0 && !(retries.value[item.id]), difficulty:item.difficulty } }
  validation.value = ''
}
function retry() {
  if (!activity.value || isMasteryVerification.value) return
  const id = activity.value.id, prior = draft.value
  retries.value = { ...retries.value, [id]:(retries.value[id] ?? 0) + 1 }
  const next = { ...records.value }; delete next[id]; records.value = next
  drafts.value = { ...drafts.value, [id]: { ...prior, actions:[], links:[], selectedEvidence:[], flagged:[], classification:{}, triage:{}, checks:[] } }
  validation.value = ''
}
async function focusStep() { await nextTick(); heading.value?.focus(); heading.value?.scrollIntoView({behavior:'smooth',block:'start'}) }
async function advance() {
  if (!canContinue.value) return
  if (index.value === sequence.value.length - 1 && pendingEarlier.value !== -1) { index.value = pendingEarlier.value; validation.value = 'Завершіть цей переглянутий крок, щоб зберегти повне портфоліо місії.'; await focusStep(); return }
  if (index.value < sequence.value.length - 1) index.value++
  else if (quest.value.mode === 'mastery') { const next = nextMasteryActivity(quest.value,activity.value!.id); if (next) { sequence.value = [...sequence.value,next.id]; index.value++ } else reflectionOpen.value = true }
  else if (quest.value.mode === 'adaptive' && sequence.value.length < quest.value.targetCount) { const next = selectAdaptiveNext(quest.value,sequence.value,records.value,activity.value!.id); if (next) { sequence.value = [...sequence.value,next.id]; index.value++ } else reflectionOpen.value = true }
  else reflectionOpen.value = true
  unlocked.value = Math.max(unlocked.value,index.value); validation.value = ''; await focusStep()
}
async function navigate(position: number) { if (position <= unlocked.value) { index.value = position; reflectionOpen.value = false; validation.value = ''; await focusStep() } }
function finish() {
  if (pendingEarlier.value !== -1) { reflectionOpen.value = false; index.value = pendingEarlier.value; validation.value = 'Завершіть цей переглянутий крок перед збереженням результату.'; void focusStep(); return }
  if (reflection.value.trim().length < 40) { validation.value = 'Опишіть висновок щонайменше 40 символами: що ви змінили у своїх діях і як застосуєте це під час практики.'; return }
  finishing = true
  try { localStorage.removeItem(key()) } catch { storageWarning.value = true }
  emit('finish',buildInteractiveResult({quest:quest.value,records:activeRecords.value,reflection:reflection.value.trim(),elapsedSeconds:elapsed.value}))
}
function formatTime(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}` }
</script>

<template>
  <section class="quest-shell" :style="{'--accent':method.accent}">
    <div class="quest-top"><button class="text-button" type="button" @click="emit('back')">← До методики</button><span>ПРАКТИЧНА МІСІЯ · {{ quest.subtitle }}</span><strong>{{ formatTime(elapsed) }}</strong></div>
    <header class="quest-hero"><span class="eyebrow">{{ quest.tool }}</span><h1>{{ quest.title }}</h1><p>{{ quest.mission }}</p><div class="mission-brief"><span aria-hidden="true">◈</span><div><strong>Ваша роль і ситуація</strong><p>{{ quest.briefing }}</p></div></div></header>
    <div class="quest-layout">
      <main class="workspace">
        <section v-if="reflectionOpen" class="reflection-panel">
          <span class="eyebrow">ФІНАЛ · ПЕРЕНЕСЕННЯ В ПРАКТИКУ</span><h2 ref="heading" tabindex="-1">Що ви заберете на робоче місце?</h2><p>{{ quest.learningOutcome }}</p>
          <label for="quest-reflection">Яку помилку вдалося виправити? Якою буде ваша перша дія в подібній ситуації під час виробничої практики?</label><textarea id="quest-reflection" v-model="reflection" rows="5" maxlength="2500" placeholder="Поясніть власними словами та наведіть приклад…"></textarea><small>{{ reflection.trim().length }} / 40 символів мінімум</small>
          <div class="portfolio-preview"><strong>Ваше портфоліо місії</strong><p>{{ performed }} виконаних діяльностей · {{ activeRecords.filter(record => record.artifact).length }} записів із рішеннями. Власні тексти можна буде завантажити й обговорити з викладачем.</p></div>
          <p v-if="validation" class="validation" role="alert">{{ validation }}</p><div class="step-actions"><button class="secondary" type="button" @click="reflectionOpen = false">← Переглянути останній крок</button><button class="primary" type="button" @click="finish">Зберегти результат і портфоліо ↗</button></div>
        </section>
        <template v-else-if="activity">
          <div class="activity-heading"><div><span class="eyebrow">{{ activity.stage }} · {{ kinds[activity.kind] }}</span><h2 ref="heading" tabindex="-1">{{ activity.title }}</h2><p>{{ activity.objective }}</p></div><span class="level-pill" v-if="activity.difficulty">{{ {easy:'Базовий випадок',medium:'Робоча ситуація',hard:'Складний інцидент'}[activity.difficulty] }}</span></div><p class="activity-brief">{{ activity.briefing }}</p>
          <div v-if="activity.kind === 'briefing' && activity.reflectPrevious && lastRecord" class="debrief"><strong>Розбір вашої попередньої дії</strong><p>{{ lastRecord.summary }}</p><ul><li v-for="criterion in lastRecord.criteria" :key="criterion.id">{{ criterion.met ? '✓' : '↺' }} {{ criterion.label }} — {{ criterion.detail }}</li></ul></div>
          <ActivityWorkbench :key="activity.id" :activity="activity" :draft="draft" :locked="Boolean(response)" @update="updateDraft" />
          <div v-if="quest.mode === 'zpd' || hintLimit" class="mentor-box"><div><span aria-hidden="true">✧</span><strong>{{ hintLimit ? 'Підтримка наставника' : 'Самостійний випадок' }}</strong><small>{{ hintLimit ? `${hintCount} / ${hintLimit} опор використано` : 'Застосуйте власний спосіб перевірки' }}</small></div><button v-if="hintLimit" class="secondary" type="button" :disabled="hintCount >= hintLimit || Boolean(response)" @click="showHint">{{ hintCount ? 'Наступна опора' : 'Отримати опору' }}</button><p v-for="(hint,i) in activity.hints?.slice(0,hintCount)" :key="i">{{ i + 1 }}. {{ hint }}</p></div>
          <section v-if="response" class="evaluation" aria-live="polite"><div class="evaluation-head"><span aria-hidden="true">{{ allAutomaticMet(response) ? '✓' : '↺' }}</span><strong>{{ allAutomaticMet(response) ? 'Дії розібрано' : 'Є кроки для вдосконалення' }}</strong></div><p>{{ response.summary }}</p><ul class="criterion-list"><li v-for="criterion in response.criteria" :key="criterion.id" :class="{met:criterion.met}"><span>{{ criterion.met ? '✓' : '↺' }}</span><div><strong>{{ criterion.label }}</strong><p>{{ criterion.detail }}</p><small v-if="criterion.mode === 'self'">Авторський текст / самооцінка · для обговорення з викладачем</small></div></li></ul><p v-if="isMasteryPractice && !allAutomaticMet(response)" class="correction">{{ activity.feedback }} Виправте практичні дії перед новим перевірочним випадком.</p></section>
          <p v-if="isMasteryVerification && response" class="verification-note">Це новий перевірочний випадок. Перша самостійна дія збережена; якщо залишилися прогалини, поверніться до тренування в новому проходженні.</p>
          <p v-if="validation" class="validation" role="alert">{{ validation }}</p><div class="step-actions"><button class="secondary" type="button" :disabled="index === 0" @click="navigate(index - 1)">← Назад</button><div><button v-if="response && !isMasteryVerification" class="secondary" type="button" @click="retry">Переробити дії</button><button v-if="activity.kind !== 'briefing' && !response" class="primary" type="button" @click="submit">Розібрати моє рішення ↗</button><button v-else class="primary" type="button" :disabled="!canContinue" @click="advance">{{ index < sequence.length - 1 || quest.mode === 'adaptive' && performed < quest.targetCount || quest.mode === 'mastery' && nextMasteryActivity(quest,activity.id) ? 'Далі за маршрутом →' : 'До рефлексії →' }}</button></div></div>
        </template>
      </main>
      <aside class="quest-sidebar"><section class="route-card"><span class="eyebrow">ВАШ МАРШРУТ</span><div class="route-count"><strong>{{ performed }}</strong><span>/ {{ quest.targetCount }} діяльностей</span></div><div class="progress-track"><span :style="{width:`${progressPercent}%`}"></span></div><p>{{ quest.strategy }}</p><nav aria-label="Кроки місії"><button v-for="(id,position) in sequence" :key="id" type="button" :disabled="position > unlocked" :class="{active:position === index && !reflectionOpen,done:records[id] || position < unlocked}" @click="navigate(position)"><span>{{ records[id] || position < unlocked ? '✓' : String(position + 1).padStart(2,'0') }}</span><div>{{ bank.find(item => item.id === id)?.title }}<small>{{ kinds[bank.find(item => item.id === id)?.kind ?? 'briefing'] }}</small></div></button></nav></section>
        <details class="resource-card"><summary>↗ Джерела для розслідування</summary><p>Зіставте свій висновок із рекомендаціями. Сценарії та адреси в майстерні навчальні.</p><a v-for="source in sources" :key="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.label }} ↗</a><p class="resource-note">Ціль: {{ quest.learningOutcome }}</p></details><p class="save-note" :class="{warning:storageWarning}" role="status">{{ storageWarning ? 'Браузер не зберіг чернетку. Завершіть місію, щоб отримати портфоліо.' : 'Дії та власні тексти зберігаються для цього профілю в цьому браузері. Місію можна продовжити пізніше.' }}</p>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.verification-note{font-size:11px;color:#a5bbd9;line-height:1.7;border-left:2px solid var(--accent);padding-left:13px;margin-top:19px}
.quest-shell{width:min(1320px,calc(100% - 44px));margin:auto;padding:24px 0 80px;color:var(--text,#edf2fb)}.quest-top{display:flex;align-items:center;gap:20px;color:#8c9cb5;font-size:11px}.quest-top>span{flex:1;text-align:right;letter-spacing:.1em}.quest-top>strong{font-variant-numeric:tabular-nums;font-size:13px;border:1px solid #344159;border-radius:7px;padding:7px 10px}.text-button{border:0;background:none;color:#c9d5e7;padding:7px 0;font:inherit;cursor:pointer}.quest-hero{max-width:960px;padding:33px 0 28px}.eyebrow{color:var(--accent);font-size:10px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}.quest-hero h1{font-size:clamp(30px,3.8vw,49px);letter-spacing:-.05em;line-height:1.12;margin:13px 0 15px}.quest-hero>p{color:#b6c3d8;font-size:15px;line-height:1.65;margin-bottom:22px}.mission-brief{display:flex;gap:15px;padding:18px 21px;border:1px solid color-mix(in srgb,var(--accent) 28%,#27334a);background:color-mix(in srgb,var(--accent) 7%,#131e30);border-radius:13px}.mission-brief>span{color:var(--accent);font-size:25px}.mission-brief strong{font-size:12px}.mission-brief p{font-size:13px;color:#adbed6;line-height:1.65;margin:6px 0 0}.quest-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:22px;align-items:start}.workspace{padding:28px;border:1px solid #2e3a50;border-radius:18px;background:#141e2e;min-width:0;box-shadow:0 15px 45px #0002}.activity-heading{display:flex;gap:15px;justify-content:space-between;align-items:start}.activity-heading h2,.reflection-panel h2{font-size:25px;line-height:1.25;letter-spacing:-.03em;margin:10px 0}.activity-heading p,.activity-brief,.reflection-panel>p{color:#aebdd3;font-size:13px;line-height:1.65}.activity-heading p{margin:0}.activity-brief{margin:17px 0 24px;padding-bottom:22px;border-bottom:1px solid #2b374b}.level-pill{flex:none;padding:7px 9px;border:1px solid #3a4962;border-radius:6px;font-size:9px;color:#aebfd8;white-space:nowrap}.quest-sidebar{display:grid;gap:15px}.route-card,.resource-card{border:1px solid #2e3a50;border-radius:16px;padding:20px;background:#141e2e}.route-count{display:flex;gap:10px;align-items:baseline;margin:13px 0}.route-count strong{font-size:36px}.route-count>span{font-size:11px;color:#8fa1bd}.progress-track{height:5px;background:#2a3850;border-radius:9px;overflow:hidden}.progress-track span{height:100%;display:block;background:var(--accent);transition:width .3s}.route-card>p{font-size:11px;color:#98abc6;line-height:1.7;margin:16px 0}.route-card nav{display:grid;gap:7px}.route-card nav button{display:flex;gap:9px;text-align:left;padding:10px 9px;border:1px solid transparent;border-radius:8px;background:#1a283c;color:#c6d4e7;font:inherit;font-size:11px;cursor:pointer;align-items:start}.route-card nav button>span{flex:none;display:grid;place-items:center;height:22px;width:22px;background:#2c3b51;border-radius:6px;font-size:10px}.route-card nav button small{display:block;color:#869bb9;font-size:9px;margin-top:4px}.route-card nav button.active{border-color:var(--accent)}.route-card nav button.done>span{background:color-mix(in srgb,var(--accent) 25%,#1c2d3c);color:var(--accent)}.route-card nav button:disabled{opacity:.45;cursor:default}.resource-card summary{font-size:12px;font-weight:700;cursor:pointer;color:#c5d3e9}.resource-card p{font-size:11px;line-height:1.65;color:#93a7c4}.resource-card a{display:block;font-size:11px;color:var(--accent);padding:8px 0;line-height:1.5;text-decoration:underline;text-underline-offset:3px}.resource-note{border-top:1px solid #2e3a50;padding-top:12px}.save-note{font-size:10px;line-height:1.7;color:#8196b5;padding:0 8px}.warning,.validation{color:#ffd09d}.mentor-box{border:1px dashed #55647e;border-radius:11px;margin-top:20px;padding:17px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:#1a273b}.mentor-box>div{flex:1;min-width:150px}.mentor-box strong{font-size:12px}.mentor-box>div>span{color:var(--accent);margin-right:9px}.mentor-box small{display:block;color:#94a8c5;font-size:10px;margin:6px 0 0 24px}.mentor-box p{width:100%;font-size:12px;line-height:1.6;color:#c4d3e8;margin:4px 0}.evaluation,.debrief{padding:20px;background:#192b36;border:1px solid #36534f;border-radius:13px;margin-top:22px}.evaluation-head{display:flex;gap:10px;color:#a0e4c8;font-size:14px}.evaluation>p,.debrief p,.debrief li{font-size:12px;line-height:1.6;color:#bbccdd}.criterion-list{padding:0;margin:16px 0 0;display:grid;gap:10px;list-style:none}.criterion-list li{display:flex;gap:10px;color:#ffce9e;padding:11px;background:#122330;border-radius:8px}.criterion-list li.met{color:#8cddbb}.criterion-list strong{font-size:11px}.criterion-list p{font-size:11px;color:#a9bbd1;line-height:1.55;margin:4px 0}.criterion-list small{font-size:9px;color:#9faed0}.correction{color:#ffd49d!important}.step-actions{display:flex;justify-content:space-between;gap:12px;margin-top:25px;flex-wrap:wrap}.step-actions>div{display:flex;gap:10px;flex-wrap:wrap}.primary,.secondary{border-radius:9px;padding:11px 14px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;min-height:42px}.primary{background:var(--accent);color:#0a1627;border:1px solid var(--accent)}.secondary{background:#1d2b40;color:#c6d5e9;border:1px solid #3d4c65}button:disabled{opacity:.45;cursor:default}button:focus-visible,summary:focus-visible,a:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:3px}h2:focus{outline:none}.validation{font-size:12px;line-height:1.6;margin-top:20px}.reflection-panel label{display:block;font-size:13px;line-height:1.65;color:#c7d5e7;margin:25px 0 12px}.reflection-panel textarea{width:100%;box-sizing:border-box;resize:vertical;border:1px solid #485b78;background:#101b2c;color:#edf2fb;border-radius:10px;padding:15px;font:inherit;font-size:14px;line-height:1.7}.reflection-panel>small{display:block;font-size:10px;color:#8298b8;margin-top:8px}.portfolio-preview{padding:18px;background:#202c43;border-radius:10px;margin-top:22px;font-size:13px}.portfolio-preview p{color:#a4b6ce;line-height:1.7;font-size:12px;margin-bottom:0}@media(max-width:1100px){.quest-layout{grid-template-columns:minmax(0,1fr) 245px}.workspace{padding:22px}.route-card{padding:16px}}@media(max-width:900px){.quest-layout{grid-template-columns:1fr}.quest-sidebar{grid-template-columns:1fr 1fr}.route-card nav{max-height:230px;overflow:auto}.save-note{grid-column:1/-1}.quest-top>span{display:none}.quest-top{justify-content:space-between}.activity-heading{flex-wrap:wrap}}@media(max-width:560px){.quest-shell{width:calc(100% - 24px);padding-top:12px}.workspace{padding:18px 14px}.quest-sidebar{grid-template-columns:1fr}.activity-heading h2{font-size:22px}.quest-hero h1{font-size:32px}.mission-brief{padding:14px}.step-actions>div{width:100%}.step-actions button{flex:1}.quest-hero{padding-top:24px}.evaluation{padding:14px}}@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
</style>

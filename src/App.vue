<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { methods } from './data/methods'
import LessonView from './components/LessonView.vue'
import QuizView from './components/QuizView.vue'
import ResultsView from './components/ResultsView.vue'
import MethodCard from './components/MethodCard.vue'
import UiIcon from './components/UiIcon.vue'

type Attempt = {
  methodId: string
  completedAt: string
  elapsedSeconds: number
  correctCount: number
  total: number
  score: number
  answers: unknown[]
  bySkill: Record<string, { correct: number; total: number }>
  byType?: Record<string, { correct: number; total: number }>
}
type Progress = { visited: boolean; attempts: number; bestScore: number | null; lastAttempt: Attempt | null }
type Route = { kind: 'home' | 'lesson' | 'quiz' | 'results'; id?: string }

const STORAGE_KEY = 'edulab.progress.v1'
const route = ref<Route>({ kind: 'home' })
const search = ref('')
const activeCategory = ref('Усі')
const progress = ref<Record<string, Progress>>({})
const mobileMenuOpen = ref(false)
const pendingSection = ref<string | null>(null)
const menuTrigger = ref<HTMLButtonElement | null>(null)
const menuClose = ref<HTMLButtonElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

const categories = computed(() => ['Усі', ...new Set(methods.map((method) => method.category))])
const filteredMethods = computed(() => methods.filter((method) => {
  const categoryMatch = activeCategory.value === 'Усі' || method.category === activeCategory.value
  const query = search.value.trim().toLocaleLowerCase('uk')
  const searchMatch = !query || [method.title, method.author, method.summary, method.category]
    .some((value) => value.toLocaleLowerCase('uk').includes(query))
  return categoryMatch && searchMatch
}))
const currentMethod = computed(() => methods.find((method) => method.id === route.value.id))
const currentProgress = computed(() => route.value.id ? progress.value[route.value.id] : undefined)
const completedCount = computed(() => methods.filter((method) => (progress.value[method.id]?.bestScore ?? -1) >= 70).length)
const startedCount = computed(() => methods.filter((method) => progress.value[method.id]?.visited).length)
const totalQuestions = computed(() => methods.reduce((sum, method) => sum + method.quiz.length, 0))
const overallPercent = computed(() => Math.round((completedCount.value / methods.length) * 100))

function loadProgress() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) progress.value = JSON.parse(stored)
  } catch {
    progress.value = {}
  }
}
function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress.value)) } catch { /* Browser storage can be unavailable. */ }
}
function syncRoute() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const kind = parts[0]
  const id = parts[1]
  const selectedMethod = methods.find((method) => method.id === id)
  if ((kind === 'method' || kind === 'quiz' || kind === 'results') && selectedMethod) {
    route.value = { kind: kind === 'method' ? 'lesson' : kind, id }
    if (kind === 'method' && id) {
      const existing = progress.value[id] ?? { visited: false, attempts: 0, bestScore: null, lastAttempt: null }
      if (!existing.visited) { progress.value[id] = { ...existing, visited: true }; saveProgress() }
    }
  } else route.value = { kind: 'home' }
  document.title = selectedMethod && route.value.kind !== 'home'
    ? `${selectedMethod.title} — EDU.LAB`
    : 'EDU.LAB — педагогічні алгоритми та методики'
  mobileMenuOpen.value = false
  if (pendingSection.value) {
    const section = pendingSection.value
    pendingSection.value = null
    nextTick(() => document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' }))
  } else window.scrollTo({ top: 0, behavior: 'smooth' })
}
function navigate(path: string) {
  const next = `#/${path.replace(/^\//, '')}`
  if (window.location.hash === next) syncRoute()
  else window.location.hash = next
}
function openCatalog() {
  pendingSection.value = 'catalog'
  navigate('/')
}
function openProgress() {
  pendingSection.value = 'progress'
  navigate('/')
}
function startLearning() {
  const next = methods.find((method) => !progress.value[method.id]?.visited) ?? methods[0]
  if (next) navigate(`/method/${next.id}`)
}
function finishQuiz(result: Attempt) {
  const existing = progress.value[result.methodId] ?? { visited: true, attempts: 0, bestScore: null, lastAttempt: null }
  progress.value[result.methodId] = { visited: true, attempts: existing.attempts + 1, bestScore: Math.max(existing.bestScore ?? 0, result.score), lastAttempt: result }
  saveProgress()
  navigate(`/results/${result.methodId}`)
}
function openMobileMenu() { mobileMenuOpen.value = true; nextTick(() => menuClose.value?.focus()) }
function closeMobileMenu() { mobileMenuOpen.value = false; nextTick(() => menuTrigger.value?.focus()) }
function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && mobileMenuOpen.value) closeMobileMenu()
  if (event.key === '/' && route.value.kind === 'home' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
    event.preventDefault()
    searchInput.value?.focus()
  }
}
onMounted(() => { loadProgress(); syncRoute(); window.addEventListener('hashchange', syncRoute); window.addEventListener('keydown', onKeyDown) })
onUnmounted(() => { window.removeEventListener('hashchange', syncRoute); window.removeEventListener('keydown', onKeyDown) })
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" :class="{ 'sidebar--open': mobileMenuOpen }">
      <button ref="menuClose" class="mobile-close-button" type="button" aria-label="Закрити меню" @click="closeMobileMenu">×</button>
      <button class="brand" type="button" @click="navigate('/')" aria-label="EDU.LAB — головна"><span class="brand-mark"><span></span><span></span><span></span><span></span></span><span class="brand-copy"><strong>EDU<span>.</span>LAB</strong><small>педагогічні алгоритми</small></span></button>
      <div class="sidebar-group-label">НАВІГАЦІЯ</div>
      <nav class="side-nav" aria-label="Головна навігація">
        <button type="button" class="nav-item" :class="{ 'nav-item--active': route.kind === 'home' }" @click="navigate('/')"><UiIcon name="grid" :size="19" /><span>Огляд</span><span class="nav-active-dot"></span></button>
        <button type="button" class="nav-item" @click="openCatalog"><UiIcon name="layers" :size="19" /><span>Каталог методик</span><span class="nav-count">{{ methods.length }}</span></button>
        <button type="button" class="nav-item" @click="openProgress"><UiIcon name="chart" :size="19" /><span>Мій прогрес</span></button>
      </nav>
      <div class="sidebar-group-label sidebar-group-label--second">НАВЧАННЯ</div>
      <div class="sidebar-methods"><button v-for="method in methods" :key="method.id" type="button" class="sidebar-method" :class="{ 'sidebar-method--active': route.id === method.id }" @click="navigate(`/method/${method.id}`)"><span class="method-tiny-dot" :style="{ background: method.accent }"></span><span>{{ method.shortTitle }}</span><UiIcon v-if="(progress[method.id]?.bestScore ?? 0) >= 70" name="check" :size="14" /></button></div>
      <div class="sidebar-bottom"><div class="sidebar-progress-card"><div class="sidebar-progress-icon"><UiIcon name="sparkle" :size="19" /></div><strong>Ваш навчальний шлях</strong><p>Вивчайте теорію, практикуйтеся та відстежуйте результати.</p><div class="mini-progress-head"><span>Опановано методик</span><b>{{ completedCount }}/{{ methods.length }}</b></div><div class="progress-track"><span :style="{ width: `${overallPercent}%` }"></span></div></div><div class="sidebar-footer"><span class="status-dot"></span> Навчання у вашому браузері</div></div>
    </aside>
    <div v-if="mobileMenuOpen" class="mobile-overlay" aria-hidden="true" @click="closeMobileMenu"></div>
    <div class="workspace">
      <header class="topbar"><div class="topbar-left"><button class="mobile-menu-button" type="button" aria-label="Відкрити меню" @click="mobileMenuOpen = true"><UiIcon name="menu" :size="22" /></button><div class="breadcrumb"><span>EDU.LAB</span><UiIcon name="chevron" :size="14" /><strong>{{ route.kind === 'home' ? 'Огляд' : route.kind === 'lesson' ? 'Вивчення методики' : route.kind === 'quiz' ? 'Практичний тест' : 'Результат' }}</strong></div></div><div class="topbar-right"><label v-if="route.kind === 'home'" class="search-box"><UiIcon name="search" :size="18" /><input ref="searchInput" v-model="search" type="search" placeholder="Пошук методики..." aria-label="Пошук методики" /><kbd>/</kbd></label><span class="topbar-divider"></span><div class="topbar-badge"><span class="badge-icon"><UiIcon name="book" :size="17" /></span><span>Освітня платформа</span></div></div></header>
      <main class="main-content">
        <template v-if="route.kind === 'home'">
          <section class="dashboard-intro"><div><span class="eyebrow"><span class="eyebrow-line"></span> ВІТАЄМО В EDU.LAB</span><h1>Досліджуйте логіку <span>навчання.</span></h1><p>Інтерактивна бібліотека педагогічних методик: від наукової ідеї до впевненого застосування в аудиторії.</p></div><span class="intro-index">01 <span>/</span> {{ String(methods.length).padStart(2, '0') }}</span></section>
          <section class="hero-panel" aria-label="Почати навчання"><div class="hero-grid"></div><div class="hero-glow"></div><div class="hero-content"><span class="hero-kicker"><span class="pulse-dot"></span> ІНТЕРАКТИВНА ОСВІТНЯ ПЛАТФОРМА</span><h2>Теорія, що стає<br /><em>практикою.</em></h2><p>Розбирайте алгоритми крок за кроком, застосовуйте їх у реальних педагогічних ситуаціях і бачте свій прогрес.</p><div class="hero-actions"><button class="btn btn-primary" type="button" @click="startLearning">Почати навчання <UiIcon name="arrow" :size="18" /></button><button class="btn btn-ghost" type="button" @click="openCatalog">Переглянути каталог</button></div></div><div class="hero-art" aria-hidden="true"><div class="orbit orbit-outer"></div><div class="orbit orbit-middle"></div><div class="orbit orbit-inner"></div><div class="art-core"><span class="art-core-top">EDU / 01</span><UiIcon name="sparkle" :size="42" /><span class="art-core-bottom">LEARN · APPLY · GROW</span></div><span class="orbit-node node-one">01</span><span class="orbit-node node-two">02</span><span class="orbit-node node-three">03</span><span class="orbit-label orbit-label-one">ДОСЛІДЖУЙ</span><span class="orbit-label orbit-label-two">ЗАСТОСОВУЙ</span></div></section>
          <section id="progress" class="stats-grid" aria-label="Ваш прогрес"><div class="stat-card"><span class="stat-icon stat-icon--violet"><UiIcon name="layers" :size="21" /></span><div><div class="stat-label">Методик у бібліотеці</div><strong>{{ String(methods.length).padStart(2, '0') }}</strong><small>для глибокого вивчення</small></div><span class="stat-decoration">01</span></div><div class="stat-card"><span class="stat-icon stat-icon--cyan"><UiIcon name="target" :size="21" /></span><div><div class="stat-label">Практичних завдань</div><strong>{{ totalQuestions }}</strong><small>у тематичних тестах</small></div><span class="stat-decoration">02</span></div><div class="stat-card"><span class="stat-icon stat-icon--amber"><UiIcon name="chart" :size="21" /></span><div><div class="stat-label">Ваш прогрес</div><strong>{{ overallPercent }}<span>%</span></strong><small>{{ startedCount }} з {{ methods.length }} методик розпочато</small></div><span class="stat-decoration">03</span></div></section>
          <section id="catalog" class="catalog-section"><div class="section-heading"><div><span class="eyebrow"><span class="eyebrow-line"></span> БІБЛІОТЕКА ЗНАНЬ</span><h2>Каталог методик <span class="section-count">{{ String(filteredMethods.length).padStart(2, '0') }}</span></h2><p>Оберіть концепцію, дослідіть її структуру та перевірте себе на практиці.</p></div><div class="section-aside"><span class="aside-line"></span> ОБИРАЙТЕ СВІЙ ШЛЯХ</div></div><div class="filter-row" role="group" aria-label="Фільтр за категорією"><button v-for="category in categories" :key="category" type="button" class="filter-chip" :class="{ 'filter-chip--active': activeCategory === category }" @click="activeCategory = category">{{ category }}</button></div><div v-if="filteredMethods.length" class="method-grid"><MethodCard v-for="(method, index) in filteredMethods" :key="method.id" :method="method" :index="index" :progress="progress[method.id]" @open="navigate(`/method/${method.id}`)" @quiz="navigate(`/quiz/${method.id}`)" /></div><div v-else class="empty-state"><span><UiIcon name="search" :size="28" /></span><h3>Методик не знайдено</h3><p>Спробуйте інший запит або змініть категорію.</p><button type="button" class="btn btn-secondary" @click="search = ''; activeCategory = 'Усі'">Скинути фільтри</button></div></section>
          <footer class="page-footer"><span>© EDU.LAB · Педагогічні алгоритми</span><span>Навчайтесь у власному темпі <UiIcon name="sparkle" :size="15" /></span></footer>
        </template>
        <LessonView v-else-if="route.kind === 'lesson' && currentMethod" :method="currentMethod" :progress="currentProgress" @back="openCatalog" @quiz="navigate(`/quiz/${currentMethod.id}`)" />
        <QuizView v-else-if="route.kind === 'quiz' && currentMethod" :key="`${currentMethod.id}-${route.kind}`" :method="currentMethod" @back="navigate(`/method/${currentMethod.id}`)" @finish="finishQuiz" />
        <ResultsView v-else-if="route.kind === 'results' && currentMethod && currentProgress?.lastAttempt" :method="currentMethod" :result="currentProgress.lastAttempt" @retry="navigate(`/quiz/${currentMethod.id}`)" @back="navigate(`/method/${currentMethod.id}`)" @home="navigate('/')" />
        <div v-else class="empty-state"><h2>Поки що немає результату</h2><p>Пройдіть тест, щоб побачити свій результат.</p><button type="button" class="btn btn-primary" @click="currentMethod ? navigate(`/quiz/${currentMethod.id}`) : navigate('/')">{{ currentMethod ? 'Почати тест' : 'На головну' }}</button></div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { methods } from './data/methods'
import LessonView from './components/LessonView.vue'
import QuestView from './components/QuestView.vue'
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

type LocalProfile = { id: string; name: string; createdAt: string }
type ProfileStore = { profiles: LocalProfile[]; activeId: string }

const LEGACY_PROGRESS_KEY = 'edulab.progress.v1'
const PROFILES_KEY = 'edulab.profiles.v1'
const PROFILE_PROGRESS_PREFIX = 'edulab.progress.profile.v1.'
const LEGACY_ARCHIVE_PREFIX = 'edulab.progress.archive.v1.'
const route = ref<Route>({ kind: 'home' })
const search = ref('')
const activeCategory = ref('Усі')
const progress = ref<Record<string, Progress>>({})
const profiles = ref<LocalProfile[]>([])
const activeProfileId = ref('')
const newProfileName = ref('')
const profileError = ref('')
const storageWarning = ref(false)
const legacyArchiveAvailable = ref(false)
const sessionProgress = new Map<string, Record<string, Progress>>()
const mobileMenuOpen = ref(false)
const pendingSection = ref<string | null>(null)
const menuTrigger = ref<HTMLButtonElement | null>(null)
const menuClose = ref<HTMLButtonElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

const categories = computed(() => ['Усі', ...new Set(methods.map((method) => method.category))])
const filteredMethods = computed(() => methods.filter((method) => {
  const categoryMatch = activeCategory.value === 'Усі' || method.category === activeCategory.value
  const query = search.value.trim().toLocaleLowerCase('uk')
  const searchMatch = !query || [method.title, method.author, method.summary, method.category, method.quest.topic, method.quest.mission]
    .some((value) => value.toLocaleLowerCase('uk').includes(query))
  return categoryMatch && searchMatch
}))
const currentMethod = computed(() => methods.find((method) => method.id === route.value.id))
const currentProgress = computed(() => route.value.id ? progress.value[route.value.id] : undefined)
const activeProfile = computed(() => profiles.value.find((profile) => profile.id === activeProfileId.value))
const completedCount = computed(() => methods.filter((method) => (progress.value[method.id]?.bestScore ?? -1) >= 70).length)
const startedCount = computed(() => methods.filter((method) => progress.value[method.id]?.visited).length)
const totalQuestions = computed(() => methods.reduce((sum, method) => sum + method.quiz.length, 0))
const overallPercent = computed(() => Math.round((completedCount.value / methods.length) * 100))

function parseProgress(stored: string | null): Record<string, Progress> {
  if (!stored) return {}
  try {
    const parsed: unknown = JSON.parse(stored)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, Progress>
      : {}
  } catch { return {} }
}
function newProfileId() {
  return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
function profileProgressKey(id: string) { return `${PROFILE_PROGRESS_PREFIX}${id}` }
function hasLegacyArchive(id: string) {
  try { return Boolean(localStorage.getItem(`${LEGACY_ARCHIVE_PREFIX}${id}`)) }
  catch { return false }
}
function saveProfileStore() {
  try {
    const store: ProfileStore = { profiles: profiles.value, activeId: activeProfileId.value }
    localStorage.setItem(PROFILES_KEY, JSON.stringify(store))
  } catch { storageWarning.value = true }
}
function loadProfileProgress(id: string): Record<string, Progress> {
  const cached = sessionProgress.get(id)
  if (cached) return cached
  try {
    const loaded = parseProgress(localStorage.getItem(profileProgressKey(id)))
    sessionProgress.set(id, loaded)
    return loaded
  } catch {
    storageWarning.value = true
    return {}
  }
}
function saveProgress() {
  if (!activeProfileId.value) return
  const serialized = JSON.stringify(progress.value)
  sessionProgress.set(activeProfileId.value, JSON.parse(serialized))
  try { localStorage.setItem(profileProgressKey(activeProfileId.value), serialized) }
  catch { storageWarning.value = true }
}
function loadProfiles() {
  try {
    const stored = localStorage.getItem(PROFILES_KEY)
    if (stored) {
      const parsed: unknown = JSON.parse(stored)
      if (parsed && typeof parsed === 'object' && 'profiles' in parsed && Array.isArray(parsed.profiles)) {
        const validProfiles = parsed.profiles.filter((item: unknown): item is LocalProfile =>
          Boolean(item && typeof item === 'object' && 'id' in item && typeof item.id === 'string'
            && 'name' in item && typeof item.name === 'string'))
        if (validProfiles.length) {
          profiles.value = validProfiles
          const savedId = 'activeId' in parsed && typeof parsed.activeId === 'string' ? parsed.activeId : ''
          activeProfileId.value = validProfiles.some((item) => item.id === savedId) ? savedId : validProfiles[0]!.id
          progress.value = loadProfileProgress(activeProfileId.value)
          legacyArchiveAvailable.value = hasLegacyArchive(activeProfileId.value)
          return
        }
      }
    }
  } catch { storageWarning.value = true }

  // Keep the old key as a backup; only a new profile store triggers migration.
  const first: LocalProfile = { id: newProfileId(), name: 'Мій профіль', createdAt: new Date().toISOString() }
  profiles.value = [first]
  activeProfileId.value = first.id
  try {
    const legacy = parseProgress(localStorage.getItem(LEGACY_PROGRESS_KEY))
    legacyArchiveAvailable.value = Object.keys(legacy).length > 0
    if (legacyArchiveAvailable.value) localStorage.setItem(`${LEGACY_ARCHIVE_PREFIX}${first.id}`, JSON.stringify(legacy))
  } catch { storageWarning.value = true }
  // Scores from the old pedagogy quiz do not measure the new cybersecurity quest.
  progress.value = {}
  saveProgress()
  saveProfileStore()
}
function switchProfile(id: string) {
  if (id === activeProfileId.value || !profiles.value.some((profile) => profile.id === id)) return
  saveProgress()
  activeProfileId.value = id
  progress.value = loadProfileProgress(id)
  legacyArchiveAvailable.value = hasLegacyArchive(id)
  profileError.value = ''
  saveProfileStore()
  if ((route.value.kind === 'lesson' || route.value.kind === 'quiz') && route.value.id) {
    const existing = progress.value[route.value.id] ?? { visited: false, attempts: 0, bestScore: null, lastAttempt: null }
    if (!existing.visited) { progress.value[route.value.id] = { ...existing, visited: true }; saveProgress() }
  }
}
function createProfile() {
  const name = newProfileName.value.trim().replace(/\s+/g, ' ')
  if (!name) { profileError.value = 'Введіть ім’я профілю.'; return }
  if (profiles.value.some((profile) => profile.name.toLocaleLowerCase('uk') === name.toLocaleLowerCase('uk'))) {
    profileError.value = 'Профіль з таким ім’ям уже існує.'
    return
  }
  saveProgress()
  const created: LocalProfile = { id: newProfileId(), name, createdAt: new Date().toISOString() }
  profiles.value = [...profiles.value, created]
  activeProfileId.value = created.id
  progress.value = {}
  legacyArchiveAvailable.value = false
  newProfileName.value = ''
  profileError.value = ''
  saveProgress()
  saveProfileStore()
  if ((route.value.kind === 'lesson' || route.value.kind === 'quiz') && route.value.id) {
    progress.value[route.value.id] = { visited: true, attempts: 0, bestScore: null, lastAttempt: null }
    saveProgress()
  }
}
function syncRoute() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const kind = parts[0]
  const id = parts[1]
  const selectedMethod = methods.find((method) => method.id === id)
  if ((kind === 'method' || kind === 'quiz' || kind === 'results') && selectedMethod) {
    route.value = { kind: kind === 'method' ? 'lesson' : kind, id }
    if ((kind === 'method' || kind === 'quiz') && id) {
      const existing = progress.value[id] ?? { visited: false, attempts: 0, bestScore: null, lastAttempt: null }
      if (!existing.visited) { progress.value[id] = { ...existing, visited: true }; saveProgress() }
    }
  } else route.value = { kind: 'home' }
  document.title = selectedMethod && route.value.kind !== 'home'
    ? `${selectedMethod.title} — EDU.LAB`
    : 'EDU.LAB — вебквести з кібербезпеки'
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
onMounted(() => { loadProfiles(); syncRoute(); window.addEventListener('hashchange', syncRoute); window.addEventListener('keydown', onKeyDown) })
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
      <section class="profile-panel" aria-label="Локальні профілі">
        <div class="profile-panel-head"><span>АКТИВНИЙ ПРОФІЛЬ</span><strong>{{ activeProfile?.name ?? 'Мій профіль' }}</strong></div>
        <div class="profile-list" role="group" aria-label="Змінити профіль">
          <button v-for="profile in profiles" :key="profile.id" type="button" class="profile-option" :class="{ 'profile-option--active': profile.id === activeProfileId }" :aria-pressed="profile.id === activeProfileId" @click="switchProfile(profile.id)">
            <span class="profile-avatar" aria-hidden="true">{{ profile.name.slice(0, 1).toLocaleUpperCase('uk') }}</span><span class="profile-name">{{ profile.name }}</span><UiIcon v-if="profile.id === activeProfileId" name="check" :size="14" />
          </button>
        </div>
        <form class="profile-create" @submit.prevent="createProfile">
          <label for="new-profile-name">Новий профіль</label>
          <div class="profile-create-row"><input id="new-profile-name" v-model="newProfileName" type="text" maxlength="40" autocomplete="off" placeholder="Ім’я користувача" /><button type="submit" aria-label="Створити профіль">+</button></div>
          <p v-if="profileError" class="profile-error" role="alert">{{ profileError }}</p>
        </form>
        <p class="profile-note">Профілі й прогрес зберігаються лише в цьому браузері на цьому пристрої.</p>
        <p v-if="legacyArchiveAvailable" class="profile-note">Старі результати тестів збережено окремо; нові квести починаються з нуля.</p>
        <p v-if="storageWarning" class="profile-error" role="alert">Браузер не зберігає дані. Прогрес може зникнути після закриття сторінки.</p>
      </section>
      <div class="sidebar-group-label sidebar-group-label--second">НАВЧАННЯ</div>
      <div class="sidebar-methods"><button v-for="method in methods" :key="method.id" type="button" class="sidebar-method" :class="{ 'sidebar-method--active': route.id === method.id }" @click="navigate(`/method/${method.id}`)"><span class="method-tiny-dot" :style="{ background: method.accent }"></span><span>{{ method.shortTitle }}</span><UiIcon v-if="(progress[method.id]?.bestScore ?? 0) >= 70" name="check" :size="14" /></button></div>
      <div class="sidebar-bottom"><div class="sidebar-progress-card"><div class="sidebar-progress-icon"><UiIcon name="sparkle" :size="19" /></div><strong>Шлях у кібербезпеці</strong><p>Розв’язуйте завдання за різними методиками та відстежуйте власний прогрес.</p><div class="mini-progress-head"><span>Завершено вебквестів</span><b>{{ completedCount }}/{{ methods.length }}</b></div><div class="progress-track"><span :style="{ width: `${overallPercent}%` }"></span></div></div><div class="sidebar-footer"><span class="status-dot"></span> Прогрес профілю {{ activeProfile?.name ?? 'Мій профіль' }}</div></div>
    </aside>
    <div v-if="mobileMenuOpen" class="mobile-overlay" aria-hidden="true" @click="closeMobileMenu"></div>
    <div class="workspace">
      <header class="topbar"><div class="topbar-left"><button class="mobile-menu-button" type="button" aria-label="Відкрити меню" @click="mobileMenuOpen = true"><UiIcon name="menu" :size="22" /></button><div class="breadcrumb"><span>EDU.LAB</span><UiIcon name="chevron" :size="14" /><strong>{{ route.kind === 'home' ? 'Огляд' : route.kind === 'lesson' ? 'Вступ до вебквесту' : route.kind === 'quiz' ? 'Вебквест' : 'Результат' }}</strong></div></div><div class="topbar-right"><label v-if="route.kind === 'home'" class="search-box"><UiIcon name="search" :size="18" /><input ref="searchInput" v-model="search" type="search" placeholder="Пошук методики..." aria-label="Пошук методики" /><kbd>/</kbd></label><span class="topbar-divider"></span><div class="topbar-badge" :title="`Активний локальний профіль: ${activeProfile?.name ?? 'Мій профіль'}`"><span class="badge-icon"><UiIcon name="book" :size="17" /></span><span>{{ activeProfile?.name ?? 'Мій профіль' }}</span></div></div></header>
      <main class="main-content">
        <template v-if="route.kind === 'home'">
          <section class="dashboard-intro"><div><span class="eyebrow"><span class="eyebrow-line"></span> ВІТАЄМО В EDU.LAB</span><h1>Кібербезпека через <span>вебквести.</span></h1><p>Одна навчальна тема, різні педагогічні методики. Виконуйте завдання за логікою кожної методики й бачте власний прогрес.</p></div><span class="intro-index">01 <span>/</span> {{ String(methods.length).padStart(2, '0') }}</span></section>
          <section class="hero-panel" aria-label="Почати вебквест"><div class="hero-grid"></div><div class="hero-glow"></div><div class="hero-content"><span class="hero-kicker"><span class="pulse-dot"></span> ПРАКТИЧНІ ВЕБКВЕСТИ З КІБЕРБЕЗПЕКИ</span><h2>Навчайтесь через<br /><em>дію та вибір.</em></h2><p>Розпізнавайте цифрові загрози, ухвалюйте рішення у сценаріях та проходьте послідовність завдань за обраною методикою.</p><div class="hero-actions"><button class="btn btn-primary" type="button" @click="startLearning">Почати вебквест <UiIcon name="arrow" :size="18" /></button><button class="btn btn-ghost" type="button" @click="openCatalog">Переглянути каталог</button></div></div><div class="hero-art" aria-hidden="true"><div class="orbit orbit-outer"></div><div class="orbit orbit-middle"></div><div class="orbit orbit-inner"></div><div class="art-core"><span class="art-core-top">EDU / 01</span><UiIcon name="sparkle" :size="42" /><span class="art-core-bottom">LEARN · APPLY · GROW</span></div><span class="orbit-node node-one">01</span><span class="orbit-node node-two">02</span><span class="orbit-node node-three">03</span><span class="orbit-label orbit-label-one">ДОСЛІДЖУЙ</span><span class="orbit-label orbit-label-two">ЗАСТОСОВУЙ</span></div></section>
          <section id="progress" class="stats-grid" aria-label="Ваш прогрес"><div class="stat-card"><span class="stat-icon stat-icon--violet"><UiIcon name="layers" :size="21" /></span><div><div class="stat-label">Методик для вебквестів</div><strong>{{ String(methods.length).padStart(2, '0') }}</strong><small>різні маршрути з кібербезпеки</small></div><span class="stat-decoration">01</span></div><div class="stat-card"><span class="stat-icon stat-icon--cyan"><UiIcon name="target" :size="21" /></span><div><div class="stat-label">Практичних завдань</div><strong>{{ totalQuestions }}</strong><small>у вебквестах</small></div><span class="stat-decoration">02</span></div><div class="stat-card"><span class="stat-icon stat-icon--amber"><UiIcon name="chart" :size="21" /></span><div><div class="stat-label">Прогрес профілю</div><strong>{{ overallPercent }}<span>%</span></strong><small>{{ startedCount }} з {{ methods.length }} вебквестів розпочато</small></div><span class="stat-decoration">03</span></div></section>
          <section id="catalog" class="catalog-section"><div class="section-heading"><div><span class="eyebrow"><span class="eyebrow-line"></span> БІБЛІОТЕКА ЗНАНЬ</span><h2>Каталог вебквестів <span class="section-count">{{ String(filteredMethods.length).padStart(2, '0') }}</span></h2><p>Кожен вебквест навчає кібербезпеки за окремою педагогічною методикою.</p></div><div class="section-aside"><span class="aside-line"></span> ОБИРАЙТЕ СВІЙ ШЛЯХ</div></div><div class="filter-row" role="group" aria-label="Фільтр за категорією"><button v-for="category in categories" :key="category" type="button" class="filter-chip" :class="{ 'filter-chip--active': activeCategory === category }" @click="activeCategory = category">{{ category }}</button></div><div v-if="filteredMethods.length" class="method-grid"><MethodCard v-for="(method, index) in filteredMethods" :key="method.id" :method="method" :index="index" :progress="progress[method.id]" @open="navigate(`/method/${method.id}`)" @quiz="navigate(`/quiz/${method.id}`)" /></div><div v-else class="empty-state"><span><UiIcon name="search" :size="28" /></span><h3>Методик не знайдено</h3><p>Спробуйте інший запит або змініть категорію.</p><button type="button" class="btn btn-secondary" @click="search = ''; activeCategory = 'Усі'">Скинути фільтри</button></div></section>
          <footer class="page-footer"><span>© EDU.LAB · Педагогічні алгоритми</span><span>Навчайтесь у власному темпі <UiIcon name="sparkle" :size="15" /></span></footer>
        </template>
        <LessonView v-else-if="route.kind === 'lesson' && currentMethod" :method="currentMethod" :progress="currentProgress" @back="openCatalog" @quiz="navigate(`/quiz/${currentMethod.id}`)" />
        <QuestView v-else-if="route.kind === 'quiz' && currentMethod" :key="`${activeProfileId}-${currentMethod.id}-${route.kind}`" :profile-id="activeProfileId" :method="currentMethod" @back="navigate(`/method/${currentMethod.id}`)" @finish="finishQuiz" />
        <ResultsView v-else-if="route.kind === 'results' && currentMethod && currentProgress?.lastAttempt" :method="currentMethod" :result="currentProgress.lastAttempt" @retry="navigate(`/quiz/${currentMethod.id}`)" @back="navigate(`/method/${currentMethod.id}`)" @home="navigate('/')" />
        <div v-else class="empty-state"><h2>У профілі {{ activeProfile?.name ?? 'Мій профіль' }} ще немає результату</h2><p>Пройдіть вебквест, щоб побачити свій результат.</p><button type="button" class="btn btn-primary" @click="currentMethod ? navigate(`/quiz/${currentMethod.id}`) : navigate('/')">{{ currentMethod ? 'Почати вебквест' : 'На головну' }}</button></div>
      </main>
    </div>
  </div>
</template>

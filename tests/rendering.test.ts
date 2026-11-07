import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { compileScript, parse, registerTS } from '@vue/compiler-sfc'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import type { Activity, ActivityDraft, ActivityRecord, InteractiveQuest, InteractiveResult } from '../src/data/activities.ts'
import type { Method } from '../src/data/methods.ts'

// Compile the actual Vue components in memory. No browser or generated files are used.
// import.meta.glob is Vite-specific, so its data module is supplied with the same
// ordered JSON files that Vite bundles in production.
registerTS(() => ts)
const repo = fileURLToPath(new URL('../', import.meta.url))
const nativeRequire = createRequire(import.meta.url)
const cache = new Map<string, { exports: any }>()
const methods: Method[] = fs.readdirSync(path.join(repo, 'src/data/methods')).filter(name => name.endsWith('.json')).sort()
  .map(name => JSON.parse(fs.readFileSync(path.join(repo, 'src/data/methods', name), 'utf8')))

function loadModule(filename: string): any {
  const absolute = path.resolve(repo, filename)
  const cached = cache.get(absolute)
  if (cached) return cached.exports
  if (absolute === path.join(repo, 'src/data/methods.ts')) return { methods }
  const module = { exports: {} as any }
  cache.set(absolute, module)
  let source = fs.readFileSync(absolute, 'utf8')
  if (absolute.endsWith('.vue')) {
    const parsed = parse(source, { filename: absolute })
    assert.deepEqual(parsed.errors, [], `${filename}: Vue source must parse`)
    source = compileScript(parsed.descriptor, {
      id: absolute.replaceAll('\\', '/'), inlineTemplate: true,
      templateOptions: { ssr: true },
      fs: { fileExists: fs.existsSync, readFile: file => fs.readFileSync(file, 'utf8') },
    }).content
  }
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    fileName: absolute,
  }).outputText
  const requireLocal = (request: string) => {
    if (!request.startsWith('.')) return nativeRequire(request)
    let target = path.resolve(path.dirname(absolute), request)
    if (!path.extname(target)) {
      const extension = ['.ts', '.vue', '.json', '.js'].find(ext => fs.existsSync(target + ext))
      assert.ok(extension, `Cannot resolve ${request} from ${filename}`)
      target += extension
    }
    if (target.endsWith('.json')) return JSON.parse(fs.readFileSync(target, 'utf8'))
    return loadModule(target)
  }
  const execute = new vm.Script(`(function(exports,require,module,__filename,__dirname){${compiled}\n})`, { filename: absolute }).runInThisContext()
  execute(module.exports, requireLocal, module, absolute, path.dirname(absolute))
  return module.exports
}

const { interactiveQuests } = loadModule('src/data/activities.ts') as { interactiveQuests: Record<string, InteractiveQuest> }
const { emptyDraft, evaluateActivity } = loadModule('src/data/assessment.ts') as {
  emptyDraft: () => ActivityDraft
  evaluateActivity: (activity: Activity, draft: ActivityDraft) => { criteria: ActivityRecord['criteria']; summary: string; artifact: string; ready: boolean }
}
const Workbench = loadModule('src/components/ActivityWorkbench.vue').default
const Results = loadModule('src/components/ResultsView.vue').default
const activities = Object.values(interactiveQuests).flatMap(quest => [...quest.activities, ...(quest.verification ?? [])])
const authoredText = '<script>alert("learner text")</script> Мій висновок: перевіряю джерело через відомий канал і захищаю робочий акаунт.'
const escapeHtml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
const count = (html: string, expression: RegExp) => [...html.matchAll(expression)].length

async function render(component: any, props: Record<string, unknown>) {
  const warnings: string[] = []
  const app = createSSRApp(component, props)
  app.config.warnHandler = warning => warnings.push(warning)
  const html = await renderToString(app)
  assert.deepEqual(warnings, [], 'Actual component should render without Vue warnings')
  return html
}

function populatedDraft(activity: Activity): ActivityDraft {
  const draft = emptyDraft()
  draft.text.reason = authoredText
  draft.text.revision = authoredText
  if (activity.kind === 'classify') draft.classification = Object.fromEntries(activity.items.map(item => [item.id, item.group]))
  if (activity.kind === 'evidence') draft.selectedEvidence = activity.evidence.filter(item => item.essential).map(item => item.id)
  if (activity.kind === 'simulation') draft.actions = [...activity.requiredActions]
  if (activity.kind === 'map') draft.links = activity.links.map(link => `${link.from}>${link.to}`)
  if (activity.kind === 'review') draft.flagged = activity.plan.filter(line => line.needsRevision).map(line => line.id)
  if (activity.kind === 'compose') {
    draft.text = Object.fromEntries(activity.sections.map(section => [section.id, authoredText]))
    draft.checks = activity.checklist.map(check => check.id)
  }
  if (activity.kind === 'triage') draft.triage = Object.fromEntries(activity.messages.map(message => [message.id, message.disposition]))
  return draft
}

function assertWritingLabels(html: string) {
  for (const textarea of html.matchAll(/<textarea\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    assert.ok(html.includes(`for="${textarea[1]}"`), `Writing control ${textarea[1]} needs its visible label`)
  }
}

test('actual catalog, method cards, lessons and all six mission headers render', async () => {
  assert.equal(methods.length, 6)
  const App = loadModule('src/App.vue').default
  const Card = loadModule('src/components/MethodCard.vue').default
  const Lesson = loadModule('src/components/LessonView.vue').default
  const Quest = loadModule('src/components/QuestView.vue').default
  const home = await render(App, {})
  assert.equal(count(home, /<article\b[^>]*class="method-card"/g), 6)
  assert.ok(home.includes('Інтерактивних дій'))
  for (const [index, method] of methods.entries()) {
    const quest = interactiveQuests[method.id]!
    assert.ok(quest, `Method ${method.id} needs its own interactive quest`)
    const card = await render(Card, { method, index })
    assert.ok(card.includes(escapeHtml(quest.tool)))
    assert.ok(card.includes('Відкрити майстерню'))
    const lesson = await render(Lesson, { method })
    assert.ok(lesson.includes(escapeHtml(quest.mission)))
    assert.ok(lesson.includes(escapeHtml(quest.learningOutcome)))
    assert.equal(count(lesson, /role="tab"/g), method.stages.length)
    assert.equal(count(lesson, /role="tabpanel"/g), 1)
    const initialQuest = await render(Quest, { method, profileId: 'ssr-profile' })
    assert.ok(initialQuest.includes(escapeHtml(quest.title)))
    assert.ok(initialQuest.includes(escapeHtml(quest.mission)))
    assert.ok(initialQuest.includes('Джерела для розслідування'))
  }
})

const kinds: Activity['kind'][] = ['classify', 'evidence', 'simulation', 'map', 'review', 'compose', 'briefing', 'triage']
for (const kind of kinds) {
  test(`actual ${kind} workbench renders empty and saved locked work with accessible controls`, async () => {
    const activity = activities.find(item => item.kind === kind)!
    assert.ok(activity, `${kind} needs a real scenario`)
    const empty = await render(Workbench, { activity, draft: emptyDraft(), locked: false })
    const saved = await render(Workbench, { activity, draft: populatedDraft(activity), locked: true })
    assertWritingLabels(empty)
    assertWritingLabels(saved)
    assert.ok(!saved.includes('<script>'), 'Learner writing must remain text')
    if (kind === 'classify' && activity.kind === kind) {
      assert.equal(count(empty, /<select\b/g), activity.items.length)
      assert.equal(count(saved, /<select\b/g), activity.items.length)
      assert.equal(count(empty, /<select\b[^>]*aria-label=/g), activity.items.length)
      assert.equal(count(saved, /<select\b[^>]*disabled/g), activity.items.length)
    }
    if (kind === 'evidence' && activity.kind === kind) {
      assert.equal(count(empty, /<button\b/g), activity.evidence.length)
      assert.equal(count(empty, /aria-pressed="false"/g), activity.evidence.length)
      assert.equal(count(saved, /<button\b[^>]*disabled/g), activity.evidence.length)
      assert.equal(count(empty, /<textarea\b/g), 1)
      assert.ok(saved.includes(escapeHtml(authoredText)))
    }
    if (kind === 'simulation' && activity.kind === kind) {
      assert.equal(count(empty, /<button\b/g), activity.tools.length + 1)
      assert.equal(count(saved, /<li\b/g), activity.requiredActions.length)
      assert.ok(saved.includes('Журнал наслідків'))
    }
    if (kind === 'map' && activity.kind === kind) {
      assert.equal(count(empty, /aria-pressed="false"/g), activity.nodes.length)
      assert.equal(count(saved, /aria-label="Видалити зв’язок /g), activity.links.length)
      assert.equal(count(empty, /<textarea\b/g), 1)
    }
    if (kind === 'review' && activity.kind === kind) {
      assert.equal(count(empty, /aria-pressed="false"/g), activity.plan.length)
      assert.equal(count(saved, /aria-pressed="true"/g), activity.plan.filter(line => line.needsRevision).length)
      assert.equal(count(empty, /<textarea\b/g), 1)
    }
    if (kind === 'compose' && activity.kind === kind) {
      assert.equal(count(empty, /<textarea\b/g), activity.sections.length)
      assert.equal(count(empty, /type="checkbox"/g), activity.checklist.length)
      assert.equal(count(saved, /type="checkbox"[^>]*checked/g), activity.checklist.length)
      assert.ok(saved.includes(escapeHtml(authoredText)))
      assert.ok(saved.includes('Це ваша самооцінка'))
    }
    if (kind === 'briefing' && activity.kind === kind) {
      assert.equal(count(empty, /<textarea\b/g), 0)
      for (const panel of activity.panels) assert.ok(empty.includes(escapeHtml(panel.title)))
    }
    if (kind === 'triage' && activity.kind === kind) {
      assert.equal(count(empty, /<button\b/g), activity.messages.length + 3)
      assert.ok(empty.includes('aria-label="Навчальні листи"'))
      assert.ok(empty.includes(escapeHtml(activity.messages[0]!.subject)))
    }
  })
}

test('actual mentor demonstration exposes each step as a keyboard button', async () => {
  const activity = activities.find(item => item.kind === 'briefing' && item.demonstration?.length)!
  assert.ok(activity && activity.kind === 'briefing')
  const html = await render(Workbench, { activity, draft: emptyDraft(), locked: false })
  assert.equal(count(html, /aria-pressed=/g), activity.demonstration!.length)
  assert.ok(html.includes(escapeHtml(activity.demonstration![0]!.detail)))
})

function resultFor(method: Method, records: ActivityRecord[]): InteractiveResult {
  const quest = interactiveQuests[method.id]!
  const criteria = records.flatMap(record => record.criteria)
  return {
    formatVersion: 'interactive-v2', methodId: method.id, questMode: quest.mode,
    completedAt: '2026-10-08T12:00:00Z', elapsedSeconds: 185,
    score: 100, correctCount: criteria.filter(criterion => criterion.met).length, total: criteria.length,
    answers: [], bySkill: {}, byType: {}, records,
    artifacts: records.filter(record => record.artifact).map(record => ({ title: record.title, text: record.artifact })),
    reflection: authoredText, completed: true, mastered: false, supportCount: 0,
    independentCount: records.length, learningNote: 'Дії за критеріями; авторські пояснення обговоріть із викладачем.',
  }
}

test('actual results show authored portfolio, readable skill names and escaped learner text', async () => {
  const method = methods.find(item => interactiveQuests[item.id]?.mode === 'bloom')!
  const compose = interactiveQuests[method.id]!.activities.find(item => item.kind === 'compose')!
  const evaluation = evaluateActivity(compose, populatedDraft(compose))
  assert.equal(evaluation.ready, true)
  const record: ActivityRecord = {
    activityId: compose.id, title: compose.title, stage: compose.stage, kind: compose.kind, skill: compose.skill,
    ...evaluation, hintsUsed: 0, retries: 0, independent: true,
  }
  const skillKeys = [...new Set(activities.map(activity => activity.skill))]
  const records = [record, ...skillKeys.filter(skill => skill !== record.skill).map(skill => ({
    ...record, activityId: `skill-${skill}`, title: 'Практичний етап', skill, artifact: '',
  }))]
  const html = await render(Results, { method, result: resultFor(method, records) })
  assert.ok(html.includes('Завантажити портфоліо'))
  assert.ok(html.includes('Мої матеріали'))
  assert.ok(html.includes('МОЯ РЕФЛЕКСІЯ'))
  assert.ok(html.includes(escapeHtml(authoredText)))
  assert.ok(!html.includes('<script>'))
  for (const skill of skillKeys) assert.ok(!html.includes(`>${skill}<`), `${skill} must have a readable learner label`)
  assert.ok(html.includes('Розпізнавання цифрових загроз'))
  assert.ok(html.includes('Створення власного рішення'))
  assert.ok(html.includes('Осмислення власних дій'))
  assert.ok(html.includes('Якість') || html.includes('якість'))
})

test('actual mastery results keep training journal but report fresh verification criteria', async () => {
  const method = methods.find(item => interactiveQuests[item.id]?.mode === 'mastery')!
  const quest = interactiveQuests[method.id]!
  const recordFor = (activity: Activity, met: boolean): ActivityRecord => ({
    activityId: activity.id, title: activity.title, stage: activity.stage, kind: activity.kind, skill: activity.skill,
    criteria: [{ id: activity.id, label: 'Безпечна практична дія', met, detail: 'Перевірка конкретної дії.', mode: 'automatic' }],
    summary: 'Збережений розбір дій.', artifact: '', hintsUsed: 0, retries: 0, independent: true,
  })
  const records = [recordFor(quest.activities[0]!, false), recordFor(quest.verification![0]!, true)]
  const result = { ...resultFor(method, records), completed: false, mastered: false, score: 100 }
  const html = await render(Results, { method, result })
  assert.ok(html.includes('Потрібна корекція'))
  assert.ok(!html.includes('Усі уміння опановано'))
  assert.ok(html.includes('за новими перевірочними випадками'))
  assert.ok(html.includes(escapeHtml(quest.activities[0]!.title)))
  assert.ok(html.includes(escapeHtml(quest.verification![0]!.title)))
  assert.equal(count(html, /class="review-item"/g), 2)
})

test('results display automatic action counts separately from authored-text self review', async () => {
  const method = methods.find(item => interactiveQuests[item.id]?.mode === 'bloom')!
  const quest = interactiveQuests[method.id]!
  const activity = quest.activities.find(item => item.kind === 'evidence')!
  assert.equal(activity.kind, 'evidence')
  const draft = populatedDraft(activity)
  draft.selectedEvidence = [activity.evidence.find(item => item.essential)!.id]
  const evaluation = evaluateActivity(activity, draft)
  const record: ActivityRecord = {
    activityId: activity.id, title: activity.title, stage: activity.stage, kind: activity.kind,
    skill: activity.skill, ...evaluation, hintsUsed: 0, retries: 0, independent: true,
  }
  const { buildInteractiveResult } = loadModule('src/data/quest-flow.ts')
  const result: InteractiveResult = buildInteractiveResult({ quest, records: [record], reflection: authoredText, elapsedSeconds: 20 })
  const automatic = record.criteria.filter(item => item.mode === 'automatic')
  const met = automatic.filter(item => item.met).length
  const html = await render(Results, { method, result })
  const visibleText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  assert.ok(visibleText.includes(`КРИТЕРІЇ ДІЙ ${met} / ${automatic.length}`))
  assert.ok(html.includes('Власні матеріали та самоперевірка збережені окремо'))
  assert.ok(html.includes('критерії самоперевірки'))
})

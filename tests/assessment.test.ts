import assert from 'node:assert/strict'
import test from 'node:test'
import { interactiveQuests } from '../src/data/activities.ts'
import type { Activity, ActivityDraft } from '../src/data/activities.ts'
import { emptyDraft, evaluateActivity } from '../src/data/assessment.ts'

const base = {
  id: 'case',
  stage: 'Практична дія',
  title: 'Ситуація на робочому місці',
  objective: 'Виконати обґрунтовані дії',
  briefing: 'Навчальний приклад',
  skill: 'analysis' as const,
  feedback: 'Порівняйте рішення з джерелами.',
}

const classify: Activity = {
  ...base,
  kind: 'classify',
  groups: [{ id: 'source', label: 'Перевірений канал' }, { id: 'risk', label: 'Ознака ризику' }],
  items: [{ id: 'domain', label: 'Домен у листі', group: 'risk' }],
}

const evidence: Activity = {
  ...base,
  kind: 'evidence',
  mail: { from: 'sender@example.test', subject: 'Графік практики', body: 'Перевірте джерело.', url: 'https://example.test' },
  evidence: [
    { id: 'url', label: 'Інший домен', detail: 'Адреса не збігається з перевіреним каналом.', essential: true },
    { id: 'logo', label: 'Знайомий логотип', detail: 'Логотип можна скопіювати.', essential: false },
  ],
  reasonPrompt: 'Обґрунтуйте висновок.',
}

const simulation: Activity = {
  ...base,
  kind: 'simulation',
  tools: [
    { id: 'verify', label: 'Перевірити канал', detail: 'Зіставити адресу.', effect: 'Джерело перевірено.', safe: true },
    { id: 'report', label: 'Повідомити майстра', detail: 'Передати відомості.', effect: 'Майстра повідомлено.', safe: true },
    { id: 'password', label: 'Ввести пароль', detail: 'Відкрити сторінку з листа.', effect: 'Пароль передано сторонньому сайту.', safe: false },
    { id: 'notes', label: 'Зберегти нотатку', detail: 'Зафіксувати спостереження.', effect: 'Спостереження збережено.', safe: true },
  ],
  requiredActions: ['verify', 'report'],
  forbiddenActions: ['password'],
  dependencies: [{ before: 'verify', after: 'report' }],
}

const map: Activity = {
  ...base,
  kind: 'map',
  nodes: [
    { id: 'domain', label: 'Чужий домен', type: 'evidence' },
    { id: 'loss', label: 'Втрата пароля', type: 'risk' },
    { id: 'verify', label: 'Незалежна перевірка', type: 'action' },
  ],
  links: [
    { from: 'domain', to: 'loss', label: 'Пояснено ризик' },
    { from: 'loss', to: 'verify', label: 'Вибрано захист' },
  ],
}

const review: Activity = {
  ...base,
  kind: 'review',
  plan: [
    { id: 'open', text: 'Увійти через посилання з листа', needsRevision: true },
    { id: 'call', text: 'Зателефонувати за відомим номером', needsRevision: false },
  ],
  revisionPrompt: 'Напишіть безпечну редакцію.',
}

const compose: Activity = {
  ...base,
  kind: 'compose',
  sections: [{ id: 'plan', label: 'Мій план', prompt: 'Опишіть дії.', minLength: 20 }],
  checklist: [{ id: 'clear', label: 'Дії конкретні' }, { id: 'source', label: 'Названо незалежний канал' }],
}

const triage: Activity = {
  ...base,
  kind: 'triage',
  messages: [
    { id: 'notice', from: 'master@example.test', subject: 'Оновлення графіка', body: 'Потрібна перевірка.', url: 'https://example.test', disposition: 'verify' },
  ],
}

const reason = 'Я пов’язую адресу відправника із джерелом повідомлення та перевіряю його незалежним каналом.'
const allMet = (result: ReturnType<typeof evaluateActivity>) => result.criteria.every((criterion) => criterion.met)

test('drafts have independent collections and assessment does not mutate the learner record', () => {
  const first = emptyDraft()
  const second = emptyDraft()
  first.actions.push('verify')
  first.text.reason = reason
  assert.deepEqual(second, {
    selectedEvidence: [], classification: {}, actions: [], links: [], flagged: [], text: {}, checks: [], triage: {},
  })
  const before = structuredClone(first)
  evaluateActivity(simulation, first)
  assert.deepEqual(first, before)
})

test('incomplete cards cannot be submitted, while a complete wrong classification can receive feedback', () => {
  const draft = emptyDraft()
  assert.equal(evaluateActivity(classify, draft).ready, false)
  draft.classification.domain = 'source'
  const result = evaluateActivity(classify, draft)
  assert.equal(result.ready, true)
  assert.equal(allMet(result), false)
  assert.match(result.artifact, /Перевірений канал/)
  assert.doesNotMatch(result.artifact, /Ознака ризику/)
  draft.classification.domain = 'risk'
  assert.equal(allMet(evaluateActivity(classify, draft)), true)
})

test('evidence requires essential clues and rejects a selected decoy', () => {
  const draft = emptyDraft()
  draft.text.reason = reason
  draft.selectedEvidence = ['url', 'logo']
  const decoy = evaluateActivity(evidence, draft)
  assert.equal(decoy.ready, true)
  assert.equal(decoy.criteria.find((criterion) => criterion.id === 'evidence:logo')?.met, false)
  draft.selectedEvidence = ['logo']
  assert.equal(evaluateActivity(evidence, draft).criteria.find((criterion) => criterion.id === 'evidence:url')?.met, false)
  draft.selectedEvidence = ['url']
  const correct = evaluateActivity(evidence, draft)
  assert.equal(allMet(correct), true)
  assert.doesNotMatch(correct.artifact, /Знайомий логотип|essential|correct/)
})

test('written explanations check completion only and are identified as self review', () => {
  const draft = emptyDraft()
  draft.selectedEvidence = ['url']
  draft.text.reason = '     коротко     '
  assert.equal(evaluateActivity(evidence, draft).ready, false)
  draft.text.reason = 'x'.repeat(30)
  const result = evaluateActivity(evidence, draft)
  const written = result.criteria.find((criterion) => criterion.id === 'evidence:reason')
  assert.equal(result.ready, true)
  assert.equal(written?.mode, 'self')
  assert.equal(written?.met, true)
  assert.match(written?.detail ?? '', /лише.*наявність/)
  assert.match(result.summary, /Зміст власного тексту перевірте/)
})

test('simulation enforces safe actions and their dependency order', () => {
  const draft = emptyDraft()
  draft.actions = ['report', 'verify']
  const reversed = evaluateActivity(simulation, draft)
  assert.equal(reversed.ready, true)
  assert.equal(reversed.criteria.find((criterion) => criterion.id === 'order:verify>report')?.met, false)
  draft.actions = ['verify', 'report', 'password']
  const unsafe = evaluateActivity(simulation, draft)
  assert.equal(unsafe.criteria.find((criterion) => criterion.id === 'avoid:password')?.met, false)
  draft.actions = ['verify', 'notes', 'report']
  assert.equal(allMet(evaluateActivity(simulation, draft)), true)
  draft.actions = ['verify']
  assert.equal(evaluateActivity(simulation, draft).criteria.find((criterion) => criterion.id === 'action:report')?.met, false)
})

test('unsafe tools remain forbidden even if omitted from the explicit forbidden list', () => {
  assert.equal(simulation.kind, 'simulation')
  if (simulation.kind !== 'simulation') return
  const draft = emptyDraft()
  draft.actions = ['verify', 'report', 'password']
  const result = evaluateActivity({ ...simulation, forbiddenActions: [] }, draft)
  assert.equal(result.criteria.find((criterion) => criterion.id === 'avoid:password')?.met, false)
})

test('concept map must contain all required directed links and no extras', () => {
  const draft = emptyDraft()
  draft.text.reason = reason
  draft.links = ['domain>loss']
  const partial = evaluateActivity(map, draft)
  assert.equal(partial.ready, true)
  assert.equal(allMet(partial), false)
  assert.doesNotMatch(partial.artifact, /Незалежна перевірка/)
  draft.links = ['domain>loss', 'loss>verify', 'verify>domain']
  assert.equal(evaluateActivity(map, draft).criteria.find((criterion) => criterion.id === 'map:extra')?.met, false)
  draft.links = ['domain>loss', 'loss>verify']
  assert.equal(allMet(evaluateActivity(map, draft)), true)
})

test('plan review identifies actual mistakes without rewarding blanket flagging', () => {
  const draft = emptyDraft()
  draft.text.revision = reason
  draft.flagged = ['open', 'call']
  const result = evaluateActivity(review, draft)
  assert.equal(result.ready, true)
  assert.equal(result.criteria.find((criterion) => criterion.id === 'review:call')?.met, false)
  draft.flagged = ['open']
  assert.equal(allMet(evaluateActivity(review, draft)), true)
})

test('composing requires complete sections and an explicit declaration for every self review criterion', () => {
  const draft = emptyDraft()
  draft.text.plan = reason
  draft.checks = ['clear']
  assert.equal(evaluateActivity(compose, draft).ready, false)
  draft.checks.push('source')
  const completed = evaluateActivity(compose, draft)
  assert.equal(completed.ready, true)
  assert.equal(allMet(completed), true)
  assert.equal(completed.criteria.every((criterion) => criterion.mode === 'self'), true)
  assert.match(completed.artifact, new RegExp(reason))
  draft.text.plan = '    '
  assert.equal(evaluateActivity(compose, draft).ready, false)
})

test('mail triage allows a complete wrong decision and never leaks the expected action into the artifact', () => {
  const draft = emptyDraft()
  assert.equal(evaluateActivity(triage, draft).ready, false)
  draft.triage.notice = 'routine'
  const result = evaluateActivity(triage, draft)
  assert.equal(result.ready, true)
  assert.equal(allMet(result), false)
  assert.match(result.artifact, /Опрацювати звичайно/)
  assert.doesNotMatch(result.artifact, /Перевірити незалежним каналом/)
  draft.triage.notice = 'verify'
  assert.equal(allMet(evaluateActivity(triage, draft)), true)
})

test('unknown elements cannot yield a fully successful evaluation', () => {
  const draft = emptyDraft()
  draft.selectedEvidence = ['url', 'injected-id']
  draft.text.reason = reason
  const result = evaluateActivity(evidence, draft)
  assert.equal(result.ready, true)
  assert.equal(allMet(result), false)
  assert.equal(result.criteria.find((criterion) => criterion.id === 'evidence:known')?.met, false)
})

test('briefing contains no scored claims or learner artifact', () => {
  const briefing: Activity = { ...base, kind: 'briefing', panels: [{ title: 'Джерело', text: 'Ознайомтеся з матеріалами.' }] }
  assert.deepEqual(evaluateActivity(briefing, emptyDraft()), { criteria: [], summary: briefing.feedback, artifact: '', ready: true })
})

function referenceDraft(activity: Activity): ActivityDraft {
  const draft = emptyDraft()
  switch (activity.kind) {
    case 'briefing':
      break
    case 'classify':
      draft.classification = Object.fromEntries(activity.items.map((item) => [item.id, item.group]))
      assert.equal(activity.items.every((item) => activity.groups.some((group) => group.id === item.group)), true, `${activity.id}: category exists`)
      break
    case 'evidence':
      draft.selectedEvidence = activity.evidence.filter((entry) => entry.essential).map((entry) => entry.id)
      draft.text.reason = reason
      break
    case 'simulation': {
      const visited = new Set<string>()
      const active = new Set<string>()
      const visit = (id: string) => {
        if (visited.has(id)) return
        assert.equal(active.has(id), false, `${activity.id}: dependencies contain no cycle`)
        active.add(id)
        for (const dependency of activity.dependencies ?? []) {
          if (dependency.after === id) visit(dependency.before)
        }
        assert.equal(activity.tools.some((tool) => tool.id === id), true, `${activity.id}: required tool exists`)
        draft.actions.push(id)
        active.delete(id)
        visited.add(id)
      }
      for (const id of activity.requiredActions) visit(id)
      for (const dependency of activity.dependencies ?? []) visit(dependency.after)
      break
    }
    case 'map':
      assert.equal(activity.links.every((link) => activity.nodes.some((node) => node.id === link.from) && activity.nodes.some((node) => node.id === link.to)), true, `${activity.id}: nodes exist`)
      draft.links = activity.links.map((link) => `${link.from}>${link.to}`)
      draft.text.reason = reason
      break
    case 'review':
      draft.flagged = activity.plan.filter((step) => step.needsRevision).map((step) => step.id)
      draft.text.revision = reason
      break
    case 'compose':
      draft.text = Object.fromEntries(activity.sections.map((section) => [section.id, reason.repeat(Math.ceil(section.minLength / reason.length))]))
      draft.checks = activity.checklist.map((check) => check.id)
      break
    case 'triage':
      draft.triage = Object.fromEntries(activity.messages.map((message) => [message.id, message.disposition]))
      break
  }
  return draft
}

test('every published activity has a complete consistent reference path and rejects an empty attempt', () => {
  assert.equal(Object.keys(interactiveQuests).length, 6)
  for (const quest of Object.values(interactiveQuests)) {
    const activities = [...quest.activities, ...(quest.verification ?? [])]
    const ids = activities.map((activity) => activity.id)
    assert.equal(new Set(ids).size, ids.length, `${quest.methodId}: activity IDs are unique`)
    for (const activity of activities) {
      const result = evaluateActivity(activity, referenceDraft(activity))
      assert.equal(result.ready, true, `${activity.id}: reference path is complete`)
      assert.equal(allMet(result), true, `${activity.id}: reference path meets every observable criterion`)
      const empty = evaluateActivity(activity, emptyDraft())
      assert.equal(empty.ready, activity.kind === 'briefing', `${activity.id}: empty attempt is incomplete`)
      assert.equal(activity.kind === 'briefing' || result.artifact.length > 0, true, `${activity.id}: learner work is recorded`)
    }
  }
})

test('published target counts match scored stages and mastery includes a new verification for every skill', () => {
  for (const quest of Object.values(interactiveQuests)) {
    if (quest.mode === 'adaptive') continue
    const count = [...quest.activities, ...(quest.verification ?? [])].filter((activity) => activity.kind !== 'briefing').length
    assert.equal(quest.targetCount, count, `${quest.methodId}: target matches practical stages`)
    if (quest.mode === 'mastery') {
      assert.equal(quest.verification?.length, quest.activities.length)
      for (const activity of quest.activities) {
        const verification = quest.verification?.find((entry) => entry.skill === activity.skill)
        assert.ok(verification, `${activity.skill}: independent verification exists`)
        assert.notEqual(verification.id, activity.id)
        assert.equal(verification.support, 'none')
      }
    }
  }
})

test('adaptive case bank supports every skill at each difficulty and a five-case route', () => {
  const adaptive = Object.values(interactiveQuests).find((quest) => quest.mode === 'adaptive')
  assert.ok(adaptive)
  assert.equal(adaptive.targetCount, 5)
  assert.ok(adaptive.activities.length >= adaptive.targetCount)
  const skills = new Set(adaptive.activities.map((activity) => activity.skill))
  assert.equal(skills.size, 3)
  for (const skill of skills) {
    for (const difficulty of ['easy', 'medium', 'hard']) {
      assert.equal(adaptive.activities.some((activity) => activity.skill === skill && activity.difficulty === difficulty), true, `${skill}: ${difficulty} case exists`)
    }
  }
})

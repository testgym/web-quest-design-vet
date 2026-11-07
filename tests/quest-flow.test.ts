import assert from 'node:assert/strict'
import test from 'node:test'
import { interactiveQuests } from '../src/data/activities.ts'
import type { Activity, ActivityRecord, CriterionResult, InteractiveQuest } from '../src/data/activities.ts'
import { buildInteractiveResult, isMasteryPractice, nextMasteryActivity, selectAdaptiveNext } from '../src/data/quest-flow.ts'

const quests = Object.values(interactiveQuests)
const mastery = quests.find((quest) => quest.mode === 'mastery')!
const adaptive = quests.find((quest) => quest.mode === 'adaptive')!
const bloom = quests.find((quest) => quest.mode === 'bloom')!

function criterion(met = true, mode: CriterionResult['mode'] = 'automatic'): CriterionResult {
  return { id: 'observable-action', label: 'Безпечна дія', met, detail: 'Результат практичної дії.', mode }
}

function record(activity: Activity, overrides: Partial<ActivityRecord> = {}): ActivityRecord {
  return {
    activityId: activity.id,
    title: activity.title,
    stage: activity.stage,
    kind: activity.kind,
    skill: activity.skill,
    difficulty: activity.difficulty,
    criteria: [criterion()],
    summary: 'Дії розібрано.',
    artifact: 'Власне рішення учня.',
    hintsUsed: 0,
    retries: 0,
    independent: true,
    ...overrides,
  }
}

function practicalRecords(quest: InteractiveQuest): ActivityRecord[] {
  return [...quest.activities, ...(quest.verification ?? [])]
    .filter((activity) => activity.kind !== 'briefing')
    .map((activity) => record(activity, { criteria: activity.kind === 'compose' ? [criterion(true, 'self')] : [criterion()] }))
}

function result(quest: InteractiveQuest, records: ActivityRecord[]) {
  return buildInteractiveResult({ quest, records, reflection: ' Мій висновок про безпечні дії та незалежну перевірку джерела під час практики. ', elapsedSeconds: 123.8 })
}

test('mastery interleaves every practice with its fresh verification before advancing skills', () => {
  let current: Activity | undefined = mastery.activities[0]
  const sequence: string[] = []
  while (current) {
    sequence.push(current.id)
    current = nextMasteryActivity(mastery, current.id)
  }
  const expected = mastery.activities.flatMap((activity, index) => [activity.id, mastery.verification![index]!.id])
  assert.deepEqual(sequence, expected)
  assert.equal(new Set(sequence).size, sequence.length)
  for (const activity of mastery.activities) {
    const next = nextMasteryActivity(mastery, activity.id)
    assert.ok(next)
    assert.equal(next.skill, activity.skill)
    assert.equal(next.support, 'none')
    assert.notEqual(next.id, activity.id)
    assert.equal(isMasteryPractice(mastery, activity.id), true)
    assert.equal(isMasteryPractice(mastery, next.id), false)
  }
  assert.equal(nextMasteryActivity(mastery, 'unknown'), undefined)
  assert.equal(nextMasteryActivity(bloom, bloom.activities[0]!.id), undefined)
})

test('adaptive success raises difficulty, errors lower it, and supported success retains the current level', () => {
  const current = adaptive.activities.find((activity) => activity.skill === 'recognition' && activity.difficulty === 'medium')!
  const records = { [current.id]: record(current) }
  const sequence = [current.id]
  const harder = selectAdaptiveNext(adaptive, sequence, records, current.id)
  assert.ok(harder)
  assert.equal(harder.difficulty, 'hard')
  assert.notEqual(harder.skill, current.skill)
  records[current.id] = record(current, { criteria: [criterion(false)] })
  assert.equal(selectAdaptiveNext(adaptive, sequence, records, current.id)?.difficulty, 'easy')
  records[current.id] = record(current, { hintsUsed: 1, independent: false })
  assert.equal(selectAdaptiveNext(adaptive, sequence, records, current.id)?.difficulty, 'medium')
})

test('adaptive difficulty stays within bounds and the next case is never reused', () => {
  for (const difficulty of ['easy', 'hard'] as const) {
    const current = adaptive.activities.find((activity) => activity.difficulty === difficulty)!
    const records = { [current.id]: record(current, { criteria: [criterion(difficulty === 'hard')] }) }
    const next = selectAdaptiveNext(adaptive, [current.id], records, current.id)
    assert.ok(next)
    assert.equal(next.difficulty, difficulty)
    assert.notEqual(next.id, current.id)
  }
  const last = adaptive.activities.at(-1)!
  const prior = adaptive.activities.slice(0, -1).map((activity) => activity.id)
  assert.equal(selectAdaptiveNext(adaptive, prior, {}, prior.at(-1)!)?.id, last.id)
  assert.equal(selectAdaptiveNext(adaptive, adaptive.activities.map((activity) => activity.id), {}, last.id), undefined)
})

test('five adaptive selections balance skills among cases at the requested level', () => {
  const first = adaptive.activities.find((activity) => activity.difficulty === 'medium')!
  const sequence = [first.id]
  const records: Record<string, ActivityRecord> = { [first.id]: record(first) }
  while (sequence.length < adaptive.targetCount) {
    const current = sequence.at(-1)!
    const next = selectAdaptiveNext(adaptive, sequence, records, current)
    assert.ok(next)
    assert.equal(sequence.includes(next.id), false)
    sequence.push(next.id)
    records[next.id] = record(next)
  }
  assert.equal(new Set(sequence.map((id) => records[id]!.skill)).size, 3)
  assert.equal(result(adaptive, Object.values(records)).completed, true)
})

test('mastery requires the exact complete route and every independent verification', () => {
  const records = practicalRecords(mastery)
  assert.equal(result(mastery, records).mastered, true)
  assert.equal(result(mastery, records).completed, true)
  const practiceOnly = records.filter((entry) => mastery.activities.some((activity) => activity.id === entry.activityId))
  assert.equal(result(mastery, practiceOnly).mastered, false)
  const missingPractice = records.filter((entry) => entry.activityId !== mastery.activities[0]!.id)
  assert.equal(result(mastery, missingPractice).score, 100)
  assert.equal(result(mastery, missingPractice).mastered, false)
  assert.equal(result(mastery, missingPractice).completed, false)
})

test('one failed verification prevents mastery even when the rounded aggregate score is 100', () => {
  const records = practicalRecords(mastery)
  for (const entry of records) {
    if (mastery.verification?.some((activity) => activity.id === entry.activityId)) {
      entry.criteria = Array.from({ length: 200 }, (_, index) => ({ ...criterion(), id: `criterion-${index}` }))
    }
  }
  const failed = records.find((entry) => entry.activityId === mastery.verification![0]!.id)!
  failed.criteria[0]!.met = false
  const assessment = result(mastery, records)
  assert.equal(assessment.score, 100)
  assert.equal(assessment.mastered, false)
  assert.equal(assessment.completed, false)
})

test('a supported or repeated verification cannot declare mastery despite correct actions', () => {
  for (const override of [{ hintsUsed: 1 }, { retries: 1 }, { independent: false }]) {
    const records = practicalRecords(mastery)
    Object.assign(records.find((entry) => entry.activityId === mastery.verification![0]!.id)!, override)
    const assessment = result(mastery, records)
    assert.equal(assessment.score, 100)
    assert.equal(assessment.mastered, false)
    assert.equal(assessment.completed, false)
  }
})

test('mastery score uses verification criteria while preserving training artifacts and self review', () => {
  const records = practicalRecords(mastery)
  const practice = records.find((entry) => entry.activityId === mastery.activities[0]!.id)!
  practice.criteria = [criterion(false), criterion(false, 'self')]
  const assessment = result(mastery, records)
  assert.equal(assessment.score, 100)
  assert.equal(assessment.total, mastery.verification!.length)
  assert.equal(assessment.records.length, records.length)
  assert.equal(assessment.artifacts.length, records.length)
  assert.equal(Object.values(assessment.bySkill).reduce((sum, bucket) => sum + bucket.total, 0), assessment.total)
  assert.equal(Object.values(assessment.byType).reduce((sum, bucket) => sum + bucket.total, 0), assessment.total)
})

test('missing earlier work cannot complete a regular route with perfect remaining criteria', () => {
  const records = practicalRecords(bloom)
  const missing = records.slice(1)
  const assessment = result(bloom, missing)
  assert.equal(assessment.score, 100)
  assert.equal(assessment.completed, false)
  assert.equal(result(bloom, [...missing, missing[0]!]).completed, false)
  assert.equal(result(bloom, [...missing, { ...missing[0]!, activityId: 'unknown' }]).completed, false)
  assert.equal(result(bloom, records).completed, true)
})

test('adaptive completion requires exactly five unique known practical records', () => {
  const five = adaptive.activities.slice(0, adaptive.targetCount).map((activity) => record(activity))
  assert.equal(result(adaptive, five).completed, true)
  assert.equal(result(adaptive, five.slice(1)).completed, false)
  assert.equal(result(adaptive, [...five.slice(1), five[1]!]).completed, false)
  assert.equal(result(adaptive, [...five.slice(1), { ...five[0]!, activityId: 'unknown' }]).completed, false)
  assert.equal(result(adaptive, [...five, record(adaptive.activities[adaptive.targetCount]!)]).completed, false)
})

test('self review never inflates automatic scoring and result building preserves input', () => {
  const records = practicalRecords(bloom)
  for (const entry of records) entry.criteria.push(criterion(true, 'self'))
  const before = structuredClone(records)
  const assessment = result(bloom, records)
  assert.deepEqual(records, before)
  assert.equal(assessment.total, bloom.activities.filter((activity) => activity.kind !== 'compose').length)
  assert.equal(assessment.elapsedSeconds, 123)
  assert.equal(assessment.reflection, 'Мій висновок про безпечні дії та незалежну перевірку джерела під час практики.')
  assert.match(assessment.learningNote, /зміст система автоматично не оцінює/)
  assert.equal(result(bloom, records).score, 100)
})

test('a remaining unsafe action prevents completion even with a rounded score of 100', () => {
  const records = practicalRecords(bloom)
  for (const entry of records) entry.criteria = Array.from({ length: 200 }, (_, index) => ({ ...criterion(), id: `criterion-${index}` }))
  const simulation = records.find((entry) => entry.kind === 'simulation')!
  simulation.criteria[0] = { ...criterion(false), id: 'unsafe-action', detail: 'Пароль передано сторонньому сайту.' }
  const assessment = result(bloom, records)
  assert.equal(assessment.score, 100)
  assert.equal(assessment.completed, false)
})

test('unfinished self review or reflection prevents completion without grading authored prose', () => {
  const records = practicalRecords(bloom)
  const compose = records.find((entry) => entry.kind === 'compose')!
  compose.criteria = [criterion(false, 'self')]
  assert.equal(result(bloom, records).completed, false)
  compose.criteria = [criterion(true, 'self')]
  assert.equal(buildInteractiveResult({ quest: bloom, records, reflection: 'коротко', elapsedSeconds: 0 }).completed, false)
  assert.equal(buildInteractiveResult({ quest: mastery, records: practicalRecords(mastery), reflection: 'коротко', elapsedSeconds: 0 }).mastered, false)
  assert.equal(result(bloom, records).completed, true)
})

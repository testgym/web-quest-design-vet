import type { Activity, ActivityRecord, Difficulty, InteractiveQuest, InteractiveResult } from './activities.ts'

const levels: Difficulty[] = ['easy', 'medium', 'hard']

function automaticCriteria(record: ActivityRecord) {
  return record.criteria.filter((criterion) => criterion.mode === 'automatic')
}

function independent(record: ActivityRecord): boolean {
  return record.independent && record.hintsUsed === 0 && record.retries === 0
}

/** Selects an unused case, balances skills, and adjusts challenge from observable performance. */
export function selectAdaptiveNext(
  quest: InteractiveQuest,
  sequence: string[],
  records: Record<string, ActivityRecord>,
  currentId: string,
): Activity | undefined {
  const available = quest.activities.filter((activity) => !sequence.includes(activity.id))
  if (!available.length) return undefined
  const current = quest.activities.find((activity) => activity.id === currentId)
  const record = records[currentId]
  const criteria = record ? automaticCriteria(record) : []
  const currentLevel = Math.max(0, levels.indexOf(current?.difficulty ?? 'medium'))
  const failed = criteria.some((criterion) => !criterion.met)
  const succeeded = criteria.length > 0 && !failed && record !== undefined && independent(record)
  const desiredLevel = Math.max(0, Math.min(levels.length - 1, currentLevel + (failed ? -1 : succeeded ? 1 : 0)))
  const skillCounts = new Map<string, number>()
  for (const id of sequence) {
    const activity = quest.activities.find((entry) => entry.id === id)
    if (activity) skillCounts.set(activity.skill, (skillCounts.get(activity.skill) ?? 0) + 1)
  }
  return [...available].sort((first, second) => {
    const firstDistance = Math.abs(levels.indexOf(first.difficulty ?? 'medium') - desiredLevel)
    const secondDistance = Math.abs(levels.indexOf(second.difficulty ?? 'medium') - desiredLevel)
    const challenge = firstDistance - secondDistance
    return challenge || (skillCounts.get(first.skill) ?? 0) - (skillCounts.get(second.skill) ?? 0)
  })[0]
}

export function isMasteryPractice(quest: InteractiveQuest, id: string): boolean {
  return quest.mode === 'mastery' && quest.activities.some((activity) => activity.id === id)
}

/** Practice is immediately followed by its fresh case before the next skill is introduced. */
export function nextMasteryActivity(quest: InteractiveQuest, currentId: string): Activity | undefined {
  if (quest.mode !== 'mastery') return undefined
  const practiceIndex = quest.activities.findIndex((activity) => activity.id === currentId)
  if (practiceIndex !== -1) return quest.verification?.[practiceIndex]
  const verificationIndex = quest.verification?.findIndex((activity) => activity.id === currentId) ?? -1
  return verificationIndex !== -1 ? quest.activities[verificationIndex + 1] : undefined
}

export interface BuildResultInput {
  quest: InteractiveQuest
  records: ActivityRecord[]
  reflection: string
  elapsedSeconds: number
}

export function buildInteractiveResult({ quest, records, reflection, elapsedSeconds }: BuildResultInput): InteractiveResult {
  const bank = [...quest.activities, ...(quest.verification ?? [])]
  const knownIds = new Set(bank.map((activity) => activity.id))
  const unique = new Map<string, ActivityRecord>()
  for (const record of records) {
    if (knownIds.has(record.activityId)) unique.set(record.activityId, record)
  }
  const scoredIds = new Set((quest.mode === 'mastery' ? quest.verification ?? [] : quest.activities)
    .filter((activity) => activity.kind !== 'briefing').map((activity) => activity.id))
  const scoredRecords = [...unique.values()].filter((record) => scoredIds.has(record.activityId))
  const bySkill: InteractiveResult['bySkill'] = {}
  const byType: InteractiveResult['byType'] = {}
  let correctCount = 0
  let total = 0
  for (const record of scoredRecords) {
    const criteria = automaticCriteria(record)
    const correct = criteria.filter((criterion) => criterion.met).length
    correctCount += correct
    total += criteria.length
    for (const [bucket, key] of [[bySkill, record.skill], [byType, record.kind]] as const) {
      const existing = bucket[key] ?? { correct: 0, total: 0 }
      bucket[key] = { correct: existing.correct + correct, total: existing.total + criteria.length }
    }
  }
  const score = total > 0 ? Math.round(correctCount / total * 100) : 0
  const required = bank.filter((activity) => activity.kind !== 'briefing')
  const routeComplete = quest.mode === 'adaptive'
    ? required.filter((activity) => unique.has(activity.id)).length === quest.targetCount
    : required.every((activity) => unique.has(activity.id))
  const verification = quest.verification ?? []
  const reflected = reflection.trim().length >= 40
  const mastered = quest.mode === 'mastery' && routeComplete && reflected && verification.length > 0 && verification.every((activity) => {
    const record = unique.get(activity.id)
    if (!record || !independent(record)) return false
    const criteria = automaticCriteria(record)
    return criteria.length > 0 && record.criteria.every((criterion) => criterion.met)
  })
  const everySubmittedCriterionMet = scoredRecords.every((record) => record.criteria.length > 0 && record.criteria.every((criterion) => criterion.met))
  const completed = quest.mode === 'mastery' ? mastered : routeComplete && reflected && everySubmittedCriterionMet
  const textNote = 'Письмові пояснення й авторські матеріали збережено для самоперевірки та обговорення з викладачем; їхній зміст система автоматично не оцінює.'
  const learningNote = quest.mode === 'mastery'
    ? `${mastered ? 'Кожну навичку підтверджено в новому самостійному випадку.' : 'Опанування потребує успішного першого самостійного рішення в кожному новому перевірочному випадку.'} Відсоток обчислено лише за діями у перевірочних випадках. ${textNote}`
    : quest.mode === 'adaptive'
      ? `Маршрут змінював складність за виконаними діями й підтримував роботу з різними навичками. Відсоток відображає критерії виконаних випадків і не є стандартизованим виміром здібностей. ${textNote}`
      : `Відсоток відображає виконання перевірюваних дій у практичних завданнях. ${textNote}`

  return {
    formatVersion: 'interactive-v2',
    methodId: quest.methodId,
    completedAt: new Date().toISOString(),
    elapsedSeconds: Number.isFinite(elapsedSeconds) ? Math.max(0, Math.floor(elapsedSeconds)) : 0,
    questMode: quest.mode,
    score,
    correctCount,
    total,
    answers: [],
    bySkill,
    byType,
    records: [...records],
    artifacts: records.filter((record) => record.artifact.trim()).map((record) => ({ title: record.title, text: record.artifact })),
    reflection: reflection.trim(),
    mastered,
    completed,
    supportCount: records.reduce((sum, record) => sum + Math.max(0, record.hintsUsed), 0),
    independentCount: records.filter(independent).length,
    learningNote,
  }
}

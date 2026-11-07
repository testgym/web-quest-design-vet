import type { Activity, ActivityDraft, CriterionResult } from './activities.ts'

export interface ActivityEvaluation {
  criteria: CriterionResult[]
  summary: string
  artifact: string
  ready: boolean
}

export function emptyDraft(): ActivityDraft {
  return {
    selectedEvidence: [],
    classification: {},
    actions: [],
    links: [],
    flagged: [],
    text: {},
    checks: [],
    triage: {},
  }
}

function automatic(id: string, label: string, met: boolean, detail: string): CriterionResult {
  return { id, label, met, detail, mode: 'automatic' }
}

function written(id: string, label: string, value: string | undefined, minimum: number): CriterionResult {
  const met = (value?.trim().length ?? 0) >= minimum
  return {
    id,
    label,
    met,
    mode: 'self',
    detail: met
      ? 'Текст додано. Система перевіряє лише його наявність та мінімальний обсяг; зміст перевірте за умовою завдання.'
      : `Додайте власний текст обсягом щонайменше ${minimum} символів без пробілів на початку та в кінці.`,
  }
}

function knownSelection(id: string, values: string[], knownIds: string[]): CriterionResult[] {
  if (values.every((value) => knownIds.includes(value))) return []
  return [automatic(id, 'Доступні елементи завдання', false, 'У рішенні є елемент, якого немає в цьому завданні. Оновіть вибір.')]
}

function choiceList(values: string[], labels: { id: string; label: string }[]): string {
  return values.length
    ? values.map((id) => `• ${labels.find((entry) => entry.id === id)?.label ?? `Невідомий елемент: ${id}`}`).join('\n')
    : 'Не обрано.'
}

function ownText(value: string | undefined): string {
  return value?.trim() || 'Текст ще не додано.'
}

/** Evaluates observable choices only. Free text is retained for reflection, never semantically graded. */
export function evaluateActivity(activity: Activity, draft: ActivityDraft): ActivityEvaluation {
  const criteria: CriterionResult[] = []
  let ready = false
  let artifact = ''
  let incomplete = 'Завершіть практичні дії перед перевіркою.'

  switch (activity.kind) {
    case 'briefing':
      return { criteria: [], summary: activity.feedback, artifact: '', ready: true }

    case 'classify': {
      ready = activity.items.every((item) => Boolean(draft.classification[item.id]?.trim()))
      incomplete = 'Розмістіть кожну картку в одній із категорій.'
      for (const item of activity.items) {
        const selected = draft.classification[item.id]
        criteria.push(automatic(
          `classify:${item.id}`,
          item.label,
          selected === item.group,
          selected === item.group ? 'Картку розміщено у відповідній категорії.' : 'Перегляньте призначення картки та обрану категорію.',
        ))
      }
      criteria.push(...knownSelection('classify:known', Object.keys(draft.classification), activity.items.map((item) => item.id)))
      artifact = activity.items.map((item) => {
        const group = activity.groups.find((entry) => entry.id === draft.classification[item.id])
        return `• ${item.label} → ${group?.label ?? 'Категорію не визначено'}`
      }).join('\n')
      break
    }

    case 'evidence': {
      const reason = written('evidence:reason', 'Власне пояснення доказів', draft.text.reason, 30)
      ready = draft.selectedEvidence.length > 0 && reason.met
      incomplete = 'Позначте докази та поясніть свій висновок щонайменше 30 символами.'
      for (const evidence of activity.evidence) {
        const selected = draft.selectedEvidence.includes(evidence.id)
        const met = selected === evidence.essential
        criteria.push(automatic(
          `evidence:${evidence.id}`,
          evidence.label,
          met,
          met
            ? selected ? 'Ви використали суттєвий доказ.' : 'Ви не використали цю деталь як доказ загрози.'
            : selected ? 'Ця деталь сама по собі не доводить загрозу. Перевірте її зв’язок із запитом у повідомленні.' : 'Суттєвий доказ залишився непозначеним. Уважно дослідіть повідомлення.',
        ))
      }
      criteria.push(...knownSelection('evidence:known', draft.selectedEvidence, activity.evidence.map((entry) => entry.id)), reason)
      artifact = `Обрані докази:\n${choiceList(draft.selectedEvidence, activity.evidence)}\n\nМоє пояснення:\n${ownText(draft.text.reason)}`
      break
    }

    case 'simulation': {
      ready = draft.actions.length > 0
      incomplete = 'Виконайте хоча б одну дію в симуляторі.'
      for (const id of activity.requiredActions) {
        const tool = activity.tools.find((entry) => entry.id === id)
        const met = draft.actions.includes(id)
        criteria.push(automatic(`action:${id}`, tool?.label ?? id, met, met ? 'Необхідну дію виконано.' : 'Ця дія потрібна для безпечного завершення ситуації.'))
      }
      const forbidden = new Set([...activity.forbiddenActions, ...activity.tools.filter((tool) => !tool.safe).map((tool) => tool.id)])
      for (const id of forbidden) {
        const tool = activity.tools.find((entry) => entry.id === id)
        const met = !draft.actions.includes(id)
        criteria.push(automatic(`avoid:${id}`, `Безпечне рішення: ${tool?.label ?? id}`, met, met ? 'Небезпечну дію не виконано.' : tool?.effect ?? 'Ця дія створює ризик. Перегляньте свій план.'))
      }
      for (const dependency of activity.dependencies ?? []) {
        const before = draft.actions.indexOf(dependency.before)
        const after = draft.actions.indexOf(dependency.after)
        const met = before !== -1 && after !== -1 && before < after
        const beforeLabel = activity.tools.find((entry) => entry.id === dependency.before)?.label ?? dependency.before
        const afterLabel = activity.tools.find((entry) => entry.id === dependency.after)?.label ?? dependency.after
        criteria.push(automatic(`order:${dependency.before}>${dependency.after}`, 'Послідовність безпечних дій', met, met ? `${beforeLabel} виконано перед дією «${afterLabel}».` : `Спочатку виконайте «${beforeLabel}», потім «${afterLabel}».`))
      }
      criteria.push(...knownSelection('actions:known', draft.actions, activity.tools.map((tool) => tool.id)))
      artifact = `Журнал моїх дій:\n${draft.actions.map((id, index) => `${index + 1}. ${activity.tools.find((tool) => tool.id === id)?.label ?? `Невідома дія: ${id}`}`).join('\n') || 'Дій ще немає.'}`
      break
    }

    case 'map': {
      const reason = written('map:reason', 'Власне пояснення зв’язків', draft.text.reason, 30)
      ready = draft.links.length > 0 && reason.met
      incomplete = 'Створіть зв’язки та поясніть їх щонайменше 30 символами.'
      const expected = activity.links.map((link) => `${link.from}>${link.to}`)
      for (const link of activity.links) {
        const id = `${link.from}>${link.to}`
        const met = draft.links.includes(id)
        criteria.push(automatic(`link:${id}`, link.label, met, met ? 'Цей причинний зв’язок установлено.' : 'Цей зв’язок ще не встановлено. Перевірте, як доказ пов’язаний із ризиком або захисною дією.'))
      }
      const extra = draft.links.filter((link) => !expected.includes(link))
      criteria.push(automatic('map:extra', 'Обґрунтовані зв’язки', extra.length === 0, extra.length === 0 ? 'Зайвих зв’язків немає.' : 'Є зв’язки, які не випливають із цього кейсу. Перевірте напрямок і причинний зв’язок між вузлами.'))
      criteria.push(reason)
      artifact = `Мої зв’язки:\n${draft.links.map((link) => {
        const [from, to] = link.split('>')
        return `• ${activity.nodes.find((node) => node.id === from)?.label ?? from} → ${activity.nodes.find((node) => node.id === to)?.label ?? to}`
      }).join('\n') || 'Зв’язків ще немає.'}\n\nМоє пояснення:\n${ownText(draft.text.reason)}`
      break
    }

    case 'review': {
      const revision = written('review:revision', 'Моя редакція плану', draft.text.revision, 40)
      ready = draft.flagged.length > 0 && revision.met
      incomplete = 'Позначте кроки для виправлення та напишіть свою редакцію щонайменше 40 символами.'
      for (const step of activity.plan) {
        const flagged = draft.flagged.includes(step.id)
        const met = flagged === step.needsRevision
        criteria.push(automatic(`review:${step.id}`, step.text, met, met ? flagged ? 'Проблемний крок виявлено.' : 'Обґрунтований крок збережено.' : flagged ? 'Цей крок уже є доречним у наведеній ситуації.' : 'Цей крок потребує виправлення. Перевірте, чи не створює він ризику.'))
      }
      criteria.push(...knownSelection('review:known', draft.flagged, activity.plan.map((step) => step.id)), revision)
      artifact = `Кроки, які я виправляю:\n${choiceList(draft.flagged, activity.plan.map((step) => ({ id: step.id, label: step.text })))}\n\nМоя редакція:\n${ownText(draft.text.revision)}`
      break
    }

    case 'compose': {
      const sections = activity.sections.map((section) => written(`text:${section.id}`, section.label, draft.text[section.id], section.minLength))
      const checks = activity.checklist.map((check): CriterionResult => ({
        id: `self:${check.id}`,
        label: check.label,
        met: draft.checks.includes(check.id),
        mode: 'self',
        detail: draft.checks.includes(check.id) ? 'Ви підтвердили цей критерій самоперевірки. Система не оцінює зміст тексту.' : 'Перевірте свій матеріал за цим критерієм і позначте його після перевірки.',
      }))
      ready = sections.every((section) => section.met) && checks.every((check) => check.met)
      incomplete = 'Заповніть усі частини власного матеріалу та виконайте самоперевірку за кожним критерієм.'
      criteria.push(...sections, ...checks, ...knownSelection('compose:known', draft.checks, activity.checklist.map((check) => check.id)))
      artifact = activity.sections.map((section) => `${section.label}:\n${ownText(draft.text[section.id])}`).join('\n\n')
      artifact += `\n\nМоя самоперевірка:\n${choiceList(draft.checks, activity.checklist)}`
      break
    }

    case 'triage': {
      ready = activity.messages.every((message) => Boolean(draft.triage[message.id]?.trim()))
      incomplete = 'Визначте дію для кожного повідомлення в робочій скриньці.'
      const dispositions: Record<string, string> = { routine: 'Опрацювати звичайно', verify: 'Перевірити незалежним каналом', report: 'Повідомити про загрозу' }
      for (const message of activity.messages) {
        const met = draft.triage[message.id] === message.disposition
        criteria.push(automatic(`triage:${message.id}`, message.subject, met, met ? 'Вибрана дія відповідає даним цього повідомлення.' : 'Перевірте адресу, зміст запиту та доступний незалежний канал перед вибором дії.'))
      }
      criteria.push(...knownSelection('triage:known', Object.keys(draft.triage), activity.messages.map((message) => message.id)))
      artifact = activity.messages.map((message) => `• ${message.subject}: ${dispositions[draft.triage[message.id] ?? ''] ?? 'Дію не визначено'}`).join('\n')
      break
    }
  }

  const checkedActions = criteria.filter((criterion) => criterion.mode === 'automatic')
  const automaticPassed = checkedActions.every((criterion) => criterion.met)
  const selfReview = criteria.some((criterion) => criterion.mode === 'self')
  const summary = !ready
    ? incomplete
    : automaticPassed
      ? `${checkedActions.length ? 'Перевірювані дії виконано.' : 'Авторський матеріал додано та самоперевірку позначено.'}${selfReview ? ' Зміст власного тексту перевірте за критеріями завдання.' : ''} ${activity.feedback}`
      : `Є дії, які потрібно переглянути. Скористайтеся поясненнями біля кожного критерію.${selfReview ? ' Власний текст потребує вашої змістової самоперевірки.' : ''}`

  return { criteria, summary, artifact, ready }
}

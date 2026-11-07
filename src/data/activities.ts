import type { QuestMode } from './methods'

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface ActivityBase {
  id: string
  stage: string
  title: string
  objective: string
  briefing: string
  skill: string
  feedback: string
  difficulty?: Difficulty
  hints?: string[]
  support?: 'full' | 'fading' | 'none'
}

export interface ClassificationActivity extends ActivityBase {
  kind: 'classify'
  groups: { id: string; label: string }[]
  items: { id: string; label: string; group: string }[]
}

export interface EvidenceActivity extends ActivityBase {
  kind: 'evidence'
  mail: { from: string; subject: string; body: string; url: string }
  evidence: { id: string; label: string; detail: string; essential: boolean }[]
  reasonPrompt: string
}

export interface SimulationActivity extends ActivityBase {
  kind: 'simulation'
  tools: { id: string; label: string; detail: string; effect: string; safe: boolean }[]
  requiredActions: string[]
  forbiddenActions: string[]
  dependencies?: { before: string; after: string }[]
}

export interface MapActivity extends ActivityBase {
  kind: 'map'
  nodes: { id: string; label: string; type: 'evidence' | 'risk' | 'action' }[]
  links: { from: string; to: string; label: string }[]
}

export interface ReviewActivity extends ActivityBase {
  kind: 'review'
  plan: { id: string; text: string; needsRevision: boolean }[]
  revisionPrompt: string
}

export interface ComposeActivity extends ActivityBase {
  kind: 'compose'
  sections: { id: string; label: string; prompt: string; minLength: number }[]
  checklist: { id: string; label: string }[]
}

export interface BriefingActivity extends ActivityBase {
  kind: 'briefing'
  panels: { title: string; text: string }[]
  demonstration?: { label: string; detail: string }[]
  reflectPrevious?: boolean
}

export interface TriageActivity extends ActivityBase {
  kind: 'triage'
  messages: {
    id: string
    from: string
    subject: string
    body: string
    url: string
    disposition: 'routine' | 'verify' | 'report'
  }[]
}

export type Activity = ClassificationActivity | EvidenceActivity | SimulationActivity | MapActivity | ReviewActivity | ComposeActivity | BriefingActivity | TriageActivity

export interface ActivityDraft {
  selectedEvidence: string[]
  classification: Record<string, string>
  actions: string[]
  links: string[]
  flagged: string[]
  text: Record<string, string>
  checks: string[]
  triage: Record<string, string>
}

export interface CriterionResult {
  id: string
  label: string
  met: boolean
  detail: string
  mode: 'automatic' | 'self'
}

export interface ActivityRecord {
  activityId: string
  title: string
  stage: string
  kind: Activity['kind']
  skill: string
  criteria: CriterionResult[]
  summary: string
  artifact: string
  hintsUsed: number
  retries: number
  independent: boolean
  difficulty?: Difficulty
}

export interface InteractiveResult {
  formatVersion: 'interactive-v2'
  methodId: string
  completedAt: string
  elapsedSeconds: number
  questMode: QuestMode
  score: number
  correctCount: number
  total: number
  answers: unknown[]
  bySkill: Record<string, { correct: number; total: number }>
  byType: Record<string, { correct: number; total: number }>
  records: ActivityRecord[]
  artifacts: { title: string; text: string }[]
  reflection: string
  mastered: boolean
  completed: boolean
  supportCount: number
  independentCount: number
  learningNote: string
}

export interface InteractiveQuest {
  methodId: string
  mode: QuestMode
  title: string
  subtitle: string
  mission: string
  briefing: string
  strategy: string
  tool: string
  learningOutcome: string
  stageCount: number
  targetCount: number
  activities: Activity[]
  verification?: Activity[]
}

const bloom: InteractiveQuest = {
  methodId: 'bloom-taxonomy', mode: 'bloom',
  title: 'Бюро цифрової безпеки',
  subtitle: 'Шість способів мислення · один власний протокол',
  mission: 'Підготуйте майстерню до підозрілого повідомлення про виробничу практику: дослідіть матеріали, перевірте рішення й створіть інструкцію для своєї групи.',
  briefing: 'Ви черговий із цифрової безпеки у навчальній майстерні. Група користується порталом praktika.example. Майстер повідомив: пароль і код входу нікому не передаємо; зміни розкладу перевіряємо у порталі або за номером із довідника закладу. Усі адреси тут — вигадані навчальні макети.',
  strategy: 'Від пригадування правил до створення власного продукту. Кожний етап вимагає іншої розумової дії; результатом буде ваша інструкція, яку можна обговорити з викладачем.',
  tool: 'Конструктор протоколу',
  learningOutcome: 'Обґрунтувати рішення доказами та створити придатну для майстерні інструкцію реагування.',
  stageCount: 6, targetCount: 6,
  activities: [
    {
      id: 'bloom-remember', kind: 'classify', stage: 'Пригадати',
      title: 'Сейф робочого акаунта',
      objective: 'Пригадати, які дані відкривають доступ до робочого акаунта.',
      briefing: 'Перед початком зміни розкладіть картки за правилом майстерні: секрети входу не передаємо, звичайні організаційні відомості можна використати в оголошенні.',
      skill: 'recognition', difficulty: 'easy',
      groups: [{ id: 'secret', label: 'Секрет входу · залишити в сейфі' }, { id: 'public', label: 'Організаційна інформація · для оголошення' }],
      items: [
        { id: 'b-code', label: 'Одноразовий код входу', group: 'secret' },
        { id: 'b-time', label: 'Час початку практики: 08:30', group: 'public' },
        { id: 'b-pass', label: 'Пароль до порталу практики', group: 'secret' },
        { id: 'b-room', label: 'Номер навчальної майстерні', group: 'public' },
        { id: 'b-backup', label: 'Резервний код відновлення доступу', group: 'secret' },
        { id: 'b-site', label: 'Адреса загальнодоступної сторінки закладу', group: 'public' },
      ],
      feedback: 'Пароль, одноразовий і резервний коди дозволяють отримати доступ до акаунта. Час заняття, номер майстерні й публічна адреса самі по собі такого доступу не дають.',
    },
    {
      id: 'bloom-understand', kind: 'evidence', stage: 'Зрозуміти',
      title: 'Лист із печаткою майстра',
      objective: 'Пояснити, чому знайомий вигляд повідомлення не підтверджує його справжність.',
      briefing: 'Дослідіть лист. Позначте лише деталі, які потребують безпечної перевірки, й поясніть їх своїми словами. Офіційний портал групи: praktika.example.',
      skill: 'recognition', difficulty: 'medium',
      mail: { from: 'Майстер виробничого навчання <grafik@praktika-update.example>', subject: 'Термінове підтвердження місця практики', body: 'Група ЕМ-21, ваші місця на практиці будуть скасовані через 15 хвилин. Відкрийте «Підтвердити практику» та введіть пароль і код входу. На листі є логотип нашого закладу.', url: 'https://praktika-update.example/confirm' },
      evidence: [
        { id: 'b-domain', label: 'Адреса сторінки', detail: 'Адреса кнопки: https://praktika-update.example/confirm.', essential: true },
        { id: 'b-logo', label: 'Логотип закладу', detail: 'У верхній частині повідомлення — логотип навчального закладу.', essential: false },
        { id: 'b-urgent', label: '15 хвилин до скасування', detail: '«Ваші місця на практиці будуть скасовані через 15 хвилин».', essential: true },
        { id: 'b-group', label: 'Номер вашої групи', detail: 'Повідомлення починається зі звертання «Група ЕМ-21».', essential: false },
        { id: 'b-secrets', label: 'Пароль і код входу', detail: '«Відкрийте “Підтвердити практику” та введіть пароль і код входу».', essential: true },
      ],
      reasonPrompt: 'Поясніть зв’язок між адресою, запитом даних і тиском часу. Чому логотип не знімає ці ризики?',
      feedback: 'Найсильніші підстави для перевірки — інший домен, збір секретів і тиск часу. Логотип та назва групи не є доказами справжності. Навіть без цих ознак незвичний запит слід перевірити відомим каналом.',
    },
    {
      id: 'bloom-apply', kind: 'simulation', stage: 'Застосувати',
      title: 'Розклад без небезпечного переходу',
      objective: 'Застосувати правило незалежної перевірки в робочій ситуації.',
      briefing: 'Ви отримали лист із попереднього етапу, але пароль ще не вводили. Потрібно з’ясувати розклад, зберегти докази й повідомити відповідального. Побудуйте власний порядок дій у робочій панелі.',
      skill: 'verification', difficulty: 'medium',
      tools: [
        { id: 'b-open-known', label: 'Відкрити збережений портал', detail: 'Збережена адреса: praktika.example.', effect: 'У відомому порталі є звичайний розклад; вимоги підтвердити пароль немає.', safe: true },
        { id: 'b-use-link', label: 'Перейти за кнопкою з листа', detail: 'Кнопка веде на praktika-update.example.', effect: 'Ви переходите на неперевірену сторінку, яка збирає секрети.', safe: false },
        { id: 'b-save', label: 'Зберегти лист як доказ', detail: 'Зберігаються адреса відправника, час і текст без паролів.', effect: 'У журналі з’явився запис для відповідального за безпеку.', safe: true },
        { id: 'b-contact', label: 'Зв’язатися з майстром із довідника', detail: 'Номер узято зі службового довідника, не з підозрілого листа.', effect: 'Майстер підтвердив: цей запит заклад не надсилав.', safe: true },
        { id: 'b-send-code', label: 'Відповісти кодом входу', detail: 'Лист просить код «для звірки списку».', effect: 'Стороння особа може використати код для входу.', safe: false },
        { id: 'b-report', label: 'Надіслати службове повідомлення', detail: 'До повідомлення буде додано збережений доказ і результат перевірки.', effect: 'Відповідальний отримав перевірені відомості, групу можна попередити.', safe: true },
      ],
      requiredActions: ['b-open-known', 'b-save', 'b-contact', 'b-report'],
      forbiddenActions: ['b-use-link', 'b-send-code'],
      dependencies: [{ before: 'b-save', after: 'b-report' }, { before: 'b-contact', after: 'b-report' }],
      feedback: 'Розклад перевірено через відомий портал, особу — відомим контактом. Збереження листа й перевірка дають матеріал для службового повідомлення. Пароль або код у лист не надсилають.',
    },
    {
      id: 'bloom-analyze', kind: 'map', stage: 'Проаналізувати',
      title: 'Як працює пастка',
      objective: 'Показати причинні зв’язки між деталями листа, ризиками й захисними діями.',
      briefing: 'Колега запитує: «Чому саме цей лист небезпечний?» З’єднайте кожний доказ із його наслідком, а кожний ризик — із дією, яка його зменшує.',
      skill: 'analysis', difficulty: 'hard',
      nodes: [
        { id: 'b-url', label: 'Кнопка веде на сторонній домен', type: 'evidence' },
        { id: 'b-clock', label: 'Погроза скасування за 15 хвилин', type: 'evidence' },
        { id: 'b-theft', label: 'Секрети можуть потрапити сторонній особі', type: 'risk' },
        { id: 'b-rush', label: 'Поспішне рішення без перевірки', type: 'risk' },
        { id: 'b-bookmark', label: 'Відкрити портал зі збереженої адреси', type: 'action' },
        { id: 'b-independent', label: 'Перевірити вимогу через відомий контакт', type: 'action' },
      ],
      links: [
        { from: 'b-url', to: 'b-theft', label: 'Введення секретів на цій сторінці створює ризик викрадення' },
        { from: 'b-clock', to: 'b-rush', label: 'Тиск часу зменшує ймовірність перевірки' },
        { from: 'b-theft', to: 'b-bookmark', label: 'Відомий портал дозволяє обійти сторінку збору секретів' },
        { from: 'b-rush', to: 'b-independent', label: 'Незалежна перевірка зупиняє поспішну дію' },
      ],
      feedback: 'Аналіз пояснює механізм: сторонній домен створює ризик збору секретів, а терміновість — поспішної реакції. Для кожного ризику потрібна відповідна захисна дія.',
    },
    {
      id: 'bloom-evaluate', kind: 'review', stage: 'Оцінити',
      title: 'Аудит плану бригади',
      objective: 'Оцінити чужий план за критеріями: секретність, незалежність перевірки та збереження доказів.',
      briefing: 'Бригадир підготував план реагування. Позначте кроки, які порушують критерії, та напишіть безпечні заміни. Оцінюйте дію, а не переконливість її формулювання.',
      skill: 'analysis', difficulty: 'hard',
      plan: [
        { id: 'b-p1', text: 'Зберегти лист і його адресу, приховавши особисті дані перед показом групі.', needsRevision: false },
        { id: 'b-p2', text: 'Зателефонувати за номером із цього листа: так швидше отримаємо підтвердження.', needsRevision: true },
        { id: 'b-p3', text: 'Перевірити розклад у відомому порталі, відкривши збережену адресу.', needsRevision: false },
        { id: 'b-p4', text: 'Для перестрахування надіслати одноразовий код людині, що назвалася адміністратором.', needsRevision: true },
        { id: 'b-p5', text: 'Передати відповідальному опис запиту та збережений доказ через службовий канал.', needsRevision: false },
      ],
      revisionPrompt: 'Для кожного позначеного кроку запропонуйте заміну й назвіть критерій, який вона виконує.',
      feedback: 'Контакт із підозрілого листа не забезпечує незалежної перевірки: потрібен довідник або відомий сайт. Одноразовий код є секретом входу; його не передають іншій особі.',
    },
    {
      id: 'bloom-create', kind: 'compose', stage: 'Створити',
      title: 'Ваш протокол для майстерні',
      objective: 'Створити власну інструкцію з урахуванням потреб здобувачів професійної освіти.',
      briefing: 'Напишіть коротку інструкцію, яку ваша бригада зможе застосувати під час практики. Додайте конкретний службовий канал закладу або залиште зрозуміле поле для нього. Текст збережеться у вашому портфоліо.',
      skill: 'creation', difficulty: 'hard',
      sections: [
        { id: 'recognize', label: 'Коли зупинитися', prompt: 'Опишіть щонайменше дві ситуації або ознаки, за яких бригада має зупинити дію й перевірити запит.', minLength: 70 },
        { id: 'verify', label: 'Як перевірити', prompt: 'Дайте конкретні кроки: де взяти відому адресу або контакт і що саме звірити.', minLength: 70 },
        { id: 'respond', label: 'Що робити після інциденту', prompt: 'Розрізніть підозрілий лист без введення даних і випадок, коли пароль уже введено. Вкажіть, кого повідомити.', minLength: 100 },
      ],
      checklist: [
        { id: 'b-own', label: 'Інструкція написана моїми словами й адресована бригаді.' },
        { id: 'b-channel', label: 'Перевірка використовує відомий канал, а пароль і код нікому не передаються.' },
        { id: 'b-incident', label: 'Є окремі дії після введення пароля: захист акаунта через відомий сервіс і повідомлення відповідального.' },
        { id: 'b-usable', label: 'Інший учасник зможе виконати кроки без додаткових здогадок.' },
      ],
      feedback: 'Ви створили авторський продукт. Система перевіряє наявність розділів і вашу самоперевірку; зміст, безпечність та придатність інструкції потрібно обговорити з викладачем за наведеними критеріями.',
    },
  ],
}

const mastery: InteractiveQuest = {
  methodId: 'mastery-learning', mode: 'mastery',
  title: 'Допуск до цифрової зміни',
  subtitle: 'Практика → корекція → новий випадок',
  mission: 'Опануйте три навички для роботи з порталом практики: знайти суттєвий ризик, незалежно перевірити запит і захистити акаунт після витоку пароля.',
  briefing: 'Ви готуєтеся до роботи на спільному комп’ютері майстерні. Критерій допуску для цього тренажера: виконати всі обов’язкові безпечні дії й уникнути небезпечних у новому випадку для кожної навички. Після помилки ви отримаєте інше пояснення та нову практику; час навчання не обмежено.',
  strategy: 'Кожна навичка має власний цикл: практична дія, пояснення конкретної прогалини та перевірка на новому матеріалі. Успіх одного кроку не компенсує небезпечну дію в іншому.',
  tool: 'Лабораторія опанування',
  learningOutcome: 'Самостійно виконати безпечне реагування у трьох нових робочих ситуаціях.',
  stageCount: 3, targetCount: 6,
  activities: [
    {
      id: 'mastery-recognition', kind: 'evidence', stage: 'Навичка 1 · розпізнавання',
      title: 'Непроханий лист про допуск',
      objective: 'Відокремити небезпечний запит від звичайного оформлення повідомлення.',
      briefing: 'Офіційний портал закладу: praktika.example. Дослідіть лист і позначте всі суттєві причини зупинитися. Не позначайте звичайні деталі лише через те, що вони є в листі.',
      skill: 'recognition', difficulty: 'medium', support: 'full',
      mail: { from: 'Відділ практики <dopusk@praktika-access.example>', subject: 'Допуск до майстерні на завтра', body: 'Початок о 08:30. Щоб отримати допуск, введіть пароль порталу на сторінці нижче. Ми зберегли для вас місце у бригаді № 2.', url: 'https://praktika-access.example/admission' },
      evidence: [
        { id: 'm1-time', label: 'Початок о 08:30', detail: 'У першому рядку листа: «Початок о 08:30».', essential: false },
        { id: 'm1-domain', label: 'praktika-access.example', detail: 'Адреса кнопки: https://praktika-access.example/admission.', essential: true },
        { id: 'm1-password', label: 'Потрібно ввести пароль', detail: '«Щоб отримати допуск, введіть пароль порталу на сторінці нижче».', essential: true },
        { id: 'm1-team', label: 'Бригада № 2', detail: '«Ми зберегли для вас місце у бригаді № 2».', essential: false },
      ],
      reasonPrompt: 'Які дві деталі разом пояснюють ризик? Вкажіть безпечний спосіб перевірити допуск.',
      hints: ['Уявіть пароль як ключ: адреса сторінки показує, кому ви збираєтеся його віддати.', 'Зіставте повні домени: praktika.example та praktika-access.example — різні адреси. Час заняття не змінює цього.'],
      feedback: 'Корекція: перевіряйте не назву відділу, а повний домен і запитувані дані. Інша адреса разом із вимогою пароля створює конкретний ризик; допуск звіряють у відомому порталі.',
    },
    {
      id: 'mastery-verification', kind: 'simulation', stage: 'Навичка 2 · незалежна перевірка',
      title: 'Нова адреса для графіка',
      objective: 'Перевірити незвичний робочий запит через незалежні від нього джерела.',
      briefing: 'У чаті майстерні хтось від імені координатора просить увійти на grafik-fast.example. Пароль ще не вводили. У вашій панелі є збережений портал і довідник закладу. Перевірте вимогу та зафіксуйте результат.',
      skill: 'verification', difficulty: 'medium', support: 'full',
      tools: [
        { id: 'm2-known', label: 'Відкрити збережений портал', detail: 'Адреса зі списку закладу: praktika.example.', effect: 'У розділі графіка немає оголошення про новий сервіс.', safe: true },
        { id: 'm2-chat', label: 'Попросити автора чату підтвердити себе', detail: 'Ви залишаєтесь у тому самому неперевіреному каналі.', effect: 'Автор запевняє, що все офіційно, але незалежного підтвердження немає.', safe: false },
        { id: 'm2-directory', label: 'Зв’язатися з координатором із довідника', detail: 'Відомий контакт зі службового довідника закладу.', effect: 'Координатор заперечив надсилання цього запиту.', safe: true },
        { id: 'm2-log', label: 'Записати результат перевірки', detail: 'Фіксуєте джерело, час та отримане підтвердження.', effect: 'У журналі є результат, який можна передати майстру.', safe: true },
        { id: 'm2-link', label: 'Увійти за адресою з чату', detail: 'grafik-fast.example не перевірено.', effect: 'Ви віддаєте пароль неперевіреному сайту.', safe: false },
      ],
      requiredActions: ['m2-known', 'm2-directory', 'm2-log'], forbiddenActions: ['m2-chat', 'm2-link'],
      dependencies: [{ before: 'm2-directory', after: 'm2-log' }],
      hints: ['Незалежне джерело — таке, яке ви знали до отримання підозрілого повідомлення.', 'Знайдіть адресу у збережених посиланнях і контакт у довіднику. Відповідь автора того самого чату не є перевіркою його особи.'],
      feedback: 'Корекція: перепитати підозрілого автора — замкнути коло перевірки. Відомий портал і контакт із довідника дають незалежні відомості. Записують результат після отримання відповіді.',
    },
    {
      id: 'mastery-recovery', kind: 'simulation', stage: 'Навичка 3 · захист після витоку',
      title: 'Пароль уже введено',
      objective: 'Виконати основні дії захисту після розкриття пароля.',
      briefing: 'Колега ввів пароль до порталу практики на сторонній сторінці. Доступ до справжнього порталу ще є, завантажень не було, інших акаунтів із цим паролем немає. Допоможіть захистити акаунт і повідомити відповідального.',
      skill: 'recovery', difficulty: 'hard', support: 'full',
      tools: [
        { id: 'm3-known', label: 'Відкрити справжній портал', detail: 'Використовуєте збережену адресу praktika.example.', effect: 'Відкрито справжню панель безпеки акаунта.', safe: true },
        { id: 'm3-password', label: 'Змінити пароль у панелі безпеки', detail: 'Новий пароль буде унікальним.', effect: 'Старий пароль більше не підходить для нового входу.', safe: true },
        { id: 'm3-sessions', label: 'Завершити інші сеанси', detail: 'Відкликаєте активні входи на інших пристроях.', effect: 'Можливі сторонні активні сеанси закрито.', safe: true },
        { id: 'm3-mfa', label: 'Увімкнути додатковий захист входу', detail: 'Відомий портал пропонує багатофакторний захист.', effect: 'Для наступного входу потрібен додатковий фактор.', safe: true },
        { id: 'm3-report', label: 'Повідомити відповідального', detail: 'Описуєте час, сайт і введені типи даних без самого пароля.', effect: 'Заклад може перевірити журнал входів і попередити групу.', safe: true },
        { id: 'm3-delete', label: 'Видалити лист і забути', detail: 'Старий пароль залишиться чинним.', effect: 'Видалення листа не відкликає розкритий пароль.', safe: false },
        { id: 'm3-reply', label: 'Попросити сайт видалити пароль', detail: 'Ви пишете тому самому неперевіреному джерелу.', effect: 'Немає підстав вважати, що секрет видалено.', safe: false },
      ],
      requiredActions: ['m3-known', 'm3-password', 'm3-sessions', 'm3-mfa', 'm3-report'], forbiddenActions: ['m3-delete', 'm3-reply'],
      dependencies: [{ before: 'm3-known', after: 'm3-password' }, { before: 'm3-known', after: 'm3-sessions' }, { before: 'm3-known', after: 'm3-mfa' }],
      hints: ['Після витоку потрібно захистити сам акаунт; видалення повідомлення не змінює його налаштування.', 'Через відомий портал змініть пароль, відкличте інші сеанси й посильте вхід. Повідомлення відповідальному доповнює ці дії.'],
      feedback: 'Корекція: зміна пароля зупиняє нові входи зі старим секретом, завершення сеансів відкликає вже активні входи, додатковий фактор посилює наступні входи. Дії виконують у справжньому сервісі й повідомляють відповідального.',
    },
  ],
  verification: [
    {
      id: 'mastery-recognition-check', kind: 'evidence', stage: 'Навичка 1 · новий випадок',
      title: 'Перевірка: повідомлення про спецодяг',
      objective: 'Самостійно впізнати ту саму небезпеку в іншому сюжеті.',
      briefing: 'Офіційний портал: praktika.example. У новому повідомленні немає погроз і помилок. Позначте суттєві ризики й поясніть рішення.',
      skill: 'recognition', difficulty: 'medium', support: 'none',
      mail: { from: 'Комірник <form@workwear-login.example>', subject: 'Розмір спецодягу для практики', body: 'Добрий день! Оберіть розмір спецодягу до п’ятниці. Для доступу до форми введіть пароль від порталу практики на нашій сторінці. Дякуємо за співпрацю.', url: 'https://workwear-login.example/size' },
      evidence: [
        { id: 'mv1-polite', label: 'Ввічливий тон', detail: 'Лист містить слова «Добрий день!» і «Дякуємо за співпрацю».', essential: false },
        { id: 'mv1-domain', label: 'Адреса форми', detail: 'Адреса сторінки: https://workwear-login.example/size.', essential: true },
        { id: 'mv1-secret', label: 'Запитувані дані', detail: '«Для доступу до форми введіть пароль від порталу практики на нашій сторінці».', essential: true },
        { id: 'mv1-date', label: 'Термін до п’ятниці', detail: '«Оберіть розмір спецодягу до п’ятниці».', essential: false },
      ],
      reasonPrompt: 'Чому навіть спокійне й грамотно написане повідомлення потребує перевірки?',
      feedback: 'Новий сюжет перевіряє ту саму навичку: важливі адреса і запит секрету. Фішинговий запит може бути ввічливим, грамотним і без тиску часу.',
    },
    {
      id: 'mastery-verification-check', kind: 'simulation', stage: 'Навичка 2 · новий випадок',
      title: 'Перевірка: перенесення практики',
      objective: 'Незалежно перевірити новий запит без навчальних підказок.',
      briefing: 'SMS повідомляє про перенесення практики й пропонує новий сервіс. У ньому є контактний номер. Скористайтеся доступними інструментами для незалежної перевірки та запишіть результат.',
      skill: 'verification', difficulty: 'medium', support: 'none',
      tools: [
        { id: 'mv2-sms-call', label: 'Зателефонувати на номер із SMS', detail: 'Цей контакт надав автор неперевіреного повідомлення.', effect: 'Автор SMS сам підтверджує власне повідомлення; незалежного джерела немає.', safe: false },
        { id: 'mv2-known', label: 'Перевірити збережений портал', detail: 'praktika.example, розділ оголошень закладу.', effect: 'Офіційне оголошення не містить нового сервісу.', safe: true },
        { id: 'mv2-directory', label: 'Знайти координатора в довіднику', detail: 'Контакт був у довіднику закладу до отримання SMS.', effect: 'Координатор підтвердив справжній час практики й заперечив SMS.', safe: true },
        { id: 'mv2-log', label: 'Зафіксувати підтверджений розклад', detail: 'Записати джерело й відповідь координатора.', effect: 'Бригада отримує перевірену інформацію.', safe: true },
        { id: 'mv2-link', label: 'Увійти за посиланням із SMS', detail: 'Новий сервіс ще не перевірено.', effect: 'Пароль потрапляє неперевіреній стороні.', safe: false },
      ],
      requiredActions: ['mv2-known', 'mv2-directory', 'mv2-log'], forbiddenActions: ['mv2-sms-call', 'mv2-link'],
      dependencies: [{ before: 'mv2-directory', after: 'mv2-log' }],
      feedback: 'Незалежна перевірка переноситься з чату на SMS: використовують відомий портал і контакт із довідника, а результат фіксують після підтвердження.',
    },
    {
      id: 'mastery-recovery-check', kind: 'simulation', stage: 'Навичка 3 · новий випадок',
      title: 'Перевірка: фальшива форма інструктажу',
      objective: 'Захистити акаунт після витоку в іншій професійній ситуації.',
      briefing: 'Практикант ввів пароль на сторонній формі «електронного інструктажу». Доступ до справжнього сервісу зберігся, нічого не завантажували, пароль унікальний. Виконайте захист акаунта.',
      skill: 'recovery', difficulty: 'hard', support: 'none',
      tools: [
        { id: 'mv3-wait', label: 'Почекати до завтра', detail: 'Поки немає помітної шкоди.', effect: 'Стороння особа може використати чинний пароль.', safe: false },
        { id: 'mv3-official', label: 'Відкрити відомий сервіс', detail: 'Справжня адреса з переліку закладу.', effect: 'Доступна панель керування безпекою.', safe: true },
        { id: 'mv3-reset', label: 'Установити новий унікальний пароль', detail: 'Змінити пароль у справжньому сервісі.', effect: 'Розкритий пароль більше не дозволяє нові входи.', safe: true },
        { id: 'mv3-revoke', label: 'Відкликати інші сеанси', detail: 'Завершити активні входи на інших пристроях.', effect: 'Чинні сторонні сеанси закрито.', safe: true },
        { id: 'mv3-factor', label: 'Налаштувати додатковий фактор', detail: 'Увімкнути захист входу у справжньому сервісі.', effect: 'Наступний вхід має додатковий захист.', safe: true },
        { id: 'mv3-notify', label: 'Повідомити відповідального за безпеку', detail: 'Передати опис форми й час без самого пароля.', effect: 'Відповідальний перевіряє наслідки й попереджає практикантів.', safe: true },
        { id: 'mv3-fake', label: 'Змінити пароль на тій самій формі', detail: 'Сторінка обіцяє «скасувати реєстрацію».', effect: 'Новий пароль теж стає відомим сторонньому сайту.', safe: false },
      ],
      requiredActions: ['mv3-official', 'mv3-reset', 'mv3-revoke', 'mv3-factor', 'mv3-notify'], forbiddenActions: ['mv3-wait', 'mv3-fake'],
      dependencies: [{ before: 'mv3-official', after: 'mv3-reset' }, { before: 'mv3-official', after: 'mv3-revoke' }, { before: 'mv3-official', after: 'mv3-factor' }],
      feedback: 'У новому випадку потрібно виконати повний захист через відомий сервіс. Фальшива форма не може надійно відкликати ваш пароль; очікування залишає акаунт уразливим.',
    },
  ],
}

const zpd: InteractiveQuest = {
  methodId: 'zpd', mode: 'zpd',
  title: 'Зміна з цифровим наставником',
  subtitle: 'Спробуйте самі · попросіть опору · дійте самостійно',
  mission: 'Розслідуйте три робочі ситуації, поступово беручи на себе рішення, які спочатку допомагає розібрати наставник.',
  briefing: 'Ви починаєте виробничу практику. Наставник допомагає навідними запитаннями й прикладом, коли ви цього потребуєте. Спершу спробуйте власне рішення. У другому випадку опор менше, третій ви виконуєте самостійно. Результат покаже, де допомога була потрібна; це характеристика виконання завдань, а не ярлик ваших здібностей.',
  strategy: 'Три кроки зі зменшенням підтримки: дослідження листа з наставником, перевірка з короткими опорами та самостійне перенесення в інший канал спілкування.',
  tool: 'Панель наставника',
  learningOutcome: 'Виконати незалежну перевірку робочого запиту самостійно після практики з підтримкою.',
  stageCount: 3, targetCount: 3,
  activities: [
    {
      id: 'zpd-guided', kind: 'evidence', stage: 'Разом із наставником',
      title: 'Розберімо запит на практику',
      objective: 'Навчитися знаходити суттєві деталі за допомогою дозованих опор.',
      briefing: 'Відомий портал: praktika.example. Позначте деталі, які потребують перевірки, й поясніть ризик. Можете відкрити запитання наставника по одному; почніть із власної спроби.',
      skill: 'recognition', difficulty: 'medium', support: 'full',
      mail: { from: 'Наставник практики <mentor@praktika-help.example>', subject: 'Оновлення доступу до майстерні', body: 'Вітаю, бригадо! Через оновлення системи введіть пароль практиканта й код із застосунку на сторінці нижче. Це потрібно зробити до кінця зміни. Підпис: ваш наставник.', url: 'https://praktika-help.example/update' },
      evidence: [
        { id: 'z1-domain', label: 'Адреса praktika-help.example', detail: 'Посилання під листом: https://praktika-help.example/update.', essential: true },
        { id: 'z1-greeting', label: 'Звертання до бригади', detail: 'Перші слова повідомлення: «Вітаю, бригадо!».', essential: false },
        { id: 'z1-secrets', label: 'Пароль і код із застосунку', detail: '«Введіть пароль практиканта й код із застосунку на сторінці нижче».', essential: true },
        { id: 'z1-signature', label: 'Підпис наставника', detail: 'Останній рядок: «Підпис: ваш наставник».', essential: false },
      ],
      reasonPrompt: 'Назвіть, кому можуть потрапити секрети та де незалежно перевірити запит наставника.',
      hints: [
        'Наставник: «Яку адресу порталу тобі дали до отримання цього листа? Порівняй її з адресою сторінки».',
        'Наставник: «Зверни увагу на дані для входу. Що станеться, якщо пароль і код отримає стороння людина?»',
        'Приклад наставника: «Знайоме ім’я не є перевіркою. Я відкриваю відому адресу сам і знаходжу контакт у довіднику, а не в цьому листі». Застосуйте цей принцип до свого рішення.',
      ],
      feedback: 'Адреса й збір секретів — суттєві деталі. Підтримка мала допомогти пов’язати їх із ризиком. Наступний випадок перевіряє, чи можете ви виконати саму процедуру з меншою кількістю опор.',
    },
    {
      id: 'zpd-fading', kind: 'simulation', stage: 'Менше опор',
      title: 'Незвичний запит у чаті майстерні',
      objective: 'Перейти від аналізу з підтримкою до власного порядку перевірки.',
      briefing: 'З акаунта знайомого наставника просять підтвердити графік на praktika-shift.example. Пароль не вводили. Є збережений портал і службовий довідник. Побудуйте дії; наставник дає лише короткі запитання.',
      skill: 'verification', difficulty: 'medium', support: 'fading',
      tools: [
        { id: 'z2-chat', label: 'Попросити підтвердження в цьому чаті', detail: 'Відповість той самий акаунт, що надіслав запит.', effect: 'Незалежного підтвердження особи немає: акаунт міг бути захоплений.', safe: false },
        { id: 'z2-bookmark', label: 'Відкрити збережений портал', detail: 'praktika.example зі списку закладу.', effect: 'Зміни графіка чи нової форми немає.', safe: true },
        { id: 'z2-contact', label: 'Знайти наставника у довіднику', detail: 'Відомий телефон або службовий контакт.', effect: 'Справжній наставник заперечив надсилання цього запиту.', safe: true },
        { id: 'z2-note', label: 'Передати результат майстру', detail: 'Зафіксувати перевірений факт і підозрілу адресу.', effect: 'Майстер попереджає бригаду перевіреним службовим каналом.', safe: true },
        { id: 'z2-login', label: 'Увійти в нову форму з чату', detail: 'Форма не підтверджена закладом.', effect: 'Робочий пароль потрапляє неперевіреній стороні.', safe: false },
      ],
      requiredActions: ['z2-bookmark', 'z2-contact', 'z2-note'], forbiddenActions: ['z2-chat', 'z2-login'],
      dependencies: [{ before: 'z2-contact', after: 'z2-note' }],
      hints: ['Яке джерело існувало до цього повідомлення?', 'Як перевірити людину, якщо її акаунт у чаті міг перейти іншому?'],
      feedback: 'Ви перенесли принцип незалежного джерела у чат: перевірили портал, зв’язалися за відомим контактом і передали результат. У наступній ситуації підказок наставника не буде.',
    },
    {
      id: 'zpd-independent', kind: 'simulation', stage: 'Самостійний вихід',
      title: 'Дзвінок від «постачальника»',
      objective: 'Самостійно перенести правило перевірки на телефонну розмову.',
      briefing: 'Під час практики телефонує незнайома людина: «Я від постачальника інструментів. Назвіть код входу, щоб підтвердити замовлення». Номер постачальника є у затвердженому довіднику майстерні. Вирішіть, як перевірити запит і зафіксувати інцидент.',
      skill: 'verification', difficulty: 'hard', support: 'none',
      tools: [
        { id: 'z3-code', label: 'Назвати код для підтвердження', detail: 'Незнайома людина стверджує, що код потрібен постачальнику.', effect: 'Код може бути використаний для доступу до вашого акаунта.', safe: false },
        { id: 'z3-stop', label: 'Завершити розмову без передачі коду', detail: 'Не розкриваєте секрет і виходите з тиску розмови.', effect: 'Дані входу залишились у вас.', safe: true },
        { id: 'z3-lookup', label: 'Відкрити затверджений довідник', detail: 'Знайти контакт постачальника, відомий майстерні раніше.', effect: 'Доступний незалежний номер постачальника.', safe: true },
        { id: 'z3-call', label: 'Зателефонувати за контактом із довідника', detail: 'Поставити запитання про вимогу коду для замовлення.', effect: 'Постачальник підтвердив: кодів входу для замовлень не просить.', safe: true },
        { id: 'z3-report', label: 'Повідомити майстра про перевірений випадок', detail: 'Записати час, заявлену особу і результат незалежного дзвінка.', effect: 'Майстер отримав перевірену інформацію для попередження бригади.', safe: true },
        { id: 'z3-callback', label: 'Передзвонити на номер вхідного дзвінка', detail: 'Контакт походить від самого неперевіреного автора.', effect: 'Ви знову перевіряєте запит через його джерело.', safe: false },
      ],
      requiredActions: ['z3-stop', 'z3-lookup', 'z3-call', 'z3-report'], forbiddenActions: ['z3-code', 'z3-callback'],
      dependencies: [{ before: 'z3-stop', after: 'z3-call' }, { before: 'z3-lookup', after: 'z3-call' }, { before: 'z3-call', after: 'z3-report' }],
      feedback: 'Самостійна процедура зберігає секрети та використовує незалежний контакт. У портфоліо буде видно, які попередні кроки вимагали підтримки і як виконано цей новий випадок.',
    },
  ],
}

const solo: InteractiveQuest = {
  methodId: 'solo-taxonomy', mode: 'solo',
  title: 'Дошка розслідування',
  subtitle: 'Один факт → кілька фактів → зв’язки → перенесення',
  mission: 'Розкрийте механізм фальшивого повідомлення про інструктаж, поступово перетворюючи окремі спостереження на пояснення й правило для нового випадку.',
  briefing: 'Перед практикою бригада отримала лист про «електронний допуск». Відомий портал — praktika.example. Розслідування рухається від одного доречного аспекту до зв’язного пояснення та перенесення. SOLO описує структуру конкретної відповіді. Довжина тексту або кількість кліків самі по собі не визначають рівень розуміння.',
  strategy: 'Ви доповнюєте одну справу: знаходите суттєву деталь, відокремлюєте факти від припущень, будуєте причинні зв’язки та формулюєте правило для іншої ситуації.',
  tool: 'Дошка доказів і зв’язків',
  learningOutcome: 'Пов’язати ознаки, ризики й дії в цілісне пояснення та обґрунтувати перенесення правила.',
  stageCount: 4, targetCount: 4,
  activities: [
    {
      id: 'solo-one', kind: 'evidence', stage: 'Один доречний аспект',
      title: 'Знайдіть головну деталь',
      objective: 'Виділити один аспект, який прямо стосується захисту акаунта.',
      briefing: 'На цьому кроці знайдіть один найсуттєвіший факт: яку саме дію від вас вимагають? Зовнішнє оформлення поки відкладіть.',
      skill: 'recognition', difficulty: 'easy',
      mail: { from: 'Відділ інструктажу <briefing@praktika.example>', subject: 'Електронний допуск до роботи', body: 'Бригадо № 3! Перейдіть до форми допуску та надішліть ваш одноразовий код входу майстру у відповідь на цей лист. Початок інструктажу о 09:00. Підписано: відділ інструктажу.', url: 'https://praktika-check.example/briefing' },
      evidence: [
        { id: 's1-code', label: 'Надіслати одноразовий код', detail: '«Надішліть ваш одноразовий код входу майстру у відповідь на цей лист».', essential: true },
        { id: 's1-time', label: 'Інструктаж о 09:00', detail: 'У тексті зазначено: «Початок інструктажу о 09:00».', essential: false },
        { id: 's1-team', label: 'Бригада № 3', detail: 'Повідомлення адресовано «Бригаді № 3».', essential: false },
      ],
      reasonPrompt: 'Назвіть один факт і поясніть, як він стосується доступу до акаунта.',
      feedback: 'Одноразовий код — один доречний аспект для пояснення ризику. Далі потрібно зібрати інші факти; відповідь, яка стосується лише оформлення, не розкриває суті цього запиту.',
    },
    {
      id: 'solo-several', kind: 'classify', stage: 'Кілька доречних аспектів',
      title: 'Факти окремо від припущень',
      objective: 'Зібрати кілька доречних фактів, не підмінюючи їх здогадками.',
      briefing: 'Досьє справи: лист просить одноразовий код, кнопка веде на praktika-check.example, а відомий портал — praktika.example. За контактом із довідника відділ інструктажу повідомив, що кодів не збирає. Розкладіть картки на підтверджені факти та непідтверджені припущення.',
      skill: 'analysis', difficulty: 'medium',
      groups: [{ id: 'fact', label: 'Підтверджений факт досьє' }, { id: 'assumption', label: 'Припущення без підтвердження' }],
      items: [
        { id: 's2-code', label: 'У листі є вимога надіслати одноразовий код.', group: 'fact' },
        { id: 's2-site', label: 'Домен кнопки відрізняється від відомого порталу.', group: 'fact' },
        { id: 's2-official', label: 'Відділ за відомим контактом заперечив збирання кодів.', group: 'fact' },
        { id: 's2-logo', label: 'Якщо є підпис відділу, лист точно офіційний.', group: 'assumption' },
        { id: 's2-hacked', label: 'Акаунт майстра вже точно захопили.', group: 'assumption' },
        { id: 's2-grammar', label: 'Усі небезпечні листи обов’язково мають помилки.', group: 'assumption' },
      ],
      feedback: 'Ви маєте кілька підтверджених аспектів: запит секрету, інший домен і незалежне заперечення. Перелік ще не пояснює, як вони пов’язані; наступна дошка поєднає їх у систему.',
    },
    {
      id: 'solo-relate', kind: 'map', stage: 'Цілісне пояснення',
      title: 'Поєднайте справу в систему',
      objective: 'Пояснити причинні зв’язки та роль незалежного підтвердження.',
      briefing: 'Побудуйте зв’язне пояснення: що створює ризик доступу, що перевіряє справжність вимоги та як дія зменшує ризик. З’єднайте всі доречні пари.',
      skill: 'analysis', difficulty: 'hard',
      nodes: [
        { id: 's3-code', label: 'Вимога передати одноразовий код', type: 'evidence' },
        { id: 's3-domain', label: 'Сторінка на сторонньому домені', type: 'evidence' },
        { id: 's3-denial', label: 'Відділ за відомим контактом заперечує вимогу', type: 'evidence' },
        { id: 's3-access', label: 'Стороння особа може отримати доступ', type: 'risk' },
        { id: 's3-false', label: 'Підстав довіряти вимозі немає', type: 'risk' },
        { id: 's3-protect', label: 'Не передавати секрет і використовувати відомий портал', type: 'action' },
        { id: 's3-notify', label: 'Передати перевірені докази відповідальному', type: 'action' },
      ],
      links: [
        { from: 's3-code', to: 's3-access', label: 'Переданий код може дозволити сторонній вхід' },
        { from: 's3-domain', to: 's3-access', label: 'Стороння сторінка може зібрати дані для входу' },
        { from: 's3-denial', to: 's3-false', label: 'Незалежна перевірка суперечить заявленій вимозі' },
        { from: 's3-access', to: 's3-protect', label: 'Ця дія зберігає секрет і обходить сторонню сторінку' },
        { from: 's3-false', to: 's3-notify', label: 'Перевірені відомості дають основу службовому повідомленню' },
      ],
      feedback: 'Цілісне пояснення поєднує деталі: запит коду і стороння сторінка ведуть до ризику доступу, а незалежне заперечення спростовує вимогу. Захисні дії відповідають цим різним підставам.',
    },
    {
      id: 'solo-transfer', kind: 'compose', stage: 'Узагальнення й перенесення',
      title: 'Те саме правило в іншому світі',
      objective: 'Узагальнити механізм та перенести його за межі вихідного листа.',
      briefing: 'Новий контекст: біля майстерні наклеєно QR-код «Для отримання інструментів увійдіть робочим акаунтом». Він веде на невідомий сайт. Інше повідомлення телефоном просить продиктувати код входу «для накладної». Сформулюйте правило, що працює для обох випадків, і поясніть його межі.',
      skill: 'transfer', difficulty: 'hard',
      sections: [
        { id: 'principle', label: 'Загальний принцип', prompt: 'Сформулюйте правило, яке спирається на джерело запиту й секрети, а не лише на слова «лист» або «фішинг».', minLength: 80 },
        { id: 'transfer', label: 'Два нові застосування', prompt: 'Поясніть конкретну безпечну дію для QR-коду й телефонного запиту та зв’язок із вашим правилом.', minLength: 110 },
        { id: 'limits', label: 'Межі висновку', prompt: 'Поясніть, чому нова адреса сама по собі не доводить шахрайства, і що потрібно для незалежної перевірки.', minLength: 70 },
      ],
      checklist: [
        { id: 's-general', label: 'Принцип описує механізм ризику й працює для різних каналів.' },
        { id: 's-links', label: 'Обидві дії пояснені через зв’язок «джерело → ризик → захист».' },
        { id: 's-evidence', label: 'Я відрізнив підозру від підтвердженого висновку й назвав незалежне джерело.' },
      ],
      feedback: 'Перенесення потребує пояснення, чому принцип працює в новому контексті. Система зберігає ваш текст і самоперевірку; якість узагальнення й рівень конкретної відповіді оцінюють за її змістом разом із викладачем.',
    },
  ],
}

const gagne: InteractiveQuest = {
  methodId: 'gagne-nine-events', mode: 'gagne',
  title: 'Операція «Безпечний інструктаж»',
  subtitle: 'Дев’ять подій цілісного навчання',
  mission: 'Захистіть електронний інструктаж бригади: від першого тривожного повідомлення до самостійного рішення та пам’ятки для майбутньої практики.',
  briefing: 'Це навчальна історія про фальшивий допуск до роботи. У ній є увага, зрозуміла мета, пригадування, демонстрація, підтримка, практика, зворотний зв’язок, самостійна перевірка й перенесення. Навчальні опори допомагають практикуватися; новий випадок показує, що ви можете зробити самостійно.',
  strategy: 'Дев’ять подій мають різні функції. Ви не лише виконуєте дії: спочатку бачите модель, отримуєте розбір власної практики й застосовуєте вміння в новій ситуації.',
  tool: 'Сценарій цифрового інциденту',
  learningOutcome: 'Незалежно перевірити незвичну вимогу перед інструктажем і перенести процедуру на майбутню практику.',
  stageCount: 9, targetCount: 4,
  activities: [
    {
      id: 'gagne-attention', kind: 'briefing', stage: '1 · Привернути увагу',
      title: 'До початку зміни десять хвилин',
      objective: 'Помітити проблему, яка впливає на вашу робочу зміну.',
      briefing: 'На екрані майстерні з’явився новий лист. Бригадир уже відкрив його на телефоні. Ознайомтеся з ситуацією й визначте, що потрібно з’ясувати перед будь-якою дією.',
      skill: 'orientation',
      panels: [
        { title: 'Лист о 08:20', text: '«Без підтвердження доступу вас не допустять до інструктажу. Введіть пароль робочого акаунта на instruction-pass.example до 08:30». Підпис: відділ практики.' },
        { title: 'Робочий контекст', text: 'Інструктаж справді починається о 08:30. Справжній портал закладу — praktika.example. Бригадир каже: «Часу мало, просто введімо пароль». Збіг із реальним розкладом ще не підтверджує вимогу.' },
      ],
      feedback: 'Проблема зрозуміла: треба перевірити допуск, зберігши доступ до робочого акаунта.',
    },
    {
      id: 'gagne-goal', kind: 'briefing', stage: '2 · Повідомити мету',
      title: 'Що буде результатом зміни',
      objective: 'Знати очікувану дію та критерії перед початком практики.',
      briefing: 'Ознайомтеся з метою й критеріями. За ними буде розібрано практику та новий самостійний випадок.',
      skill: 'orientation',
      panels: [
        { title: 'Мета', text: 'Перевірити незвичний робочий запит через відомі незалежні джерела, зберегти секрети входу та передати потрібні докази відповідальному.' },
        { title: 'Критерії практики', text: 'Відкрити відомий портал; з’ясувати вимогу через контакт із довідника; зберегти лист; передати перевірені відомості. Не вводити пароль на сторонній сторінці й не пересилати код.' },
        { title: 'Критерії перенесення', text: 'У новому повідомленні знайти суттєві ризики й пояснити рішення без підказок. Створити коротку пам’ятку з незалежним каналом перевірки для своєї практики.' },
      ],
      feedback: 'Ви знаєте, яку дію тренуєте і за чим перевірятимете результат.',
    },
    {
      id: 'gagne-recall', kind: 'classify', stage: '3 · Пригадати досвід',
      title: 'Ключі й звичайні відомості',
      objective: 'Пов’язати нову ситуацію з відомим правилом секретності.',
      briefing: 'Пригадайте правило майстерні: що може відкрити доступ до акаунта, а що є звичайною організаційною інформацією? Розкладіть картки.',
      skill: 'recognition', difficulty: 'easy',
      groups: [{ id: 'key', label: 'Ключ до акаунта · не передавати' }, { id: 'info', label: 'Звичайні відомості' }],
      items: [
        { id: 'g3-pass', label: 'Пароль до робочого сервісу', group: 'key' },
        { id: 'g3-place', label: 'Місце проведення інструктажу', group: 'info' },
        { id: 'g3-code', label: 'Одноразовий код підтвердження входу', group: 'key' },
        { id: 'g3-start', label: 'Початок зміни о 08:30', group: 'info' },
      ],
      feedback: 'Пароль і код — засоби доступу. Знання місця й часу інструктажу не надає права запитувати ці секрети.',
    },
    {
      id: 'gagne-content', kind: 'briefing', stage: '4 · Показати матеріал',
      title: 'Демонстрація: як звіряти джерело',
      objective: 'Побачити модель безпечної перевірки на конкретному прикладі.',
      briefing: 'Майстер показує хід перевірки на навчальному повідомленні. Зверніть увагу, звідки береться кожне джерело.',
      skill: 'verification',
      panels: [
        { title: 'Адреса має значення', text: 'praktika.example і instruction-pass.example — різні домени. Схожа назва та значок замка в адресному рядку не підтверджують, що це сервіс закладу.' },
        { title: 'Незалежність джерела', text: 'Адресу беремо зі збереженого переліку закладу, контакт — зі службового довідника. Контакт і кнопка з підозрілого повідомлення залежать від його автора.' },
      ],
      demonstration: [
        { label: '1 · Пауза', detail: 'Майстер не натискає кнопку й не вводить пароль. Зберігає зміст листа для перевірки.' },
        { label: '2 · Відомий портал', detail: 'Сам відкриває praktika.example зі збереженої адреси та перевіряє розділ інструктажів.' },
        { label: '3 · Відомий контакт', detail: 'Зв’язується з відділом практики за довідником; там заперечують вимогу.' },
        { label: '4 · Службове повідомлення', detail: 'Передає відповідальному час, адресу і запитувані типи даних, не додаючи секретів.' },
      ],
      feedback: 'Модель показує процедуру, яку ви застосуєте у практичній панелі.',
    },
    {
      id: 'gagne-guidance', kind: 'briefing', stage: '5 · Дати навчальні опори',
      title: 'Три орієнтири для вашого рішення',
      objective: 'Мати коротку стратегію, яка допомагає виконати нову дію.',
      briefing: 'Прочитайте орієнтири. У практичній панелі ви самі оберете інструменти й порядок дій.',
      skill: 'verification',
      panels: [
        { title: 'Джерело', text: 'Чи знали ви цю адресу або контакт до отримання повідомлення? Якщо ні — знайдіть незалежний канал.' },
        { title: 'Секрет', text: 'Чи просять пароль, код входу або резервний код? Знайома посада й логотип не роблять таку передачу безпечною.' },
        { title: 'Доказ і дія', text: 'Збережіть потрібні деталі. Для повідомлення з результатом перевірки спершу отримайте цей результат; до налаштувань акаунта переходять через справжній сервіс.' },
      ],
      feedback: 'Опори допомагають обрати дію. Наступний етап дає можливість застосувати їх.',
    },
    {
      id: 'gagne-practice', kind: 'simulation', stage: '6 · Виконати практику',
      title: 'Ваша перевірка допуску',
      objective: 'Виконати показану процедуру з доступними навчальними опорами.',
      briefing: 'Поверніться до листа про допуск на instruction-pass.example. Пароль не вводили. Використайте робочу панель, щоб з’ясувати вимогу, зберегти доказ і передати результат.',
      skill: 'verification', difficulty: 'medium', support: 'full',
      tools: [
        { id: 'g6-portal', label: 'Відкрити відомий портал', detail: 'Збережена адреса praktika.example.', effect: 'Інструктаж має звичайний порядок; нової вимоги немає.', safe: true },
        { id: 'g6-directory', label: 'Перевірити у відділі за довідником', detail: 'Службовий контакт закладу, відомий раніше.', effect: 'Відділ заперечив цей лист.', safe: true },
        { id: 'g6-save', label: 'Зберегти дані листа', detail: 'Адреса, час, текст і адреса кнопки; без секретів.', effect: 'Доказ доступний для службового повідомлення.', safe: true },
        { id: 'g6-report', label: 'Передати перевірені відомості', detail: 'Повідомити відповідального службовим каналом.', effect: 'Відповідальний має доказ і результат незалежної перевірки.', safe: true },
        { id: 'g6-login', label: 'Підтвердити доступ на сторінці листа', detail: 'Стороння адреса просить робочий пароль.', effect: 'Ви розкриваєте пароль неперевіреному сайту.', safe: false },
        { id: 'g6-code', label: 'Надіслати код «для допуску»', detail: 'Автор листа просить секрет входу.', effect: 'Код може надати сторонній особі доступ.', safe: false },
      ],
      requiredActions: ['g6-portal', 'g6-directory', 'g6-save', 'g6-report'], forbiddenActions: ['g6-login', 'g6-code'],
      dependencies: [{ before: 'g6-save', after: 'g6-report' }, { before: 'g6-directory', after: 'g6-report' }],
      hints: ['Перевіряйте вимогу у джерелі, незалежному від листа.', 'Для повідомлення потрібні доказ і результат перевірки; зберіть їх до передачі.'],
      feedback: 'Перевірте свій маршрут за метою: відомий портал, відомий контакт, доказ і службове повідомлення без передачі секретів.',
    },
    {
      id: 'gagne-feedback', kind: 'briefing', stage: '7 · Отримати зворотний зв’язок',
      title: 'Розбір саме вашого маршруту',
      objective: 'Використати результат практики для усвідомленого виправлення.',
      briefing: 'Зіставте показаний результат попередньої практики з поясненнями. Перед самостійним випадком сформулюйте для себе, що збережете або зміните у діях.',
      skill: 'reflection', reflectPrevious: true,
      panels: [
        { title: 'Якщо бракує незалежної перевірки', text: 'Відповідь автора листа не підтверджує його особу. Змініть джерело: відомий портал і контакт із довідника дають незалежні відомості.' },
        { title: 'Якщо порядок повідомлення не узгоджений', text: 'Для передачі перевірених відомостей спершу збережіть доказ і отримайте підтвердження. Повідомити про підозру можна відразу, але не можна назвати неперевірений факт підтвердженим.' },
        { title: 'Якщо розкрито секрет', text: 'Після введення пароля потрібен захист акаунта через справжній сервіс. Саме видалення листа не змінює пароль і не відкликає сеанси.' },
      ],
      feedback: 'Розбір практики допомагає навчанню. Наступний новий випадок перевіряє самостійне застосування.',
    },
    {
      id: 'gagne-assess', kind: 'evidence', stage: '8 · Перевірити виконання',
      title: 'Самостійно: електронна накладна',
      objective: 'У новому випадку самостійно впізнати ризик і запропонувати незалежну перевірку.',
      briefing: 'Бригада отримує інструменти від постачальника. Відомий портал практики — praktika.example. Дослідіть новий лист, позначте суттєві ризики й обґрунтуйте дію без підказок.',
      skill: 'recognition', difficulty: 'hard', support: 'none',
      mail: { from: 'Постачання майстерні <invoice@tool-form.example>', subject: 'Накладна на інструменти', body: 'Доброго дня. Замовлення для майстерні № 4 готове. Для отримання накладної введіть пароль від порталу практики у формі постачальника. Термін отримання — наступний тиждень.', url: 'https://tool-form.example/invoice' },
      evidence: [
        { id: 'g8-domain', label: 'Адреса форми постачальника', detail: 'Адреса кнопки: https://tool-form.example/invoice.', essential: true },
        { id: 'g8-password', label: 'Пароль порталу для накладної', detail: '«Для отримання накладної введіть пароль від порталу практики у формі постачальника».', essential: true },
        { id: 'g8-room', label: 'Точний номер майстерні', detail: '«Замовлення для майстерні № 4 готове».', essential: false },
        { id: 'g8-time', label: 'Термін наступного тижня', detail: '«Термін отримання — наступний тиждень».', essential: false },
      ],
      reasonPrompt: 'Поясніть ризик і спосіб незалежно звірити накладну з постачальником через відомий майстерні контакт.',
      feedback: 'Суттєві деталі — стороння форма і запит робочого пароля. Відомий контакт постачальника дозволяє перевірити накладну, не передаючи секрети. Пояснення збережено для обговорення.',
    },
    {
      id: 'gagne-transfer', kind: 'compose', stage: '9 · Зберегти й перенести',
      title: 'Картка дій для майбутньої практики',
      objective: 'Перенести процедуру в реальний професійний контекст і створити опору для майбутнього.',
      briefing: 'На наступній практиці ви можете отримати незвичний запит у месенджері, телефоном або через QR-код. Створіть свою коротку картку перевірки, яку можна показати бригаді.',
      skill: 'transfer', difficulty: 'hard',
      sections: [
        { id: 'context', label: 'Нова професійна ситуація', prompt: 'Опишіть один можливий запит у вашій майбутній професії та які дані або дії він може вимагати.', minLength: 70 },
        { id: 'card', label: 'Моя картка перевірки', prompt: 'Дайте конкретні кроки з незалежним джерелом, захистом секретів і службовим повідомленням.', minLength: 110 },
        { id: 'reminder', label: 'Як повернутися до правила', prompt: 'Вкажіть, де триматимете картку та коли перевірите себе на іншому випадку.', minLength: 50 },
      ],
      checklist: [
        { id: 'g9-profession', label: 'Ситуація відповідає майбутній роботі й відрізняється від навчального листа.' },
        { id: 'g9-independent', label: 'Кроки містять незалежний канал і не передбачають передачі секретів.' },
        { id: 'g9-revisit', label: 'Карткою можна користуватися після завершення цього маршруту.' },
      ],
      feedback: 'Картка підтримує майбутнє використання навички. Система зберегла авторський текст і самоперевірку; відповідність професійному контексту й зміст перевіряють разом із викладачем.',
    },
  ],
}

const adaptive: InteractiveQuest = {
  methodId: 'adaptive-testing', mode: 'adaptive',
  title: 'Пульт цифрових інцидентів',
  subtitle: 'П’ять ситуацій · маршрут за вашими діями',
  mission: 'Проведіть цифрове чергування: розподіляйте повідомлення, перевіряйте незвичні вимоги й захищайте робочі акаунти. Наступна ситуація враховує ваші попередні дії.',
  briefing: 'У банку дев’ять різних ситуацій трьох напрямів: розпізнавання, перевірка та відновлення. Ви виконаєте п’ять. Після труднощів маршрут пропонує простіший випадок тієї самої навички, після успіху — складніший і забезпечує охоплення різних напрямів. Це прозорий навчальний маршрут за правилами, без психометричної оцінки здібностей.',
  strategy: 'Початок із середньої складності. Рішення змінюють наступний випадок; у портфоліо зберігаються навичка, складність і виконані критерії. Мета — знайти напрям для подальшої практики.',
  tool: 'Адаптивний пульт',
  learningOutcome: 'Знайти сильні сторони й прогалини в практичному реагуванні та визначити наступну навичку для тренування.',
  stageCount: 5, targetCount: 5,
  activities: [
    {
      id: 'adaptive-recognition-easy', kind: 'evidence', stage: 'Розпізнавання · базовий випадок',
      title: 'Яку деталь не можна ігнорувати',
      objective: 'У простому повідомленні знайти прямий запит секрету.',
      briefing: 'Не потрібно визначати особу автора за оформленням. Позначте суттєву небезпеку та поясніть, що саме може втратити бригада.',
      skill: 'recognition', difficulty: 'easy',
      mail: { from: 'Адміністратор майстерні', subject: 'Оновлення списку практикантів', body: 'Надішліть у відповідь одноразовий код входу, щоб я оновив список практикантів. Початок роботи о 08:00, майстерня № 2.', url: 'Посилання немає' },
      evidence: [
        { id: 'ar1-code', label: 'Надіслати код входу', detail: '«Надішліть у відповідь одноразовий код входу, щоб я оновив список практикантів».', essential: true },
        { id: 'ar1-time', label: 'Початок роботи о 08:00', detail: 'Останній рядок листа: «Початок роботи о 08:00».', essential: false },
        { id: 'ar1-room', label: 'Номер майстерні', detail: 'У тому самому рядку зазначено: «Майстерня № 2».', essential: false },
      ],
      reasonPrompt: 'Чому відсутність посилання не робить передачу коду безпечною?',
      feedback: 'Запит секрету може бути небезпечним і без посилання. Код входу не використовують як звичайний номер зі списку.',
    },
    {
      id: 'adaptive-recognition-medium', kind: 'triage', stage: 'Розпізнавання · робоча скринька',
      title: 'Три повідомлення перед зміною',
      objective: 'Розрізнити очікувану робочу інформацію, незвичний запит і явний запит секрету.',
      briefing: 'Відомий портал — praktika.example. Розподіліть скриньку: «Звичайна робота» — очікувана інформація у відомому процесі без секретів; «Незалежно перевірити» — незвична вимога без достатнього підтвердження; «Зафіксувати й повідомити» — прямий запит секретів або небезпечної дії. У кожній категорії дійте без розкриття даних входу.',
      skill: 'recognition', difficulty: 'medium',
      messages: [
        { id: 'ar2-routine', from: 'Календар порталу praktika.example', subject: 'Нагадування про інструктаж', body: 'У вже відкритому вами відомому порталі: «Інструктаж о 08:30 у майстерні № 1». Це захід, на який бригаду записав майстер. Нового входу або даних не вимагають.', url: 'https://praktika.example/calendar', disposition: 'routine' },
        { id: 'ar2-verify', from: 'Координатор практики', subject: 'Новий сервіс вибору зміни', body: 'Надійшло неочікуване повідомлення про нову зовнішню форму. Вона пропонує вибрати час; про паролі не йдеться. У відомому порталі оголошення про зміну ще немає.', url: 'https://shift-board.example/time', disposition: 'verify' },
        { id: 'ar2-report', from: 'Підтримка практики', subject: 'Надішліть резервний код', body: '«Щоб підтвердити місце на практиці, надішліть резервний код відновлення доступу до свого акаунта».', url: 'Посилання немає', disposition: 'report' },
      ],
      feedback: 'Очікуване нагадування у вже відкритому відомому сервісі — звичайна робота. Нову форму потрібно незалежно перевірити; сама новизна не доводить атаку. Резервний код є секретом, такий запит слід зафіксувати й повідомити.',
    },
    {
      id: 'adaptive-recognition-hard', kind: 'triage', stage: 'Розпізнавання · суперечливі сигнали',
      title: 'Знайомі імена, різні ризики',
      objective: 'Оцінити зміст вимоги, коли ім’я, канал або оформлення виглядають знайомими.',
      briefing: 'Для розподілу використайте три правила: очікуваний процес у вже відкритому відомому сервісі без секретів — звичайна робота; неочікувана зміна — незалежна перевірка; передача секрету або вимкнення захисту — зафіксувати й повідомити. Знайоме ім’я не замінює аналіз дії.',
      skill: 'recognition', difficulty: 'hard',
      messages: [
        { id: 'ar3-code', from: 'Акаунт вашого майстра у чаті', subject: 'Код для відновлення списку', body: '«Телефон зламався. Продиктуй мені свій код входу, я відновлю журнал практики». Акаунт знайомий, але прохання неочікуване.', url: 'Посилання немає', disposition: 'report' },
        { id: 'ar3-routine', from: 'Відомий портал praktika.example', subject: 'Ваш запис на завтрашню зміну', body: 'У вже відкритому відомому порталі показано раніше погоджену зміну. Повідомлення лише нагадує час; жодної передачі даних не просить.', url: 'https://praktika.example/my-shift', disposition: 'routine' },
        { id: 'ar3-verify', from: 'Лист із підписом постійного постачальника', subject: 'Інший спосіб отримання інструментів', body: 'Постачальник пропонує нове місце й порядок отримання партії. Нічого секретного не запитує, але майстер не очікував зміни. Потрібно звірити її через відомий контакт.', url: 'Нове посилання не додається', disposition: 'verify' },
        { id: 'ar3-protection', from: 'Технічна підтримка майстерні', subject: 'Установіть оновлення креслень', body: '«Перед відкриттям нашого пакета вимкніть захист комп’ютера. Це обов’язкова умова». Такий спосіб не передбачено інструкцією закладу.', url: 'https://drawing-package.example/download', disposition: 'report' },
      ],
      feedback: 'Оцінюйте вимогу: знайомий акаунт може бути захоплений, а вимкнення захисту створює ризик. Неочікувана організаційна зміна потребує перевірки, але не є автоматичним доказом шахрайства.',
    },
    {
      id: 'adaptive-verification-easy', kind: 'simulation', stage: 'Перевірка · базовий маршрут',
      title: 'Де шукати справжній розклад',
      objective: 'Знайти незалежне джерело й зафіксувати його відповідь.',
      briefing: 'SMS повідомляє про новий час практики. У майстерні є збережений портал і довідник. Перевірте час через відоме джерело й запишіть підтверджений результат.',
      skill: 'verification', difficulty: 'easy',
      tools: [
        { id: 'av1-known', label: 'Відкрити відомий портал', detail: 'Збережена адреса praktika.example.', effect: 'У порталі є затверджений час практики.', safe: true },
        { id: 'av1-note', label: 'Записати підтверджений час', detail: 'Фіксуєте інформацію з відомого порталу для бригади.', effect: 'Бригада отримує час із незалежного джерела.', safe: true },
        { id: 'av1-sms', label: 'Увійти через посилання SMS', detail: 'Сторінку надав неперевірений автор.', effect: 'Відомий портал не перевірено; пароль може потрапити іншій стороні.', safe: false },
      ],
      requiredActions: ['av1-known', 'av1-note'], forbiddenActions: ['av1-sms'],
      dependencies: [{ before: 'av1-known', after: 'av1-note' }],
      feedback: 'Підтверджений час беруть із відомого джерела. Запис має спиратися на вже отримані відомості.',
    },
    {
      id: 'adaptive-verification-medium', kind: 'simulation', stage: 'Перевірка · два незалежні джерела',
      title: 'Запрошення до сервісу накладних',
      objective: 'Перевірити зовнішню робочу вимогу через заклад і відомий контакт.',
      briefing: 'Неочікуваний лист пропонує нову форму отримання накладних. Пароль не вводили. З’ясуйте, чи форму погоджено закладом і постачальником, та зафіксуйте результат.',
      skill: 'verification', difficulty: 'medium',
      tools: [
        { id: 'av2-portal', label: 'Перевірити оголошення у відомому порталі', detail: 'praktika.example зі збереженого списку.', effect: 'Погодженого переходу на нову форму немає.', safe: true },
        { id: 'av2-directory', label: 'Зв’язатися з постачальником із довідника', detail: 'Відомий майстерні контакт, не з цього листа.', effect: 'Постачальник заперечив форму.', safe: true },
        { id: 'av2-log', label: 'Зафіксувати відповіді', detail: 'Записати джерела й результати обох перевірок.', effect: 'Майстер має підстави попередити бригаду.', safe: true },
        { id: 'av2-mail', label: 'Попросити автора листа підтвердити форму', detail: 'Ви покладаєтесь на те саме неперевірене джерело.', effect: 'Автор підтвердив власну вимогу; незалежності немає.', safe: false },
        { id: 'av2-login', label: 'Спершу увійти, щоб подивитися форму', detail: 'Форма просить пароль робочого акаунта.', effect: 'Ви розкриваєте секрет до перевірки.', safe: false },
      ],
      requiredActions: ['av2-portal', 'av2-directory', 'av2-log'], forbiddenActions: ['av2-mail', 'av2-login'],
      dependencies: [{ before: 'av2-portal', after: 'av2-log' }, { before: 'av2-directory', after: 'av2-log' }],
      feedback: 'Два незалежні джерела дають підставу для рішення. Невідомий автор не може підтвердити сам себе, а вхід до перевірки віддає секрет сторонній формі.',
    },
    {
      id: 'adaptive-verification-hard', kind: 'simulation', stage: 'Перевірка · відомий акаунт у чаті',
      title: 'Запит на позаплановий доступ',
      objective: 'Побудувати перевірку, коли повідомлення приходить із знайомого акаунта.',
      briefing: 'Зі знайомого акаунта майстра просять відкрити нову сторінку для допуску й передати код входу. Незвична вимога не підтверджена порталом. Збережіть повідомлення, перевірте її незалежно та передайте перевірені відомості відповідальному.',
      skill: 'verification', difficulty: 'hard',
      tools: [
        { id: 'av3-save', label: 'Зберегти повідомлення', detail: 'Зафіксувати акаунт, час, зміст і нову адресу без передачі секретів.', effect: 'Є доказ незвичного запиту.', safe: true },
        { id: 'av3-portal', label: 'Звірити вимогу у відомому порталі', detail: 'praktika.example зі списку закладу.', effect: 'Нової процедури допуску немає.', safe: true },
        { id: 'av3-call', label: 'Зв’язатися з майстром за довідником', detail: 'Використати інший відомий канал замість чату.', effect: 'Майстер заперечив запит; його акаунт у чаті потребує перевірки.', safe: true },
        { id: 'av3-report', label: 'Передати доказ і результат відповідальному', detail: 'Повідомити про підозру захоплення акаунта службовим каналом.', effect: 'Відповідальний має підстави перевірити акаунт та попередити бригаду.', safe: true },
        { id: 'av3-chat', label: 'Довіритися знайомому акаунту', detail: 'Надіслати код у цей самий чат.', effect: 'Знайомий акаунт міг бути захоплений; секрет стає відомим його власнику зараз.', safe: false },
        { id: 'av3-delete', label: 'Видалити все до збереження', detail: 'Відмовитися від запиту без фіксації.', effect: 'Потрібний доказ для розслідування втрачено.', safe: false },
      ],
      requiredActions: ['av3-save', 'av3-portal', 'av3-call', 'av3-report'], forbiddenActions: ['av3-chat', 'av3-delete'],
      dependencies: [{ before: 'av3-save', after: 'av3-report' }, { before: 'av3-call', after: 'av3-report' }, { before: 'av3-portal', after: 'av3-report' }],
      feedback: 'Складніший випадок вимагає розрізняти знайомий акаунт і перевірену особу. Доказ, відомий портал та інший відомий канал утворюють підставу для службового реагування.',
    },
    {
      id: 'adaptive-recovery-easy', kind: 'simulation', stage: 'Захист акаунта · основні дії',
      title: 'Відкликати розкритий пароль',
      objective: 'Зупинити використання розкритого пароля та активних сеансів.',
      briefing: 'Пароль уже введено на сторонній сторінці. Панель безпеки справжнього порталу ВЖЕ відкрита зі збереженої адреси, додатковий фактор увімкнено, пароль ніде не повторюється. Виконайте решту основних дій захисту та повідомлення.',
      skill: 'recovery', difficulty: 'easy',
      tools: [
        { id: 'ad1-password', label: 'Змінити пароль на унікальний', detail: 'Ви перебуваєте у справжній панелі безпеки.', effect: 'Старий пароль більше не підходить для нового входу.', safe: true },
        { id: 'ad1-sessions', label: 'Завершити інші сеанси', detail: 'Відкликати активні входи на інших пристроях.', effect: 'Можливі сторонні сеанси закрито.', safe: true },
        { id: 'ad1-report', label: 'Повідомити відповідального', detail: 'Вказати час, підозрілу адресу й типи введених даних без самого пароля.', effect: 'Відповідальний може перевірити наслідки.', safe: true },
        { id: 'ad1-trash', label: 'Обмежитися видаленням листа', detail: 'Налаштування акаунта не зміняться.', effect: 'Розкритий пароль залишається чинним.', safe: false },
      ],
      requiredActions: ['ad1-password', 'ad1-sessions', 'ad1-report'], forbiddenActions: ['ad1-trash'],
      feedback: 'Видалення листа не захищає акаунт. Зміна пароля й відкликання сеансів виконують різні функції; повідомлення допомагає перевірити наслідки.',
    },
    {
      id: 'adaptive-recovery-medium', kind: 'simulation', stage: 'Захист акаунта · повний маршрут',
      title: 'Після фальшивої реєстрації на практику',
      objective: 'Самостійно пройти основний маршрут захисту через справжній сервіс.',
      briefing: 'Практикант ввів унікальний пароль на сторонній формі. Доступ до справжнього порталу є, завантажень не було. Захистіть акаунт і посильте наступні входи.',
      skill: 'recovery', difficulty: 'medium',
      tools: [
        { id: 'ad2-known', label: 'Відкрити збережену адресу порталу', detail: 'praktika.example зі списку закладу.', effect: 'Відкрита справжня панель безпеки.', safe: true },
        { id: 'ad2-password', label: 'Змінити пароль у панелі', detail: 'Створити новий унікальний пароль.', effect: 'Розкритий пароль більше не дозволяє нові входи.', safe: true },
        { id: 'ad2-sessions', label: 'Відкликати інші активні сеанси', detail: 'Завершити входи на інших пристроях.', effect: 'Можливі сторонні активні входи закрито.', safe: true },
        { id: 'ad2-factor', label: 'Увімкнути додатковий фактор входу', detail: 'Сервіс підтримує багатофакторний захист.', effect: 'Наступні входи потребують додаткового підтвердження.', safe: true },
        { id: 'ad2-report', label: 'Повідомити відповідального', detail: 'Передати час, сторінку й тип розкритих даних без секрету.', effect: 'Відповідальний перевіряє наслідки інциденту.', safe: true },
        { id: 'ad2-return', label: 'Змінити пароль на сторонній формі', detail: 'Форма обіцяє «видалити старий доступ».', effect: 'Новий пароль теж потрапляє сторонній особі.', safe: false },
      ],
      requiredActions: ['ad2-known', 'ad2-password', 'ad2-sessions', 'ad2-factor', 'ad2-report'], forbiddenActions: ['ad2-return'],
      dependencies: [{ before: 'ad2-known', after: 'ad2-password' }, { before: 'ad2-known', after: 'ad2-sessions' }, { before: 'ad2-known', after: 'ad2-factor' }],
      feedback: 'Повний маршрут виконується у справжньому сервісі: пароль, сеанси, додатковий фактор і повідомлення відповідального. Стороння форма не є інструментом відновлення.',
    },
    {
      id: 'adaptive-recovery-hard', kind: 'simulation', stage: 'Захист акаунта · пов’язані наслідки',
      title: 'Один пароль у двох робочих сервісах',
      objective: 'Урахувати повторне використання розкритого пароля й перевірити ширші наслідки.',
      briefing: 'Пароль порталу введено на сторонній сторінці. Такий самий пароль використовувався у робочій пошті; доступ до обох справжніх сервісів зберігся. Нічого не завантажували. Захистіть обидва акаунти й перевірте, чи не змінено засоби відновлення.',
      skill: 'recovery', difficulty: 'hard',
      tools: [
        { id: 'ad3-known', label: 'Відкрити обидва відомі сервіси', detail: 'Адреси порталу й робочої пошти зі списку закладу.', effect: 'Доступні справжні панелі безпеки обох акаунтів.', safe: true },
        { id: 'ad3-passwords', label: 'Установити різні нові паролі', detail: 'Змінити розкритий пароль у порталі й пошті на різні унікальні.', effect: 'Один розкритий секрет більше не дає новий доступ до двох сервісів.', safe: true },
        { id: 'ad3-sessions', label: 'Відкликати інші сеанси в обох сервісах', detail: 'Завершити входи на інших пристроях.', effect: 'Активні сторонні сеанси обох акаунтів закрито.', safe: true },
        { id: 'ad3-recovery', label: 'Перевірити засоби відновлення', detail: 'Звірити телефон та адресу відновлення; прибрати невідомі зміни.', effect: 'Способи відновлення знову під вашим контролем.', safe: true },
        { id: 'ad3-factor', label: 'Посилити вхід в обох сервісах', detail: 'Увімкнути доступний багатофакторний захист.', effect: 'Наступний вхід в обидва акаунти має додатковий захист.', safe: true },
        { id: 'ad3-report', label: 'Повідомити про обидва акаунти', detail: 'Передати відповідальному опис витоку й виконаних дій без паролів.', effect: 'Відповідальний перевіряє пошту, журнал входів та можливі повідомлення від вашого імені.', safe: true },
        { id: 'ad3-one', label: 'Змінити пароль лише в порталі й зупинитися', detail: 'Робоча пошта зберігає старий пароль.', effect: 'Другий акаунт залишається доступним за розкритим секретом.', safe: false },
        { id: 'ad3-copy', label: 'Скопіювати один новий пароль у всі сервіси', detail: 'Зберегти однаковий пароль для зручності.', effect: 'Повторне використання знову пов’язує ризики двох акаунтів.', safe: false },
      ],
      requiredActions: ['ad3-known', 'ad3-passwords', 'ad3-sessions', 'ad3-recovery', 'ad3-factor', 'ad3-report'], forbiddenActions: ['ad3-one', 'ad3-copy'],
      dependencies: [{ before: 'ad3-known', after: 'ad3-passwords' }, { before: 'ad3-known', after: 'ad3-sessions' }, { before: 'ad3-known', after: 'ad3-recovery' }, { before: 'ad3-known', after: 'ad3-factor' }],
      feedback: 'Розкритий повторюваний пароль ставить під ризик обидва акаунти. Нові різні паролі, відкликання сеансів, контроль засобів відновлення й додатковий фактор доповнюють повідомлення відповідального.',
    },
  ],
}

export const interactiveQuests: Record<string, InteractiveQuest> = {
  [bloom.methodId]: bloom,
  [mastery.methodId]: mastery,
  [zpd.methodId]: zpd,
  [solo.methodId]: solo,
  [gagne.methodId]: gagne,
  [adaptive.methodId]: adaptive,
}

export function getInteractiveQuest(id: string): InteractiveQuest {
  return interactiveQuests[id] ?? bloom
}

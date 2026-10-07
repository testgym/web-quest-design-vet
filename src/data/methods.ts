export type Difficulty = 'easy' | 'medium' | 'hard'
export type Skill = 'recognition' | 'application' | 'analysis'

export interface Option {
  id: string
  label: string
}

interface QuestionBase {
  id: string
  difficulty: Difficulty
  skill: Skill
  prompt: string
  context?: string
  hints?: string[]
  explanation: string
}

export interface SingleQuestion extends QuestionBase {
  type: 'single'
  options: Option[]
  correct: string
}

export interface MultipleQuestion extends QuestionBase {
  type: 'multiple'
  options: Option[]
  correct: string[]
}

export interface OrderQuestion extends QuestionBase {
  type: 'order'
  items: Option[]
  correctOrder: string[]
}

export interface MatchQuestion extends QuestionBase {
  type: 'match'
  pairs: { id: string; left: string; right: string }[]
}

export type Question = SingleQuestion | MultipleQuestion | OrderQuestion | MatchQuestion

export type QuestMode = 'bloom' | 'mastery' | 'zpd' | 'solo' | 'gagne' | 'adaptive'

export interface QuestStage {
  id: string
  title: string
  objective: string
  content: string
  questionIds: string[]
}

export interface Quest {
  topic: string
  mission: string
  briefing: string
  strategy: string
  mode: QuestMode
  stages: QuestStage[]
  remediation?: { title: string; content: string }
}

export interface Stage {
  id: string
  label: string
  subtitle: string
  description: string
  example: string
}

export interface Method {
  id: string
  title: string
  shortTitle: string
  author: string
  category: string
  difficulty: string
  estimatedMinutes: number
  duration: string
  accent: string
  icon: string
  heroStat: string
  summary: string
  overview: {
    origin: string
    purpose: string
    principles: string[]
    caveat?: string
  }
  stages: Stage[]
  application: {
    title: string
    scenario: string
    steps: string[]
    outcome: string
  }
  sources: { label: string; url: string }[]
  quest: Quest
  quiz: Question[]
}

// Vite bundles each JSON file at build time. Numeric filename prefixes set catalog order.
const files = import.meta.glob<Method>('./methods/*.json', { eager: true, import: 'default' })

export const methods: Method[] = Object.entries(files)
  .sort(([first], [second]) => first.localeCompare(second))
  .map(([, method]) => method)

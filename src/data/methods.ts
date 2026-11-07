export type QuestMode = 'bloom' | 'mastery' | 'zpd' | 'solo' | 'gagne' | 'adaptive'

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
  sources: { label: string; url: string }[]
}

// Vite bundles each JSON file at build time. Numeric filename prefixes set catalog order.
const files = import.meta.glob<Method>('./methods/*.json', { eager: true, import: 'default' })

export const methods: Method[] = Object.entries(files)
  .sort(([first], [second]) => first.localeCompare(second))
  .map(([, method]) => method)

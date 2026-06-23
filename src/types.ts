export type ID = string

export type Mood = 1 | 2 | 3 | 4 | 5

export interface OneOnOne {
  id: ID
  date: string // ISO date
  notes: string
  topics?: string
  mood?: Mood
}

export interface Person {
  id: ID
  name: string
  role: string
  skills: string[]
  goals: string
  notes: string
  oneOnOnes: OneOnOne[]
  nextOneOnOne?: string // ISO date
  color: string
  skillLevels?: Record<string, number> // skill name -> 0..3
}

export type KanbanColumn = 'backlog' | 'todo' | 'doing' | 'blocked' | 'done'

export const KANBAN_COLUMNS: { key: KanbanColumn; label: string }[] = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'todo', label: 'Da fare' },
  { key: 'doing', label: 'In corso' },
  { key: 'blocked', label: 'Bloccato' },
  { key: 'done', label: 'Fatto' },
]

export type Priority = 'low' | 'med' | 'high'

export interface ChecklistItem {
  id: ID
  text: string
  done: boolean
}

export interface KanbanCard {
  id: ID
  title: string
  notes?: string
  column: KanbanColumn
  priority: Priority
  tag?: string
  due?: string // ISO date
  checklist?: ChecklistItem[]
  createdAt: string
  updatedAt: string
  urgent?: boolean // Eisenhower axis
  important?: boolean // Eisenhower axis
}

export type DecisionStatus = 'open' | 'decided' | 'revisit'

export interface Decision {
  id: ID
  title: string
  date: string
  context: string
  options: string
  choice: string
  rationale: string
  status: DecisionStatus
}

export type ActionStatus = 'todo' | 'doing' | 'done'

export interface ActionItem {
  id: ID
  title: string
  owner?: string
  due?: string // ISO date
  status: ActionStatus
  createdAt: string
}

export interface QuickNote {
  id: ID
  text: string
  createdAt: string
  done: boolean
}

export type SprintKind = 'sprint' | 'train'
export type SprintStatus = 'planned' | 'active' | 'done'

export interface Sprint {
  id: ID
  name: string
  kind: SprintKind
  start?: string
  end?: string
  goals: string
  retroWell: string
  retroImprove: string
  status: SprintStatus
}

export type RiskSeverity = 'low' | 'med' | 'high'
export type RiskStatus = 'open' | 'mitigated' | 'closed'

export interface Risk {
  id: ID
  title: string
  severity: RiskSeverity
  status: RiskStatus
  notes?: string
  createdAt: string
}

/** DORA-style weekly self rating. Each metric is 1 (male) .. 5 (ottimo). */
export interface DoraEntry {
  id: ID
  weekOf: string // ISO date of the Monday
  leadTime: number
  deployFreq: number
  mttr: number
  changeFail: number
  note?: string
}

export const DORA_METRICS: { key: keyof DoraEntry; label: string; hint: string }[] = [
  { key: 'leadTime', label: 'Lead time', hint: 'Da commit a produzione' },
  { key: 'deployFreq', label: 'Freq. deploy', hint: 'Quanto spesso rilasciamo' },
  { key: 'mttr', label: 'MTTR', hint: 'Tempo di ripristino' },
  { key: 'changeFail', label: 'Change failure', hint: 'Rilasci che causano problemi' },
]

/** End-of-day snapshot used to auto-generate the next daily standup. */
export interface DailyLog {
  date: string // YYYY-MM-DD the log covers
  done: string[]
  notes: string
  carryOver: string[] // not finished -> goes to "today" at next standup
  blockers: string[]
  createdAt: string
}

export type DependencyType = 'ticket' | 'approval' | 'vendor' | 'team' | 'info'
export type DependencyStatus =
  | 'open'
  | 'waiting'
  | 'chased'
  | 'unblocked'
  | 'closed'
export type Criticality = 'low' | 'med' | 'high'

/** External dependency / blocker on another party (the "D" of a RAID log). */
export interface Dependency {
  id: ID
  title: string
  party: string // who you depend on (team / vendor / person)
  type: DependencyType
  ref?: string // ticket id / reference
  link?: string // URL to the ticket
  status: DependencyStatus
  neededBy?: string // ISO date
  owner?: string // who chases it on your side
  blocks?: string // what it blocks
  criticality: Criticality
  notes?: string
  lastUpdate: string // ISO datetime — drives aging
  createdAt: string
}

export const DEP_TYPES: { key: DependencyType; label: string }[] = [
  { key: 'ticket', label: 'Ticket' },
  { key: 'approval', label: 'Approvazione' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'team', label: 'Altro team' },
  { key: 'info', label: 'Info' },
]

export const DEP_STATUSES: { key: DependencyStatus; label: string }[] = [
  { key: 'open', label: 'Aperta' },
  { key: 'waiting', label: 'In attesa' },
  { key: 'chased', label: 'Sollecitata' },
  { key: 'unblocked', label: 'Sbloccata' },
  { key: 'closed', label: 'Chiusa' },
]

export type ThemeMode = 'light' | 'dark' | 'system'

export interface AppData {
  version: number
  people: Person[]
  kanban: KanbanCard[]
  decisions: Decision[]
  actions: ActionItem[]
  quickCapture: QuickNote[]
  weekTop: string[] // legacy single list (migrated into weeklyFocus)
  weeklyFocus: Record<string, string[]> // Monday ISO -> up to 3 strings
  weeklyFocusNotes: Record<string, string[]> // Monday ISO -> note per focus item
  dailyTop: Record<string, string[]> // 'YYYY-MM-DD' -> up to 3 strings
  dailyTopNotes: Record<string, string[]> // 'YYYY-MM-DD' -> note per priority
  dailyDone: Record<string, boolean[]> // 'YYYY-MM-DD' -> completion per priority
  sprints: Sprint[]
  risks: Risk[]
  dora: DoraEntry[]
  skillList: string[]
  dailyLogs: Record<string, DailyLog>
  dependencies: Dependency[]
  settings: { theme: ThemeMode; managerName?: string }
  updatedAt: string
}

export function defaultData(): AppData {
  return {
    version: 1,
    people: [],
    kanban: [],
    decisions: [],
    actions: [],
    quickCapture: [],
    weekTop: [],
    weeklyFocus: {},
    weeklyFocusNotes: {},
    dailyTop: {},
    dailyTopNotes: {},
    dailyDone: {},
    sprints: [],
    risks: [],
    dora: [],
    skillList: [],
    dailyLogs: {},
    dependencies: [],
    settings: { theme: 'system' },
    updatedAt: new Date().toISOString(),
  }
}

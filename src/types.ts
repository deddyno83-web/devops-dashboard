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
  priority?: Priority
  source?: 'art-sync' // provenance tag; undefined = created by hand
  syncDate?: string // for art-sync actions: the sync (YYYY-MM-DD) they came from
  streamId?: ID
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
  streamId?: ID // counterpart this dependency belongs to
  chaseCount?: number // "Sollecita" clicks — at 3+ the app flags "da escalare"
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

export type ActivityStatus = 'todo' | 'doing' | 'done'

/** A logged activity in the day's diary — the raw material of the standup. */
export interface Activity {
  id: ID
  text: string
  status: ActivityStatus
  note?: string
  owner?: string // assigned team member (for monitoring / delegation)
  streamId?: ID
  source?: 'art-sync' | 'inbox' // where the activity came from
  createdAt: string
  carryCount?: number // times carried over from previous days
  actionId?: ID // linked ActionItem — completing the activity completes the action
}

/* ------------------------------ ART Sync (SAFe) ---------------------------- *
 * Coach Sync (ex Scrum of Scrums) + PO Sync, facilitated by the RTE.
 * Focus: progress toward PI objectives, impediments, cross-team dependencies,
 * risks (ROAM) and scope/priority changes. Output = actions with owners.      */

export type ArtSyncCategory =
  | 'progress'
  | 'impediment'
  | 'dependency'
  | 'risk'
  | 'scope'

/** SAFe risk handling: Resolved / Owned / Accepted / Mitigated. */
export type RoamStatus = 'resolved' | 'owned' | 'accepted' | 'mitigated'

export interface ArtSyncPoint {
  id: ID
  /** Legacy taxonomy — kept for old data; new points use `sectionId`. */
  category: ArtSyncCategory
  sectionId?: ID // SyncSection this point belongs to
  text: string
  note?: string
  reported: boolean
  roam?: RoamStatus // only meaningful for category 'risk'
}

export interface ArtSyncAction {
  id: ID
  title: string
  owner?: string
  priority: Priority
  due?: string
  done: boolean
  createdAt: string
}

export interface ArtSync {
  date: string // YYYY-MM-DD
  points: ArtSyncPoint[]
  /** Legacy: actions now live in AppData.actions (source 'art-sync'); emptied by migration. */
  actions: ArtSyncAction[]
  /** RoamRisk ids marked as "reported" during this sync. */
  reportedRisks?: ID[]
  createdAt: string
}

export const ART_CATEGORIES: {
  key: ArtSyncCategory
  label: string
  hint: string
  suggestable?: boolean
}[] = [
  { key: 'progress', label: 'Progresso', hint: 'verso obiettivi di PI / feature' },
  { key: 'impediment', label: 'Impedimenti', hint: 'da escalare', suggestable: true },
  { key: 'dependency', label: 'Dipendenze a rischio', hint: 'cross-team', suggestable: true },
  { key: 'risk', label: 'Rischi (ROAM)', hint: 'Resolved / Owned / Accepted / Mitigated' },
  { key: 'scope', label: 'Scope / priorità', hint: 'parte PO Sync' },
]

export const ROAM_STATUSES: { key: RoamStatus; label: string }[] = [
  { key: 'resolved', label: 'Resolved' },
  { key: 'owned', label: 'Owned' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'mitigated', label: 'Mitigated' },
]

/**
 * Persistent ROAM risk register (SAFe): a risk lives across syncs until it
 * becomes Resolved — it is not a per-meeting note.
 */
export interface RoamRisk {
  id: ID
  title: string
  roam?: RoamStatus // undefined = still to classify
  owner?: string
  note?: string
  createdAt: string
  updatedAt: string
}

/* ------------------------- Weekly close (retrospettiva) -------------------- */
export interface WeeklyReviewStats {
  activitiesDone: number
  activitiesCarried: number
  kanbanDone: number
  depsClosed: number
  risksResolved: number
  avgCycleTimeDays?: number
}

/** Friday ritual: numbers are snapshotted at close time so history stays stable. */
export interface WeeklyReview {
  weekOf: string // Monday ISO of the closed week
  wentWell: string
  toImprove: string
  notes: string
  stats: WeeklyReviewStats
  closedAt: string
}

/* ------------------------------ DevOps roadmap ----------------------------- */
export type RoadmapHorizon = 'now' | 'next' | 'later'
export type RoadmapStatus = 'planned' | 'active' | 'done'

export interface RoadmapItem {
  id: ID
  title: string
  description?: string
  area?: string // CI/CD, Observability, Security, FinOps…
  horizon: RoadmapHorizon
  status: RoadmapStatus
  target?: string // free text, e.g. "Q4 2026"
  createdAt: string
  updatedAt: string
}

export const ROADMAP_HORIZONS: {
  key: RoadmapHorizon
  label: string
  hint: string
}[] = [
  { key: 'now', label: 'Adesso', hint: 'in lavorazione / prossime settimane' },
  { key: 'next', label: 'Prossimo', hint: 'prossimo trimestre / PI' },
  { key: 'later', label: 'Più avanti', hint: 'visione, senza impegno di data' },
]

/* ------------------------------- Streams ---------------------------------- *
 * A stream is a workflow / counterpart: CCoE, Digital CCoE, the internal team,
 * RunOps… It is the same taxonomy used in the ART Sync presentation, so tagging
 * items by stream lets the agenda compose itself.                             */

export interface Stream {
  id: ID
  name: string
  color: string
  external: boolean // true = external counterpart with its own backlog
  order: number
}

export const DEFAULT_STREAMS: Omit<Stream, 'id'>[] = [
  { name: 'CCoE', color: 'oklch(0.65 0.16 264)', external: true, order: 0 },
  { name: 'Digital CCoE', color: 'oklch(0.6 0.17 320)', external: true, order: 1 },
  { name: 'Team interno', color: 'oklch(0.65 0.15 160)', external: false, order: 2 },
  { name: 'RunOps', color: 'oklch(0.7 0.15 70)', external: true, order: 3 },
]

/* --------------------------- ART Sync agenda ------------------------------ */
export type SyncSectionKind =
  | 'stream' // auto-fills from items tagged with `streamId`
  | 'dependencies' // auto-fills from open/at-risk external dependencies
  | 'meeting' // external meetings to report
  | 'risks' // the persistent ROAM register
  | 'free' // free text section

export interface SyncSection {
  id: ID
  label: string
  kind: SyncSectionKind
  streamId?: ID
  order: number
}

/* ------------------------------ Inbox / intake ---------------------------- */
export type InboxSource = 'mail' | 'meeting' | 'sync' | 'chat' | 'idea'

export const INBOX_SOURCES: { key: InboxSource; label: string }[] = [
  { key: 'mail', label: 'Mail' },
  { key: 'meeting', label: 'Meeting' },
  { key: 'sync', label: 'ART Sync' },
  { key: 'chat', label: 'Chat' },
  { key: 'idea', label: 'Idea' },
]

/** Everything that arrives lands here first, then gets triaged. */
export interface InboxItem {
  id: ID
  text: string
  note?: string
  source: InboxSource
  streamId?: ID
  /** Assigned while still in the inbox: stays visible so it can be monitored. */
  owner?: string
  createdAt: string
  triagedAt?: string // undefined = still to triage
  outcome?: string // what it became, e.g. "Card Kanban"
}

/* ------------------- External backlog items you monitor ------------------- */
export type ExternalItemStatus = 'watching' | 'progress' | 'done' | 'dropped'

export const EXTERNAL_STATUSES: { key: ExternalItemStatus; label: string }[] = [
  { key: 'watching', label: 'Da seguire' },
  { key: 'progress', label: 'In corso' },
  { key: 'done', label: 'Chiuso' },
  { key: 'dropped', label: 'Abbandonato' },
]

/**
 * An item in ANOTHER team's backlog (CCoE, RunOps…) that you do not manage but
 * must keep an eye on. `lastCheck` drives the "da ricontrollare" ageing.
 */
export interface ExternalItem {
  id: ID
  streamId: ID
  title: string
  ref?: string
  link?: string
  status: ExternalItemStatus
  note?: string
  lastCheck: string
  createdAt: string
}

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
  dailyActivities: Record<string, Activity[]> // 'YYYY-MM-DD' -> activity diary
  sprints: Sprint[]
  risks: Risk[]
  dora: DoraEntry[]
  skillList: string[]
  dailyLogs: Record<string, DailyLog>
  dependencies: Dependency[]
  artSyncs: Record<string, ArtSync>
  roamRisks: RoamRisk[]
  weeklyReviews: Record<string, WeeklyReview>
  roadmap: RoadmapItem[]
  streams: Stream[]
  syncAgenda: SyncSection[]
  inbox: InboxItem[]
  externalItems: ExternalItem[]
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
    dailyActivities: {},
    sprints: [],
    risks: [],
    dora: [],
    skillList: [],
    dailyLogs: {},
    dependencies: [],
    artSyncs: {},
    roamRisks: [],
    weeklyReviews: {},
    roadmap: [],
    streams: [],
    syncAgenda: [],
    inbox: [],
    externalItems: [],
    settings: { theme: 'system' },
    updatedAt: new Date().toISOString(),
  }
}

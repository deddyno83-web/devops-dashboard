import type { Priority } from '../types'

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export interface ParsedCapture {
  title: string
  owner?: string
  priority?: Priority
  due?: string
}

/** Parse quick-capture text with inline tokens: @owner, !priorità, /scadenza. */
export function parseCapture(text: string, people: string[] = []): ParsedCapture {
  let working = ` ${text} `
  let owner: string | undefined
  let priority: Priority | undefined
  let due: string | undefined

  const pr = working.match(/!\s*(alta|high|media|med(?:ium)?|bassa|low)\b/i)
  if (pr) {
    const v = pr[1].toLowerCase()
    priority =
      v.startsWith('a') || v === 'high'
        ? 'high'
        : v.startsWith('b') || v === 'low'
          ? 'low'
          : 'med'
    working = working.replace(pr[0], ' ')
  }

  const ow = working.match(/@([\p{L}][\p{L}'’-]*)/u)
  if (ow) {
    const token = ow[1].toLowerCase()
    const match = people.find(
      (p) =>
        p.toLowerCase().startsWith(token) ||
        p.toLowerCase().split(/\s+/).some((part) => part.startsWith(token)),
    )
    owner = match ?? ow[1]
    working = working.replace(ow[0], ' ')
  }

  const du = working.match(/\/(\S+)/)
  if (du) {
    const parsed = parseDueToken(du[1])
    if (parsed) {
      due = parsed
      working = working.replace(du[0], ' ')
    }
  }

  return { title: working.replace(/\s+/g, ' ').trim(), owner, priority, due }
}

function parseDueToken(tok: string): string | undefined {
  const t = tok.toLowerCase()
  const today = new Date(todayISO() + 'T00:00:00')
  const fmt = (d: Date) => {
    const tz = d.getTimezoneOffset() * 60000
    return new Date(d.getTime() - tz).toISOString().slice(0, 10)
  }
  if (t === 'oggi') return todayISO()
  if (t === 'domani') return fmt(new Date(today.getTime() + 86400000))
  if (t === 'dopodomani') return fmt(new Date(today.getTime() + 2 * 86400000))
  const plus = t.match(/^\+(\d+)$/)
  if (plus) return fmt(new Date(today.getTime() + parseInt(plus[1]) * 86400000))
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const days = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']
  const idx = days.findIndex((d) => t.startsWith(d))
  if (idx >= 0) {
    let delta = (idx - today.getDay() + 7) % 7
    if (delta === 0) delta = 7
    return fmt(new Date(today.getTime() + delta * 86400000))
  }
  return undefined
}

export function uid(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  )
}

export function todayISO(): string {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}

export function nowISO(): string {
  return new Date().toISOString()
}

const MONTHS = [
  'gen', 'feb', 'mar', 'apr', 'mag', 'giu',
  'lug', 'ago', 'set', 'ott', 'nov', 'dic',
]

export function fmtDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

/** Whole days from `iso` until today (negative = in the past). */
export function daysFromToday(iso?: string): number | null {
  if (!iso) return null
  const target = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
  if (isNaN(target.getTime())) return null
  const today = new Date(todayISO() + 'T00:00:00')
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

/** Human relative label in Italian, e.g. "oggi", "fra 3 giorni", "5 giorni fa". */
export function relativeDays(iso?: string): string {
  const d = daysFromToday(iso)
  if (d === null) return '—'
  if (d === 0) return 'oggi'
  if (d === 1) return 'domani'
  if (d === -1) return 'ieri'
  if (d > 1) return `fra ${d} giorni`
  return `${Math.abs(d)} giorni fa`
}

/** ISO date (YYYY-MM-DD) of the Monday of the week containing `ref`. */
export function mondayOf(ref: Date = new Date()): string {
  const d = new Date(ref)
  const day = (d.getDay() + 6) % 7 // 0 = Monday
  d.setDate(d.getDate() - day)
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}

/** Short label like "9 giu" for a week-of date. */
export function weekLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return `${d.getDate()} ${
    ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'][
      d.getMonth()
    ]
  }`
}

export function ageInDays(isoCreated: string): number {
  const created = new Date(isoCreated)
  if (isNaN(created.getTime())) return 0
  return Math.floor((Date.now() - created.getTime()) / 86400000)
}

const AVATAR_COLORS = [
  'oklch(0.65 0.16 264)',
  'oklch(0.65 0.15 160)',
  'oklch(0.7 0.15 70)',
  'oklch(0.62 0.2 25)',
  'oklch(0.6 0.17 320)',
  'oklch(0.6 0.13 200)',
]

export function pickColor(seed: number): string {
  return AVATAR_COLORS[seed % AVATAR_COLORS.length]
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

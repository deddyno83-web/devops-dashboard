import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { parseCapture, uid, nowISO, cn } from '../lib/utils'
import type { Priority } from '../types'
import {
  IconHome,
  IconBoard,
  IconUsers,
  IconActivity,
  IconFile,
  IconPrint,
  IconPlus,
  IconCheck,
  IconSun,
  IconLink,
} from './icons'

export type NavTab =
  | 'daily'
  | 'standup'
  | 'kanban'
  | 'dependencies'
  | 'team'
  | 'sprint'
  | 'decisions'
  | 'report'

const NAV: { tab: NavTab; label: string; icon: typeof IconHome }[] = [
  { tab: 'daily', label: 'Oggi', icon: IconHome },
  { tab: 'standup', label: 'Standup', icon: IconSun },
  { tab: 'kanban', label: 'Kanban', icon: IconBoard },
  { tab: 'dependencies', label: 'Dipendenze', icon: IconLink },
  { tab: 'team', label: 'Team & 1:1', icon: IconUsers },
  { tab: 'decisions', label: 'Decisioni & Azioni', icon: IconFile },
  { tab: 'report', label: 'Report', icon: IconPrint },
]

interface Item {
  id: string
  group: string
  label: string
  hint?: string
  icon: typeof IconHome
  run: () => void
}

export function CommandPalette({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean
  onClose: () => void
  onNavigate: (tab: NavTab) => void
}) {
  const { data, update } = useStore()
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSel(0)
      setTimeout(() => inputRef.current?.focus(), 20)
    }
  }, [open])

  const peopleNames = data.people.map((p) => p.name)
  const q = query.trim()
  const ql = q.toLowerCase()

  const items = useMemo<Item[]>(() => {
    const go = (tab: NavTab) => () => {
      onNavigate(tab)
      onClose()
    }
    const list: Item[] = []

    // Create actions (only when there is text to act on)
    if (q) {
      const parsed = parseCapture(q, peopleNames)
      const title = parsed.title || q
      const parts = [
        parsed.priority && `priorità ${prLabel(parsed.priority)}`,
        parsed.owner && `owner ${parsed.owner}`,
        parsed.due && `scad. ${parsed.due}`,
      ].filter(Boolean)
      const hint = parts.length ? parts.join(' · ') : undefined

      list.push({
        id: 'new-kanban',
        group: 'Crea',
        label: `Nuova card Kanban: «${title}»`,
        hint,
        icon: IconPlus,
        run: () => {
          update((d) =>
            d.kanban.unshift({
              id: uid(),
              title,
              column: 'todo',
              priority: parsed.priority ?? 'med',
              tag: parsed.owner,
              createdAt: nowISO(),
              updatedAt: nowISO(),
            }),
          )
          onNavigate('kanban')
          onClose()
        },
      })
      list.push({
        id: 'new-action',
        group: 'Crea',
        label: `Nuovo action item: «${title}»`,
        hint,
        icon: IconCheck,
        run: () => {
          update((d) =>
            d.actions.unshift({
              id: uid(),
              title,
              owner: parsed.owner,
              due: parsed.due,
              status: 'todo',
              createdAt: nowISO(),
            }),
          )
          onNavigate('decisions')
          onClose()
        },
      })
      list.push({
        id: 'new-capture',
        group: 'Crea',
        label: `Aggiungi a Quick capture: «${q}»`,
        icon: IconPlus,
        run: () => {
          update((d) =>
            d.quickCapture.unshift({
              id: uid(),
              text: q,
              createdAt: nowISO(),
              done: false,
            }),
          )
          onNavigate('daily')
          onClose()
        },
      })
    }

    // Navigation
    for (const n of NAV) {
      if (!q || n.label.toLowerCase().includes(ql)) {
        list.push({
          id: `nav-${n.tab}`,
          group: 'Vai a',
          label: n.label,
          icon: n.icon,
          run: go(n.tab),
        })
      }
    }

    // Search across entities (only when querying)
    if (q) {
      for (const p of data.people.filter((p) => p.name.toLowerCase().includes(ql)).slice(0, 5))
        list.push({ id: `p-${p.id}`, group: 'Risultati', label: p.name, hint: p.role || 'persona', icon: IconUsers, run: go('team') })
      for (const c of data.kanban.filter((c) => c.title.toLowerCase().includes(ql)).slice(0, 5))
        list.push({ id: `k-${c.id}`, group: 'Risultati', label: c.title, hint: 'card Kanban', icon: IconBoard, run: go('kanban') })
      for (const a of data.actions.filter((a) => a.title.toLowerCase().includes(ql)).slice(0, 5))
        list.push({ id: `a-${a.id}`, group: 'Risultati', label: a.title, hint: 'action item', icon: IconCheck, run: go('decisions') })
      for (const dec of data.decisions.filter((x) => x.title.toLowerCase().includes(ql)).slice(0, 5))
        list.push({ id: `d-${dec.id}`, group: 'Risultati', label: dec.title, hint: 'decisione', icon: IconFile, run: go('decisions') })
    }

    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, data])

  useEffect(() => {
    if (sel >= items.length) setSel(0)
  }, [items.length, sel])

  if (!open) return null

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(s + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      items[sel]?.run()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  let lastGroup = ''
  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-[var(--radius)] border bg-[var(--color-surface)] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSel(0)
          }}
          onKeyDown={onKey}
          placeholder="Cerca, oppure scrivi e crea…  es. «Chiamare vendor @Luca !alta /ven»"
          className="w-full border-b bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-[var(--color-muted)]"
        />
        <div className="max-h-[55vh] overflow-y-auto py-1.5">
          {items.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-[var(--color-muted)]">
              Nessun risultato.
            </p>
          )}
          {items.map((it, i) => {
            const showGroup = it.group !== lastGroup
            lastGroup = it.group
            const Icon = it.icon
            return (
              <div key={it.id}>
                {showGroup && (
                  <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    {it.group}
                  </p>
                )}
                <button
                  onMouseEnter={() => setSel(i)}
                  onClick={() => it.run()}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2 text-left text-sm',
                    i === sel
                      ? 'bg-[var(--color-accent)] text-[var(--color-primary)]'
                      : 'hover:bg-[var(--color-surface-2)]',
                  )}
                >
                  <Icon width={16} height={16} className="shrink-0" />
                  <span className="flex-1 truncate">{it.label}</span>
                  {it.hint && (
                    <span className="shrink-0 text-xs text-[var(--color-muted)]">
                      {it.hint}
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-3 border-t px-4 py-2 text-[11px] text-[var(--color-muted)]">
          <span>↑↓ naviga</span>
          <span>↵ esegui</span>
          <span>esc chiudi</span>
          <span className="ml-auto">@owner · !priorità · /scadenza</span>
        </div>
      </div>
    </div>
  )
}

function prLabel(p: Priority): string {
  return p === 'high' ? 'alta' : p === 'low' ? 'bassa' : 'media'
}

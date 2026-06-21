import { useState } from 'react'
import { useStore } from '../store'
import {
  KANBAN_COLUMNS,
  type KanbanCard,
  type KanbanColumn,
  type Priority,
  type ChecklistItem,
} from '../types'
import {
  Button,
  Badge,
  Modal,
  Field,
  Input,
  Textarea,
  Select,
  PageHeader,
} from '../components/ui'
import {
  IconPlus,
  IconTrash,
  IconBoard,
  IconGrid,
  IconCheck,
  IconCalendar,
  IconWarn,
  IconX,
} from '../components/icons'
import {
  uid,
  nowISO,
  ageInDays,
  cn,
  daysFromToday,
  relativeDays,
} from '../lib/utils'
import { GuideButton } from '../components/Guide'

const PRIORITY_META: Record<
  Priority,
  { label: string; color: any; stripe: string; weight: number }
> = {
  high: { label: 'Alta', color: 'danger', stripe: 'var(--color-danger)', weight: 0 },
  med: { label: 'Media', color: 'warning', stripe: 'var(--color-warning)', weight: 1 },
  low: { label: 'Bassa', color: 'neutral', stripe: 'var(--color-border)', weight: 2 },
}

const emptyDraft = (): Partial<KanbanCard> => ({
  title: '',
  notes: '',
  column: 'todo',
  priority: 'med',
  tag: '',
  due: '',
  checklist: [],
})

export default function KanbanView() {
  const { data, update } = useStore()
  const [editing, setEditing] = useState<KanbanCard | null>(null)
  const [draft, setDraft] = useState<Partial<KanbanCard> | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<KanbanColumn | null>(null)
  const [view, setView] = useState<'board' | 'matrix'>('board')

  // Filters & sort
  const [fText, setFText] = useState('')
  const [fTag, setFTag] = useState('')
  const [fPriority, setFPriority] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [sortMode, setSortMode] = useState<'manual' | 'priority'>('manual')

  // Inline quick-add per column
  const [addText, setAddText] = useState<Record<string, string>>({})

  function setQuadrant(id: string, urgent: boolean, important: boolean) {
    update((d) => {
      const c = d.kanban.find((x) => x.id === id)
      if (c) {
        c.urgent = urgent
        c.important = important
        c.updatedAt = nowISO()
      }
    })
  }

  function openNew(column: KanbanColumn = 'todo') {
    setEditing(null)
    setDraft({ ...emptyDraft(), column })
  }

  function openEdit(card: KanbanCard) {
    setEditing(card)
    setDraft({ ...card, checklist: card.checklist ? [...card.checklist] : [] })
  }

  function save() {
    if (!draft || !draft.title?.trim()) return
    update((d) => {
      if (editing) {
        const c = d.kanban.find((x) => x.id === editing.id)
        if (c) {
          c.title = draft.title!.trim()
          c.notes = draft.notes
          c.column = draft.column as KanbanColumn
          c.priority = draft.priority as Priority
          c.tag = draft.tag?.trim() || undefined
          c.due = draft.due || undefined
          c.checklist = draft.checklist
          c.updatedAt = nowISO()
        }
      } else {
        const card: KanbanCard = {
          id: uid(),
          title: draft.title!.trim(),
          notes: draft.notes,
          column: draft.column as KanbanColumn,
          priority: (draft.priority as Priority) ?? 'med',
          tag: draft.tag?.trim() || undefined,
          due: draft.due || undefined,
          checklist: draft.checklist,
          createdAt: nowISO(),
          updatedAt: nowISO(),
        }
        insertAtColumnEnd(d.kanban, card)
      }
    })
    setDraft(null)
    setEditing(null)
  }

  function remove(id: string) {
    update((d) => {
      d.kanban = d.kanban.filter((c) => c.id !== id)
    })
    setDraft(null)
    setEditing(null)
  }

  // Move (and reorder) a card. beforeId places it just before that card.
  function moveCard(id: string, column: KanbanColumn, beforeId?: string) {
    if (id === beforeId) return
    update((d) => {
      const idx = d.kanban.findIndex((c) => c.id === id)
      if (idx < 0) return
      const [card] = d.kanban.splice(idx, 1)
      card.column = column
      card.updatedAt = nowISO()
      if (beforeId) {
        const t = d.kanban.findIndex((c) => c.id === beforeId)
        d.kanban.splice(t < 0 ? d.kanban.length : t, 0, card)
      } else {
        insertAtColumnEnd(d.kanban, card)
      }
    })
  }

  function addInline(col: KanbanColumn) {
    const t = (addText[col] ?? '').trim()
    if (!t) return
    update((d) => {
      insertAtColumnEnd(d.kanban, {
        id: uid(),
        title: t,
        column: col,
        priority: 'med',
        createdAt: nowISO(),
        updatedAt: nowISO(),
      })
    })
    setAddText((s) => ({ ...s, [col]: '' }))
  }

  // --- KPI (whole board) ---
  const notDone = data.kanban.filter((c) => c.column !== 'done')
  const kpis = [
    { label: 'In corso', value: data.kanban.filter((c) => c.column === 'doing').length, color: 'var(--color-primary)' },
    { label: 'Bloccate', value: data.kanban.filter((c) => c.column === 'blocked').length, color: 'var(--color-danger)' },
    { label: 'In scadenza', value: notDone.filter((c) => { const d = daysFromToday(c.due); return d !== null && d >= 0 && d <= 3 }).length, color: 'var(--color-warning)' },
    { label: 'Scadute', value: notDone.filter((c) => { const d = daysFromToday(c.due); return d !== null && d < 0 }).length, color: 'var(--color-danger)' },
    { label: 'Ferme ≥7g', value: notDone.filter((c) => ageInDays(c.updatedAt) >= 7).length, color: 'var(--color-muted)' },
  ]

  const tags = Array.from(new Set(data.kanban.map((c) => c.tag).filter(Boolean))) as string[]
  const wip = data.kanban.filter((c) => c.column === 'doing').length
  const filtersActive = !!(fText || fTag || fPriority || overdueOnly)

  function matches(c: KanbanCard): boolean {
    if (fText && !`${c.title} ${c.notes ?? ''} ${c.tag ?? ''}`.toLowerCase().includes(fText.toLowerCase())) return false
    if (fTag && c.tag !== fTag) return false
    if (fPriority && c.priority !== fPriority) return false
    if (overdueOnly) {
      const d = daysFromToday(c.due)
      if (!(c.column !== 'done' && d !== null && d < 0)) return false
    }
    return true
  }

  function columnCards(col: KanbanColumn): KanbanCard[] {
    const list = data.kanban.filter((c) => c.column === col && matches(c))
    if (sortMode === 'priority')
      return [...list].sort((a, b) => PRIORITY_META[a.priority].weight - PRIORITY_META[b.priority].weight)
    return list
  }

  return (
    <div>
      <PageHeader
        title="Kanban personale"
        subtitle="Le tue attività da manager: hiring, vendor, escalation, decisioni, architettura."
        actions={
          <>
            <GuideButton section="kanban" />
            <Badge color={wip > 3 ? 'danger' : 'neutral'}>WIP in corso: {wip}</Badge>
            <Button variant="primary" onClick={() => openNew()}>
              <IconPlus /> Nuova card
            </Button>
          </>
        }
      />

      {/* KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="flex items-center gap-3 rounded-[var(--radius)] border bg-[var(--color-surface)] px-3 py-2"
          >
            <span className="h-7 w-1 rounded-full" style={{ background: k.color }} />
            <div className="leading-tight">
              <div className="text-xl font-semibold tabular-nums">{k.value}</div>
              <div className="text-[11px] text-[var(--color-muted)]">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* View tabs */}
      <div className="mb-3 inline-flex rounded-[calc(var(--radius)-0.2rem)] border bg-[var(--color-surface-2)]/50 p-1 text-sm">
        <button
          onClick={() => setView('board')}
          className={cn(
            'flex items-center gap-1.5 rounded-[calc(var(--radius)-0.35rem)] px-3 py-1.5 font-medium transition-colors',
            view === 'board' ? 'bg-[var(--color-surface)] shadow-sm' : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]',
          )}
        >
          <IconBoard width={15} height={15} /> Flusso
        </button>
        <button
          onClick={() => setView('matrix')}
          className={cn(
            'flex items-center gap-1.5 rounded-[calc(var(--radius)-0.35rem)] px-3 py-1.5 font-medium transition-colors',
            view === 'matrix' ? 'bg-[var(--color-surface)] shadow-sm' : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]',
          )}
        >
          <IconGrid width={15} height={15} /> Eisenhower
        </button>
      </div>

      {/* Filter bar */}
      {view === 'board' && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input
            value={fText}
            onChange={(e) => setFText(e.target.value)}
            placeholder="Filtra per testo…"
            className="h-8 w-44"
          />
          <Select value={fTag} onChange={(e) => setFTag(e.target.value)} className="h-8">
            <option value="">Tutti i tag</option>
            {tags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
          <Select value={fPriority} onChange={(e) => setFPriority(e.target.value)} className="h-8">
            <option value="">Tutte le priorità</option>
            <option value="high">Alta</option>
            <option value="med">Media</option>
            <option value="low">Bassa</option>
          </Select>
          <Button
            size="sm"
            variant={overdueOnly ? 'primary' : 'outline'}
            onClick={() => setOverdueOnly((v) => !v)}
          >
            <IconWarn width={14} height={14} /> Solo scadute
          </Button>
          {filtersActive && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setFText('')
                setFTag('')
                setFPriority('')
                setOverdueOnly(false)
              }}
            >
              <IconX width={14} height={14} /> Pulisci
            </Button>
          )}
          <div className="ml-auto flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
            <span>Ordina:</span>
            <button
              onClick={() => setSortMode('manual')}
              className={cn('rounded px-2 py-1', sortMode === 'manual' ? 'bg-[var(--color-surface-2)] font-medium text-[var(--color-fg)]' : 'hover:text-[var(--color-fg)]')}
            >
              Manuale
            </button>
            <button
              onClick={() => setSortMode('priority')}
              className={cn('rounded px-2 py-1', sortMode === 'priority' ? 'bg-[var(--color-surface-2)] font-medium text-[var(--color-fg)]' : 'hover:text-[var(--color-fg)]')}
            >
              Priorità
            </button>
          </div>
        </div>
      )}

      {view === 'board' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {KANBAN_COLUMNS.map((col) => {
            const cards = columnCards(col.key)
            return (
              <div
                key={col.key}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOverCol(col.key)
                }}
                onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
                onDrop={() => {
                  if (dragId) moveCard(dragId, col.key)
                  setDragId(null)
                  setOverCol(null)
                }}
                className={cn(
                  'flex flex-col rounded-[var(--radius)] border bg-[var(--color-surface-2)]/40 p-2 transition-colors',
                  overCol === col.key && 'border-[var(--color-primary)] bg-[color-mix(in_oklch,var(--color-primary)_8%,transparent)]',
                )}
              >
                <div className="flex items-center justify-between px-1.5 py-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    {col.label}
                  </span>
                  <span className="text-xs text-[var(--color-muted)]">{cards.length}</span>
                </div>

                <div className="flex min-h-[40px] flex-1 flex-col gap-2">
                  {cards.map((card) => (
                    <KanbanCardItem
                      key={card.id}
                      card={card}
                      onClick={() => openEdit(card)}
                      onDragStart={() => setDragId(card.id)}
                      onDragEnd={() => setDragId(null)}
                      onDropBefore={() => {
                        if (dragId) moveCard(dragId, card.column, card.id)
                        setDragId(null)
                        setOverCol(null)
                      }}
                    />
                  ))}
                </div>

                <input
                  value={addText[col.key] ?? ''}
                  onChange={(e) => setAddText((s) => ({ ...s, [col.key]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && addInline(col.key)}
                  placeholder="+ aggiungi e Invio"
                  className="mt-2 h-8 rounded-[calc(var(--radius)-0.25rem)] border border-dashed bg-transparent px-2.5 text-xs outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:bg-[var(--color-bg)]"
                />
              </div>
            )
          })}
        </div>
      )}

      {view === 'matrix' && (
        <EisenhowerMatrix
          cards={data.kanban.filter(matches)}
          onSetQuadrant={setQuadrant}
          onOpen={openEdit}
        />
      )}

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={editing ? 'Modifica card' : 'Nuova card'}
        wide
        footer={
          <>
            {editing && (
              <Button variant="danger" onClick={() => remove(editing.id)} className="mr-auto">
                <IconTrash width={15} height={15} /> Elimina
              </Button>
            )}
            <Button onClick={() => setDraft(null)}>Annulla</Button>
            <Button variant="primary" onClick={save}>Salva</Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-3">
            <Field label="Titolo">
              <Input
                autoFocus
                value={draft.title ?? ''}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Es. Valutare vendor monitoring"
              />
            </Field>
            <Field label="Note">
              <Textarea
                rows={2}
                value={draft.notes ?? ''}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Contesto, prossimi passi…"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Colonna">
                <Select value={draft.column} onChange={(e) => setDraft({ ...draft, column: e.target.value as KanbanColumn })} className="w-full">
                  {KANBAN_COLUMNS.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Priorità">
                <Select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as Priority })} className="w-full">
                  <option value="high">Alta</option>
                  <option value="med">Media</option>
                  <option value="low">Bassa</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tag">
                <Input value={draft.tag ?? ''} onChange={(e) => setDraft({ ...draft, tag: e.target.value })} placeholder="hiring…" />
              </Field>
              <Field label="Scadenza">
                <Input type="date" value={draft.due ?? ''} onChange={(e) => setDraft({ ...draft, due: e.target.value })} />
              </Field>
            </div>
            <ChecklistEditor
              items={draft.checklist ?? []}
              onChange={(items) => setDraft({ ...draft, checklist: items })}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}

function insertAtColumnEnd(arr: KanbanCard[], card: KanbanCard) {
  let lastIdx = -1
  arr.forEach((c, i) => {
    if (c.column === card.column) lastIdx = i
  })
  arr.splice(lastIdx + 1, 0, card)
}

function KanbanCardItem({
  card,
  onClick,
  onDragStart,
  onDragEnd,
  onDropBefore,
}: {
  card: KanbanCard
  onClick: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onDropBefore: () => void
}) {
  const [over, setOver] = useState(false)
  const age = ageInDays(card.updatedAt)
  const stale = card.column !== 'done' && age >= 7
  const pr = PRIORITY_META[card.priority]
  const dueDays = daysFromToday(card.due)
  const overdue = card.column !== 'done' && dueDays !== null && dueDays < 0
  const done = (card.checklist ?? []).filter((c) => c.done).length
  const total = (card.checklist ?? []).length

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.stopPropagation()
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.stopPropagation()
        setOver(false)
        onDropBefore()
      }}
      onClick={onClick}
      style={{ borderLeft: `3px solid ${pr.stripe}` }}
      className={cn(
        'group cursor-pointer rounded-[calc(var(--radius)-0.2rem)] border bg-[var(--color-surface)] p-2.5 shadow-sm transition-shadow hover:shadow-md',
        over && 'ring-2 ring-[var(--color-primary)]',
      )}
    >
      <p className="text-sm font-medium leading-snug">{card.title}</p>
      {card.notes && (
        <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">{card.notes}</p>
      )}

      {total > 0 && (
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between text-[10px] text-[var(--color-muted)]">
            <span>checklist</span>
            <span>{done}/{total}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all"
              style={{ width: `${total ? (done / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge color={pr.color}>{pr.label}</Badge>
        {card.tag && <Badge color="primary">{card.tag}</Badge>}
        {card.due && (
          <Badge color={overdue ? 'danger' : dueDays !== null && dueDays <= 3 ? 'warning' : 'neutral'}>
            <IconCalendar width={11} height={11} /> {relativeDays(card.due)}
          </Badge>
        )}
        {stale && <Badge color="danger">fermo da {age}g</Badge>}
      </div>
    </div>
  )
}

function ChecklistEditor({
  items,
  onChange,
}: {
  items: ChecklistItem[]
  onChange: (items: ChecklistItem[]) => void
}) {
  const [text, setText] = useState('')
  const done = items.filter((i) => i.done).length
  return (
    <Field label={`Checklist${items.length ? ` (${done}/${items.length})` : ''}`}>
      <div className="space-y-1.5">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-2">
            <button
              onClick={() =>
                onChange(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))
              }
              className={cn(
                'grid h-5 w-5 shrink-0 place-items-center rounded-md border text-white',
                it.done ? 'border-[var(--color-success)] bg-[var(--color-success)]' : 'bg-transparent text-transparent',
              )}
            >
              <IconCheck width={13} height={13} />
            </button>
            <span className={cn('flex-1 text-sm', it.done && 'text-[var(--color-muted)] line-through')}>
              {it.text}
            </span>
            <button
              onClick={() => onChange(items.filter((x) => x.id !== it.id))}
              className="text-[var(--color-muted)] hover:text-[var(--color-danger)]"
            >
              <IconTrash width={14} height={14} />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && text.trim()) {
                onChange([...items, { id: uid(), text: text.trim(), done: false }])
                setText('')
              }
            }}
            placeholder="Aggiungi sotto-attività e Invio"
          />
        </div>
      </div>
    </Field>
  )
}

/* --------------------------- Eisenhower matrix ---------------------------- */
const QUADRANTS = [
  { key: 'do', title: 'Fai subito', sub: 'Importante · Urgente', urgent: true, important: true, color: 'var(--color-danger)' },
  { key: 'plan', title: 'Pianifica', sub: 'Importante · Non urgente', urgent: false, important: true, color: 'var(--color-success)' },
  { key: 'delegate', title: 'Delega', sub: 'Non importante · Urgente', urgent: true, important: false, color: 'var(--color-warning)' },
  { key: 'drop', title: 'Elimina / Rimanda', sub: 'Non importante · Non urgente', urgent: false, important: false, color: 'var(--color-muted)' },
] as const

function EisenhowerMatrix({
  cards,
  onSetQuadrant,
  onOpen,
}: {
  cards: KanbanCard[]
  onSetQuadrant: (id: string, urgent: boolean, important: boolean) => void
  onOpen: (card: KanbanCard) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  const active = cards.filter((c) => c.column !== 'done')
  const unclassified = active.filter((c) => c.urgent === undefined || c.important === undefined)

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {QUADRANTS.map((q) => {
          const items = active.filter((c) => c.urgent === q.urgent && c.important === q.important)
          return (
            <div
              key={q.key}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(q.key)
              }}
              onDragLeave={() => setOver((o) => (o === q.key ? null : o))}
              onDrop={() => {
                if (dragId) onSetQuadrant(dragId, q.urgent, q.important)
                setDragId(null)
                setOver(null)
              }}
              className={cn(
                'min-h-[140px] rounded-[var(--radius)] border p-3 transition-colors',
                over === q.key ? 'border-[var(--color-primary)] bg-[color-mix(in_oklch,var(--color-primary)_8%,transparent)]' : 'bg-[var(--color-surface-2)]/40',
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: q.color }} />
                <span className="text-sm font-semibold">{q.title}</span>
                <span className="text-xs text-[var(--color-muted)]">{q.sub}</span>
                <span className="ml-auto text-xs text-[var(--color-muted)]">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((c) => (
                  <MatrixCard key={c.id} card={c} onOpen={() => onOpen(c)} onDragStart={() => setDragId(c.id)} onDragEnd={() => setDragId(null)} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {unclassified.length > 0 && (
        <div className="rounded-[var(--radius)] border border-dashed p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Da classificare — trascina in un quadrante
          </p>
          <div className="flex flex-wrap gap-2">
            {unclassified.map((c) => (
              <MatrixCard key={c.id} card={c} onOpen={() => onOpen(c)} onDragStart={() => setDragId(c.id)} onDragEnd={() => setDragId(null)} inline />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MatrixCard({
  card,
  onOpen,
  onDragStart,
  onDragEnd,
  inline,
}: {
  card: KanbanCard
  onOpen: () => void
  onDragStart: () => void
  onDragEnd: () => void
  inline?: boolean
}) {
  const pr = PRIORITY_META[card.priority]
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      style={{ borderLeft: `3px solid ${pr.stripe}` }}
      className={cn(
        'cursor-pointer rounded-[calc(var(--radius)-0.2rem)] border bg-[var(--color-surface)] p-2 text-sm shadow-sm transition-shadow hover:shadow-md',
        inline ? 'max-w-[220px]' : '',
      )}
    >
      <p className="font-medium leading-snug">{card.title}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <Badge color={pr.color}>{pr.label}</Badge>
        {card.tag && <Badge color="primary">{card.tag}</Badge>}
      </div>
    </div>
  )
}

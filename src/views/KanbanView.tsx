import { useState } from 'react'
import { useStore } from '../store'
import {
  KANBAN_COLUMNS,
  type KanbanCard,
  type KanbanColumn,
  type Priority,
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
import { IconPlus, IconTrash } from '../components/icons'
import { uid, nowISO, ageInDays, cn } from '../lib/utils'
import { GuideButton } from '../components/Guide'

const PRIORITY_META: Record<Priority, { label: string; color: any }> = {
  high: { label: 'Alta', color: 'danger' },
  med: { label: 'Media', color: 'warning' },
  low: { label: 'Bassa', color: 'neutral' },
}

const emptyDraft = (): Partial<KanbanCard> => ({
  title: '',
  notes: '',
  column: 'todo',
  priority: 'med',
  tag: '',
})

export default function KanbanView() {
  const { data, update } = useStore()
  const [editing, setEditing] = useState<KanbanCard | null>(null)
  const [draft, setDraft] = useState<Partial<KanbanCard> | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<KanbanColumn | null>(null)

  function openNew(column: KanbanColumn = 'todo') {
    setEditing(null)
    setDraft({ ...emptyDraft(), column })
  }

  function openEdit(card: KanbanCard) {
    setEditing(card)
    setDraft({ ...card })
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
          c.updatedAt = nowISO()
        }
      } else {
        d.kanban.unshift({
          id: uid(),
          title: draft.title!.trim(),
          notes: draft.notes,
          column: draft.column as KanbanColumn,
          priority: (draft.priority as Priority) ?? 'med',
          tag: draft.tag?.trim() || undefined,
          createdAt: nowISO(),
          updatedAt: nowISO(),
        })
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

  function moveTo(id: string, column: KanbanColumn) {
    update((d) => {
      const c = d.kanban.find((x) => x.id === id)
      if (c && c.column !== column) {
        c.column = column
        c.updatedAt = nowISO()
      }
    })
  }

  const wip = data.kanban.filter((c) => c.column === 'doing').length

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {KANBAN_COLUMNS.map((col) => {
          const cards = data.kanban.filter((c) => c.column === col.key)
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault()
                setOverCol(col.key)
              }}
              onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
              onDrop={() => {
                if (dragId) moveTo(dragId, col.key)
                setDragId(null)
                setOverCol(null)
              }}
              className={cn(
                'flex flex-col rounded-[var(--radius)] border bg-[var(--color-surface-2)]/40 p-2 transition-colors',
                overCol === col.key &&
                  'border-[var(--color-primary)] bg-[color-mix(in_oklch,var(--color-primary)_8%,transparent)]',
              )}
            >
              <div className="flex items-center justify-between px-1.5 py-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  {col.label}
                </span>
                <span className="text-xs text-[var(--color-muted)]">
                  {cards.length}
                </span>
              </div>

              <div className="flex min-h-[60px] flex-1 flex-col gap-2">
                {cards.map((card) => (
                  <KanbanCardItem
                    key={card.id}
                    card={card}
                    onClick={() => openEdit(card)}
                    onDragStart={() => setDragId(card.id)}
                    onDragEnd={() => setDragId(null)}
                  />
                ))}
              </div>

              <button
                onClick={() => openNew(col.key)}
                className="mt-2 flex items-center justify-center gap-1 rounded-[calc(var(--radius)-0.25rem)] border border-dashed py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-2)]"
              >
                <IconPlus width={14} height={14} /> Aggiungi
              </button>
            </div>
          )
        })}
      </div>

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={editing ? 'Modifica card' : 'Nuova card'}
        footer={
          <>
            {editing && (
              <Button
                variant="danger"
                onClick={() => remove(editing.id)}
                className="mr-auto"
              >
                <IconTrash width={15} height={15} /> Elimina
              </Button>
            )}
            <Button onClick={() => setDraft(null)}>Annulla</Button>
            <Button variant="primary" onClick={save}>
              Salva
            </Button>
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
                onKeyDown={(e) => e.key === 'Enter' && save()}
                placeholder="Es. Valutare vendor monitoring"
              />
            </Field>
            <Field label="Note">
              <Textarea
                rows={3}
                value={draft.notes ?? ''}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Contesto, prossimi passi…"
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Colonna">
                <Select
                  value={draft.column}
                  onChange={(e) =>
                    setDraft({ ...draft, column: e.target.value as KanbanColumn })
                  }
                  className="w-full"
                >
                  {KANBAN_COLUMNS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Priorità">
                <Select
                  value={draft.priority}
                  onChange={(e) =>
                    setDraft({ ...draft, priority: e.target.value as Priority })
                  }
                  className="w-full"
                >
                  <option value="high">Alta</option>
                  <option value="med">Media</option>
                  <option value="low">Bassa</option>
                </Select>
              </Field>
              <Field label="Tag">
                <Input
                  value={draft.tag ?? ''}
                  onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
                  placeholder="hiring…"
                />
              </Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function KanbanCardItem({
  card,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  card: KanbanCard
  onClick: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const age = ageInDays(card.updatedAt)
  const stale = card.column !== 'done' && age >= 7
  const pr = PRIORITY_META[card.priority]
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="group cursor-pointer rounded-[calc(var(--radius)-0.2rem)] border bg-[var(--color-surface)] p-2.5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{card.title}</p>
      </div>
      {card.notes && (
        <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">
          {card.notes}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge color={pr.color}>{pr.label}</Badge>
        {card.tag && <Badge color="primary">{card.tag}</Badge>}
        {stale && <Badge color="danger">fermo da {age}g</Badge>}
      </div>
    </div>
  )
}

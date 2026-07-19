import { useState } from 'react'
import { useStore } from '../store'
import {
  type RoadmapItem,
  type RoadmapHorizon,
  type RoadmapStatus,
  ROADMAP_HORIZONS,
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
import { IconPlus, IconTrash, IconMap, IconBoard } from '../components/icons'
import { uid, nowISO, cn } from '../lib/utils'
import { GuideButton } from '../components/Guide'

const STATUS_META: Record<RoadmapStatus, { label: string; color: any }> = {
  planned: { label: 'Pianificata', color: 'neutral' },
  active: { label: 'In corso', color: 'success' },
  done: { label: 'Fatta', color: 'primary' },
}

const emptyDraft = (horizon: RoadmapHorizon = 'now'): Partial<RoadmapItem> => ({
  title: '',
  description: '',
  area: '',
  horizon,
  status: 'planned',
  target: '',
})

export default function RoadmapView() {
  const { data, update } = useStore()
  const [draft, setDraft] = useState<Partial<RoadmapItem> | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<RoadmapHorizon | null>(null)
  const [addText, setAddText] = useState<Record<string, string>>({})

  function save() {
    if (!draft?.title?.trim()) return
    update((d) => {
      if (editId) {
        const it = d.roadmap.find((x) => x.id === editId)
        if (it) {
          Object.assign(it, draft, {
            title: draft.title!.trim(),
            area: draft.area?.trim() || undefined,
            target: draft.target?.trim() || undefined,
            description: draft.description?.trim() || undefined,
            updatedAt: nowISO(),
          })
        }
      } else {
        d.roadmap.push({
          id: uid(),
          title: draft.title!.trim(),
          description: draft.description?.trim() || undefined,
          area: draft.area?.trim() || undefined,
          horizon: (draft.horizon as RoadmapHorizon) ?? 'now',
          status: (draft.status as RoadmapStatus) ?? 'planned',
          target: draft.target?.trim() || undefined,
          createdAt: nowISO(),
          updatedAt: nowISO(),
        })
      }
    })
    setDraft(null)
    setEditId(null)
  }

  function remove(id: string) {
    update((d) => {
      d.roadmap = d.roadmap.filter((x) => x.id !== id)
    })
    setDraft(null)
    setEditId(null)
  }

  function moveTo(id: string, horizon: RoadmapHorizon) {
    update((d) => {
      const it = d.roadmap.find((x) => x.id === id)
      if (it && it.horizon !== horizon) {
        it.horizon = horizon
        it.updatedAt = nowISO()
      }
    })
  }

  function addInline(h: RoadmapHorizon) {
    const t = (addText[h] ?? '').trim()
    if (!t) return
    update((d) => {
      d.roadmap.push({
        id: uid(),
        title: t,
        horizon: h,
        status: 'planned',
        createdAt: nowISO(),
        updatedAt: nowISO(),
      })
    })
    setAddText((s) => ({ ...s, [h]: '' }))
  }

  function toKanban(item: RoadmapItem) {
    update((d) => {
      d.kanban.unshift({
        id: uid(),
        title: item.title,
        notes: item.description,
        column: 'todo',
        priority: 'med',
        tag: item.area ?? 'roadmap',
        createdAt: nowISO(),
        updatedAt: nowISO(),
      })
      const it = d.roadmap.find((x) => x.id === item.id)
      if (it && it.status === 'planned') {
        it.status = 'active'
        it.updatedAt = nowISO()
      }
    })
  }

  const nowActive = data.roadmap.filter(
    (r) => r.horizon === 'now' && r.status !== 'done',
  ).length

  const orderOf = (s: RoadmapStatus) => (s === 'active' ? 0 : s === 'planned' ? 1 : 2)

  return (
    <div>
      <PageHeader
        title="Roadmap DevOps"
        subtitle="La tua direzione tecnica: iniziative su tre orizzonti, senza date finte."
        actions={
          <>
            <GuideButton section="roadmap" />
            <Badge color={nowActive > 4 ? 'danger' : 'neutral'}>
              «Adesso»: {nowActive}
            </Badge>
            <Button
              variant="primary"
              onClick={() => {
                setEditId(null)
                setDraft(emptyDraft())
              }}
            >
              <IconPlus /> Nuova iniziativa
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {ROADMAP_HORIZONS.map((col) => {
          const items = data.roadmap
            .filter((r) => r.horizon === col.key)
            .sort((a, b) => orderOf(a.status) - orderOf(b.status))
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
                'flex flex-col rounded-[var(--radius)] border bg-[var(--color-surface-2)]/40 p-2.5 transition-colors',
                overCol === col.key &&
                  'border-[var(--color-primary)] bg-[color-mix(in_oklch,var(--color-primary)_8%,transparent)]',
              )}
            >
              <div className="flex items-baseline justify-between px-1 py-1.5">
                <div>
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="ml-2 text-[11px] text-[var(--color-muted)]">
                    {col.hint}
                  </span>
                </div>
                <span className="text-xs text-[var(--color-muted)]">
                  {items.length}
                </span>
              </div>

              <div className="flex min-h-[60px] flex-1 flex-col gap-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDragId(item.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => {
                      setEditId(item.id)
                      setDraft({ ...item })
                    }}
                    className={cn(
                      'group cursor-pointer rounded-[calc(var(--radius)-0.2rem)] border bg-[var(--color-surface)] p-2.5 shadow-sm transition-shadow hover:shadow-md',
                      item.status === 'done' && 'opacity-50',
                    )}
                  >
                    <p
                      className={cn(
                        'text-sm font-medium leading-snug',
                        item.status === 'done' && 'line-through',
                      )}
                    >
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">
                        {item.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge color={STATUS_META[item.status].color}>
                        {STATUS_META[item.status].label}
                      </Badge>
                      {item.area && <Badge color="primary">{item.area}</Badge>}
                      {item.target && <Badge color="neutral">{item.target}</Badge>}
                      {item.status !== 'done' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toKanban(item)
                          }}
                          title="Crea una card nel Kanban (l'iniziativa passa In corso)"
                          className="ml-auto inline-flex items-center gap-1 text-[11px] text-[var(--color-muted)] opacity-0 transition-opacity hover:text-[var(--color-primary)] group-hover:opacity-100"
                        >
                          <IconBoard width={12} height={12} /> Kanban
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="grid flex-1 place-items-center py-4 text-center text-xs text-[var(--color-muted)]">
                    <span>
                      <IconMap width={20} height={20} className="mx-auto mb-1 opacity-50" />
                      Nessuna iniziativa
                    </span>
                  </div>
                )}
              </div>

              <input
                value={addText[col.key] ?? ''}
                onChange={(e) =>
                  setAddText((s) => ({ ...s, [col.key]: e.target.value }))
                }
                onKeyDown={(e) => e.key === 'Enter' && addInline(col.key)}
                placeholder="+ aggiungi e Invio"
                className="mt-2 h-8 rounded-[calc(var(--radius)-0.25rem)] border border-dashed bg-transparent px-2.5 text-xs outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:bg-[var(--color-bg)]"
              />
            </div>
          )
        })}
      </div>

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={editId ? 'Iniziativa' : 'Nuova iniziativa'}
        wide
        footer={
          <>
            {editId && (
              <Button variant="danger" onClick={() => remove(editId)} className="mr-auto">
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
                placeholder="Es. Observability baseline con OpenTelemetry"
              />
            </Field>
            <Field label="Descrizione / valore atteso">
              <Textarea
                rows={3}
                value={draft.description ?? ''}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Perché la facciamo, cosa cambia quando è fatta…"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Area">
                <Input
                  value={draft.area ?? ''}
                  onChange={(e) => setDraft({ ...draft, area: e.target.value })}
                  placeholder="CI/CD, Observability, Security, FinOps…"
                />
              </Field>
              <Field label="Target (indicativo)">
                <Input
                  value={draft.target ?? ''}
                  onChange={(e) => setDraft({ ...draft, target: e.target.value })}
                  placeholder="Q4 2026, PI 2026.4…"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Orizzonte">
                <Select
                  value={draft.horizon}
                  onChange={(e) =>
                    setDraft({ ...draft, horizon: e.target.value as RoadmapHorizon })
                  }
                  className="w-full"
                >
                  {ROADMAP_HORIZONS.map((h) => (
                    <option key={h.key} value={h.key}>
                      {h.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Stato">
                <Select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value as RoadmapStatus })
                  }
                  className="w-full"
                >
                  <option value="planned">Pianificata</option>
                  <option value="active">In corso</option>
                  <option value="done">Fatta</option>
                </Select>
              </Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

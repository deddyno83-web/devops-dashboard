import { useState } from 'react'
import { useStore } from '../store'
import type {
  Decision,
  DecisionStatus,
  ActionItem,
  ActionStatus,
} from '../types'
import {
  Button,
  Card,
  Badge,
  Modal,
  Field,
  Input,
  Textarea,
  Select,
  EmptyState,
  PageHeader,
} from '../components/ui'
import { IconPlus, IconTrash, IconFile, IconCheck } from '../components/icons'
import { uid, nowISO, todayISO, fmtDate, relativeDays, daysFromToday } from '../lib/utils'
import { GuideButton } from '../components/Guide'

const DEC_STATUS: Record<DecisionStatus, { label: string; color: any }> = {
  open: { label: 'Aperta', color: 'warning' },
  decided: { label: 'Decisa', color: 'success' },
  revisit: { label: 'Da rivedere', color: 'primary' },
}

export default function DecisionsView() {
  const { data, update } = useStore()
  const [tab, setTab] = useState<'decisions' | 'actions'>('decisions')

  return (
    <div>
      <PageHeader
        title="Decisioni & Azioni"
        subtitle="Registra il «perché» delle decisioni e traccia gli action item con owner e scadenza."
        actions={<GuideButton section="decisions" />}
      />

      <div className="mb-4 inline-flex rounded-[calc(var(--radius)-0.2rem)] border bg-[var(--color-surface-2)]/50 p-1 text-sm">
        <TabButton active={tab === 'decisions'} onClick={() => setTab('decisions')}>
          Decision log ({data.decisions.length})
        </TabButton>
        <TabButton active={tab === 'actions'} onClick={() => setTab('actions')}>
          Action items ({data.actions.filter((a) => a.status !== 'done').length})
        </TabButton>
      </div>

      {tab === 'decisions' ? <DecisionLog /> : <ActionItems />}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={
        'rounded-[calc(var(--radius)-0.35rem)] px-3 py-1.5 font-medium transition-colors ' +
        (active
          ? 'bg-[var(--color-surface)] shadow-sm'
          : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]')
      }
    >
      {children}
    </button>
  )
}

/* -------------------------------- Decisions -------------------------------- */
const emptyDecision = (): Partial<Decision> => ({
  title: '',
  date: todayISO(),
  context: '',
  options: '',
  choice: '',
  rationale: '',
  status: 'decided',
})

function DecisionLog() {
  const { data, update } = useStore()
  const [draft, setDraft] = useState<Partial<Decision> | null>(null)
  const [editId, setEditId] = useState<string | null>(null)

  function save() {
    if (!draft?.title?.trim()) return
    update((d) => {
      if (editId) {
        const dec = d.decisions.find((x) => x.id === editId)
        if (dec) Object.assign(dec, draft, { title: draft.title!.trim() })
      } else {
        d.decisions.unshift({
          id: uid(),
          title: draft.title!.trim(),
          date: draft.date || todayISO(),
          context: draft.context ?? '',
          options: draft.options ?? '',
          choice: draft.choice ?? '',
          rationale: draft.rationale ?? '',
          status: (draft.status as DecisionStatus) ?? 'decided',
        })
      }
    })
    setDraft(null)
    setEditId(null)
  }

  function remove(id: string) {
    update((d) => {
      d.decisions = d.decisions.filter((x) => x.id !== id)
    })
    setDraft(null)
    setEditId(null)
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button
          variant="primary"
          onClick={() => {
            setEditId(null)
            setDraft(emptyDecision())
          }}
        >
          <IconPlus /> Nuova decisione
        </Button>
      </div>

      {data.decisions.length === 0 ? (
        <EmptyState
          icon={<IconFile width={28} height={28} />}
          title="Nessuna decisione registrata"
          hint="Annota le decisioni importanti con contesto, alternative e il motivo della scelta. Tra 3 mesi ti ringrazierai."
        />
      ) : (
        <div className="space-y-3">
          {data.decisions.map((dec) => {
            const meta = DEC_STATUS[dec.status]
            return (
              <Card key={dec.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{dec.title}</h3>
                      <Badge color={meta.color}>{meta.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                      {fmtDate(dec.date)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditId(dec.id)
                      setDraft({ ...dec })
                    }}
                  >
                    Apri
                  </Button>
                </div>
                {dec.choice && (
                  <p className="mt-2 text-sm">
                    <span className="text-[var(--color-muted)]">Scelta: </span>
                    {dec.choice}
                  </p>
                )}
                {dec.rationale && (
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--color-muted)]">
                    {dec.rationale}
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={editId ? 'Decisione' : 'Nuova decisione'}
        wide
        footer={
          <>
            {editId && (
              <Button
                variant="danger"
                onClick={() => remove(editId)}
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
            <div className="grid grid-cols-[1fr_auto_auto] gap-3">
              <Field label="Titolo">
                <Input
                  autoFocus
                  value={draft.title ?? ''}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Es. Adozione IaC con Bicep"
                />
              </Field>
              <Field label="Data">
                <Input
                  type="date"
                  value={draft.date ?? ''}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
              </Field>
              <Field label="Stato">
                <Select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value as DecisionStatus })
                  }
                >
                  <option value="open">Aperta</option>
                  <option value="decided">Decisa</option>
                  <option value="revisit">Da rivedere</option>
                </Select>
              </Field>
            </div>
            <Field label="Contesto / problema">
              <Textarea
                rows={2}
                value={draft.context ?? ''}
                onChange={(e) => setDraft({ ...draft, context: e.target.value })}
                placeholder="Qual era la situazione?"
              />
            </Field>
            <Field label="Alternative valutate">
              <Textarea
                rows={2}
                value={draft.options ?? ''}
                onChange={(e) => setDraft({ ...draft, options: e.target.value })}
                placeholder="Opzione A, B, C…"
              />
            </Field>
            <Field label="Scelta">
              <Input
                value={draft.choice ?? ''}
                onChange={(e) => setDraft({ ...draft, choice: e.target.value })}
                placeholder="Cosa abbiamo deciso"
              />
            </Field>
            <Field label="Perché (razionale)">
              <Textarea
                rows={3}
                value={draft.rationale ?? ''}
                onChange={(e) => setDraft({ ...draft, rationale: e.target.value })}
                placeholder="Il motivo della scelta, i trade-off accettati…"
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ------------------------------- Action items ------------------------------ */
function ActionItems() {
  const { data, update } = useStore()
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState('')
  const [due, setDue] = useState('')

  function add() {
    if (!title.trim()) return
    update((d) =>
      d.actions.unshift({
        id: uid(),
        title: title.trim(),
        owner: owner.trim() || undefined,
        due: due || undefined,
        status: 'todo',
        createdAt: nowISO(),
      }),
    )
    setTitle('')
    setOwner('')
    setDue('')
  }

  function cycle(id: string) {
    const order: ActionStatus[] = ['todo', 'doing', 'done']
    update((d) => {
      const a = d.actions.find((x) => x.id === id)
      if (a) a.status = order[(order.indexOf(a.status) + 1) % order.length]
    })
  }

  function remove(id: string) {
    update((d) => {
      d.actions = d.actions.filter((x) => x.id !== id)
    })
  }

  const owners = Array.from(
    new Set(data.people.map((p) => p.name).filter(Boolean)),
  )
  const sorted = [...data.actions].sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1
    if (b.status === 'done' && a.status !== 'done') return -1
    const da = daysFromToday(a.due) ?? 99999
    const db = daysFromToday(b.due) ?? 99999
    return da - db
  })

  return (
    <div>
      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Nuovo action item…"
            />
          </div>
          <input
            list="owners"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Owner"
            className="h-9 w-32 rounded-[calc(var(--radius)-0.25rem)] border bg-[var(--color-bg)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
          />
          <datalist id="owners">
            {owners.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="h-9 rounded-[calc(var(--radius)-0.25rem)] border bg-[var(--color-bg)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
          />
          <Button variant="primary" onClick={add}>
            <IconPlus /> Aggiungi
          </Button>
        </div>
      </Card>

      {data.actions.length === 0 ? (
        <EmptyState
          title="Nessun action item"
          hint="Aggiungi le cose da seguire dopo i meeting, con responsabile e scadenza."
        />
      ) : (
        <div className="space-y-1.5">
          {sorted.map((a) => {
            const overdue =
              a.status !== 'done' &&
              a.due &&
              (daysFromToday(a.due) ?? 0) < 0
            return (
              <div
                key={a.id}
                className="group flex items-center gap-3 rounded-[calc(var(--radius)-0.25rem)] border bg-[var(--color-surface)] px-3 py-2"
              >
                <button
                  onClick={() => cycle(a.id)}
                  title="Cambia stato"
                  className={
                    'grid h-5 w-5 shrink-0 place-items-center rounded-md border text-white transition-colors ' +
                    (a.status === 'done'
                      ? 'border-[var(--color-success)] bg-[var(--color-success)]'
                      : a.status === 'doing'
                        ? 'border-[var(--color-warning)] bg-[var(--color-warning)]'
                        : 'bg-transparent text-transparent')
                  }
                >
                  <IconCheck width={13} height={13} />
                </button>
                <span
                  className={
                    'flex-1 text-sm ' +
                    (a.status === 'done'
                      ? 'text-[var(--color-muted)] line-through'
                      : '')
                  }
                >
                  {a.title}
                </span>
                {a.owner && <Badge color="primary">{a.owner}</Badge>}
                {a.due && (
                  <Badge color={overdue ? 'danger' : 'neutral'}>
                    {relativeDays(a.due)}
                  </Badge>
                )}
                <button
                  onClick={() => remove(a.id)}
                  className="text-[var(--color-muted)] opacity-0 transition-opacity hover:text-[var(--color-danger)] group-hover:opacity-100"
                >
                  <IconTrash width={15} height={15} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

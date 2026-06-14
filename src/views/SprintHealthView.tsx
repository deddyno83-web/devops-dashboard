import { useState } from 'react'
import { useStore } from '../store'
import {
  type Sprint,
  type SprintKind,
  type SprintStatus,
  type Risk,
  type RiskSeverity,
  type RiskStatus,
  type DoraEntry,
  DORA_METRICS,
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
import { IconPlus, IconTrash, IconLayers, IconActivity } from '../components/icons'
import { uid, nowISO, todayISO, fmtDate, mondayOf, weekLabel } from '../lib/utils'
import { GuideButton } from '../components/Guide'

export default function SprintHealthView() {
  const [tab, setTab] = useState<'sprint' | 'dora'>('sprint')
  const { data } = useStore()

  return (
    <div>
      <PageHeader
        title="Sprint & Salute"
        subtitle="Obiettivi e retro di sprint/train, rischi che ti porti dietro, e salute del team (DORA)."
        actions={<GuideButton section="sprint" />}
      />
      <div className="mb-4 inline-flex rounded-[calc(var(--radius)-0.2rem)] border bg-[var(--color-surface-2)]/50 p-1 text-sm">
        <TabBtn active={tab === 'sprint'} onClick={() => setTab('sprint')}>
          Sprint / Train ({data.sprints.length})
        </TabBtn>
        <TabBtn active={tab === 'dora'} onClick={() => setTab('dora')}>
          Salute DORA
        </TabBtn>
      </div>
      {tab === 'sprint' ? <SprintTab /> : <DoraTab />}
    </div>
  )
}

function TabBtn({
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

/* ------------------------------- Sprint tab -------------------------------- */
const SPRINT_STATUS: Record<SprintStatus, { label: string; color: any }> = {
  planned: { label: 'Pianificato', color: 'neutral' },
  active: { label: 'Attivo', color: 'success' },
  done: { label: 'Chiuso', color: 'primary' },
}

const emptySprint = (kind: SprintKind): Partial<Sprint> => ({
  name: '',
  kind,
  start: todayISO(),
  end: '',
  goals: '',
  retroWell: '',
  retroImprove: '',
  status: 'active',
})

function SprintTab() {
  const { data, update } = useStore()
  const [draft, setDraft] = useState<Partial<Sprint> | null>(null)
  const [editId, setEditId] = useState<string | null>(null)

  function save() {
    if (!draft?.name?.trim()) return
    update((d) => {
      if (editId) {
        const s = d.sprints.find((x) => x.id === editId)
        if (s) Object.assign(s, draft, { name: draft.name!.trim() })
      } else {
        d.sprints.unshift({
          id: uid(),
          name: draft.name!.trim(),
          kind: (draft.kind as SprintKind) ?? 'sprint',
          start: draft.start,
          end: draft.end,
          goals: draft.goals ?? '',
          retroWell: draft.retroWell ?? '',
          retroImprove: draft.retroImprove ?? '',
          status: (draft.status as SprintStatus) ?? 'active',
        })
      }
    })
    setDraft(null)
    setEditId(null)
  }

  function remove(id: string) {
    update((d) => {
      d.sprints = d.sprints.filter((x) => x.id !== id)
    })
    setDraft(null)
    setEditId(null)
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        <div className="flex gap-2">
          <Button
            variant="primary"
            onClick={() => {
              setEditId(null)
              setDraft(emptySprint('sprint'))
            }}
          >
            <IconPlus /> Nuovo sprint
          </Button>
          <Button
            onClick={() => {
              setEditId(null)
              setDraft(emptySprint('train'))
            }}
          >
            <IconLayers width={15} height={15} /> Nuovo train (PI)
          </Button>
        </div>

        {data.sprints.length === 0 ? (
          <EmptyState
            icon={<IconLayers width={28} height={28} />}
            title="Nessuno sprint o train"
            hint="Crea lo sprint corrente con i suoi obiettivi. A fine sprint annota la retro: cosa è andato e cosa migliorare."
          />
        ) : (
          data.sprints.map((s) => {
            const meta = SPRINT_STATUS[s.status]
            return (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{s.name}</h3>
                      <Badge color={s.kind === 'train' ? 'primary' : 'neutral'}>
                        {s.kind === 'train' ? 'Train / PI' : 'Sprint'}
                      </Badge>
                      <Badge color={meta.color}>{meta.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                      {fmtDate(s.start)} → {s.end ? fmtDate(s.end) : '…'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditId(s.id)
                      setDraft({ ...s })
                    }}
                  >
                    Apri
                  </Button>
                </div>
                {s.goals && (
                  <p className="mt-2 whitespace-pre-wrap text-sm">{s.goals}</p>
                )}
                {(s.retroWell || s.retroImprove) && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {s.retroWell && (
                      <div className="rounded-md bg-[color-mix(in_oklch,var(--color-success)_12%,transparent)] p-2 text-xs">
                        <span className="font-semibold text-[var(--color-success)]">
                          ✓ Bene:{' '}
                        </span>
                        {s.retroWell}
                      </div>
                    )}
                    {s.retroImprove && (
                      <div className="rounded-md bg-[color-mix(in_oklch,var(--color-warning)_15%,transparent)] p-2 text-xs">
                        <span className="font-semibold text-[var(--color-warning)]">
                          ▲ Migliorare:{' '}
                        </span>
                        {s.retroImprove}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>

      <RiskPanel />

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={editId ? 'Sprint / Train' : draft?.kind === 'train' ? 'Nuovo train' : 'Nuovo sprint'}
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
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome">
                <Input
                  autoFocus
                  value={draft.name ?? ''}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder={draft.kind === 'train' ? 'Es. PI 2026.3' : 'Es. Sprint 24'}
                />
              </Field>
              <Field label="Stato">
                <Select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value as SprintStatus })
                  }
                >
                  <option value="planned">Pianificato</option>
                  <option value="active">Attivo</option>
                  <option value="done">Chiuso</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Inizio">
                <Input
                  type="date"
                  value={draft.start ?? ''}
                  onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                />
              </Field>
              <Field label="Fine">
                <Input
                  type="date"
                  value={draft.end ?? ''}
                  onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Obiettivi">
              <Textarea
                rows={3}
                value={draft.goals ?? ''}
                onChange={(e) => setDraft({ ...draft, goals: e.target.value })}
                placeholder="Cosa vogliamo portare a casa in questo sprint/PI…"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Retro · cosa è andato bene">
                <Textarea
                  rows={3}
                  value={draft.retroWell ?? ''}
                  onChange={(e) => setDraft({ ...draft, retroWell: e.target.value })}
                />
              </Field>
              <Field label="Retro · cosa migliorare">
                <Textarea
                  rows={3}
                  value={draft.retroImprove ?? ''}
                  onChange={(e) =>
                    setDraft({ ...draft, retroImprove: e.target.value })
                  }
                />
              </Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

/* -------------------------------- Risk panel ------------------------------- */
const RISK_SEV: Record<RiskSeverity, { label: string; color: any }> = {
  low: { label: 'Basso', color: 'neutral' },
  med: { label: 'Medio', color: 'warning' },
  high: { label: 'Alto', color: 'danger' },
}
const RISK_NEXT: Record<RiskStatus, RiskStatus> = {
  open: 'mitigated',
  mitigated: 'closed',
  closed: 'open',
}
const RISK_STATUS_LABEL: Record<RiskStatus, string> = {
  open: 'Aperto',
  mitigated: 'Mitigato',
  closed: 'Chiuso',
}

function RiskPanel() {
  const { data, update } = useStore()
  const [title, setTitle] = useState('')
  const [sev, setSev] = useState<RiskSeverity>('med')

  function add() {
    if (!title.trim()) return
    update((d) =>
      d.risks.unshift({
        id: uid(),
        title: title.trim(),
        severity: sev,
        status: 'open',
        createdAt: nowISO(),
      }),
    )
    setTitle('')
    setSev('med')
  }

  const sorted = [...data.risks].sort((a, b) => {
    if (a.status === 'closed' && b.status !== 'closed') return 1
    if (b.status === 'closed' && a.status !== 'closed') return -1
    const order = { high: 0, med: 1, low: 2 }
    return order[a.severity] - order[b.severity]
  })

  return (
    <Card className="h-fit p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold">Rischi & impedimenti</h3>
        <Badge color="neutral">
          {data.risks.filter((r) => r.status !== 'closed').length} aperti
        </Badge>
      </div>

      <div className="mb-3 space-y-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Nuovo rischio / impedimento…"
        />
        <div className="flex gap-2">
          <Select
            value={sev}
            onChange={(e) => setSev(e.target.value as RiskSeverity)}
            className="flex-1"
          >
            <option value="low">Basso</option>
            <option value="med">Medio</option>
            <option value="high">Alto</option>
          </Select>
          <Button variant="primary" onClick={add}>
            <IconPlus width={15} height={15} /> Aggiungi
          </Button>
        </div>
      </div>

      {data.risks.length === 0 ? (
        <p className="py-2 text-center text-xs text-[var(--color-muted)]">
          Nessun rischio aperto. 👍
        </p>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((r) => (
            <div
              key={r.id}
              className={
                'group flex items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] border p-2 ' +
                (r.status === 'closed' ? 'opacity-50' : '')
              }
            >
              <span className="flex-1 text-sm">{r.title}</span>
              <Badge color={RISK_SEV[r.severity].color}>
                {RISK_SEV[r.severity].label}
              </Badge>
              <button
                onClick={() =>
                  update((d) => {
                    const x = d.risks.find((y) => y.id === r.id)
                    if (x) x.status = RISK_NEXT[x.status]
                  })
                }
                className="rounded-md border px-1.5 py-0.5 text-[11px] text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
                title="Cambia stato"
              >
                {RISK_STATUS_LABEL[r.status]}
              </button>
              <button
                onClick={() =>
                  update((d) => {
                    d.risks = d.risks.filter((y) => y.id !== r.id)
                  })
                }
                className="text-[var(--color-muted)] opacity-0 transition-opacity hover:text-[var(--color-danger)] group-hover:opacity-100"
              >
                <IconTrash width={14} height={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/* --------------------------------- DORA tab -------------------------------- */
const SCORE_COLORS = [
  'var(--color-danger)',
  'var(--color-danger)',
  'var(--color-warning)',
  'var(--color-success)',
  'var(--color-success)',
]

function DoraTab() {
  const { data, update } = useStore()
  const week = mondayOf()
  const current = data.dora.find((e) => e.weekOf === week)

  function setMetric(key: keyof DoraEntry, value: number) {
    update((d) => {
      let e = d.dora.find((x) => x.weekOf === week)
      if (!e) {
        e = {
          id: uid(),
          weekOf: week,
          leadTime: 0,
          deployFreq: 0,
          mttr: 0,
          changeFail: 0,
        }
        d.dora.push(e)
      }
      ;(e as any)[key] = value
    })
  }

  function setNote(note: string) {
    update((d) => {
      const e = d.dora.find((x) => x.weekOf === week)
      if (e) e.note = note
    })
  }

  const history = [...data.dora]
    .filter((e) => e.leadTime || e.deployFreq || e.mttr || e.changeFail)
    .sort((a, b) => a.weekOf.localeCompare(b.weekOf))
    .slice(-12)

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="text-sm font-semibold">
          Valutazione settimana del {weekLabel(week)}
        </h3>
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          Voto soggettivo 1 (male) – 5 (ottimo). Niente dati aziendali, solo la
          tua sensazione di manager.
        </p>
        <div className="space-y-4">
          {DORA_METRICS.map((m) => {
            const val = (current?.[m.key] as number) ?? 0
            return (
              <div key={m.key as string}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-sm font-medium">{m.label}</span>
                  <span className="text-xs text-[var(--color-muted)]">{m.hint}</span>
                </div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setMetric(m.key, n)}
                      className="h-9 flex-1 rounded-md text-sm font-semibold transition-transform hover:scale-105"
                      style={{
                        background:
                          val >= n
                            ? SCORE_COLORS[val - 1]
                            : 'var(--color-surface-2)',
                        color: val >= n ? 'white' : 'var(--color-muted)',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          <Field label="Note della settimana">
            <Textarea
              rows={2}
              value={current?.note ?? ''}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Cosa ha influito su questi numeri…"
            />
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <IconActivity width={16} height={16} />
          <h3 className="text-sm font-semibold">Trend (ultime 12 settimane)</h3>
        </div>
        {history.length < 2 ? (
          <EmptyState
            title="Trend in costruzione"
            hint="Valuta almeno due settimane per vedere l'andamento. Bastano 20 secondi a settimana."
          />
        ) : (
          <TrendChart history={history} />
        )}
      </Card>
    </div>
  )
}

function TrendChart({ history }: { history: DoraEntry[] }) {
  const W = 380
  const H = 160
  const pad = 24
  const avg = (e: DoraEntry) =>
    (e.leadTime + e.deployFreq + e.mttr + e.changeFail) / 4

  const pts = history.map((e, i) => {
    const x = pad + (i * (W - 2 * pad)) / Math.max(1, history.length - 1)
    const y = H - pad - ((avg(e) - 1) / 4) * (H - 2 * pad)
    return { x, y, e }
  })
  const path = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
  const last = avg(history[history.length - 1])

  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold">{last.toFixed(1)}</span>
        <span className="text-xs text-[var(--color-muted)]">media attuale / 5</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[1, 2, 3, 4, 5].map((g) => {
          const y = H - pad - ((g - 1) / 4) * (H - 2 * pad)
          return (
            <g key={g}>
              <line
                x1={pad}
                x2={W - pad}
                y1={y}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth={1}
              />
              <text x={4} y={y + 3} fontSize={9} fill="var(--color-muted)">
                {g}
              </text>
            </g>
          )
        })}
        <path
          d={path}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill="var(--color-primary)" />
            <text
              x={p.x}
              y={H - 6}
              fontSize={8}
              fill="var(--color-muted)"
              textAnchor="middle"
            >
              {weekLabel(p.e.weekOf)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

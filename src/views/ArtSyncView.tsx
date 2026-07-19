import { useState } from 'react'
import { useStore } from '../store'
import {
  type AppData,
  type ArtSync,
  type ArtSyncCategory,
  type ActionItem,
  type RoamRisk,
  type RoamStatus,
  type Priority,
  ART_CATEGORIES,
  ROAM_STATUSES,
} from '../types'
import {
  Button,
  Card,
  Badge,
  Input,
  Select,
  EmptyState,
  PageHeader,
} from '../components/ui'
import {
  IconPlus,
  IconTrash,
  IconCheck,
  IconCopy,
  IconTrain,
  IconBoard,
} from '../components/icons'
import {
  uid,
  nowISO,
  todayISO,
  fmtDate,
  daysFromToday,
  ageInDays,
  cn,
} from '../lib/utils'
import { GuideButton } from '../components/Guide'

const ROAM_COLOR: Record<RoamStatus, any> = {
  resolved: 'success',
  owned: 'primary',
  accepted: 'neutral',
  mitigated: 'warning',
}
const PRIO_META: Record<Priority, { label: string; color: any }> = {
  high: { label: 'Alta', color: 'danger' },
  med: { label: 'Media', color: 'warning' },
  low: { label: 'Bassa', color: 'neutral' },
}

function ensureSync(d: AppData, date: string): ArtSync {
  if (!d.artSyncs[date])
    d.artSyncs[date] = { date, points: [], actions: [], createdAt: nowISO() }
  return d.artSyncs[date]
}

export default function ArtSyncView() {
  const { data, update } = useStore()
  const [date, setDate] = useState(todayISO())
  const [actionText, setActionText] = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const sync = data.artSyncs[date]
  const points = (sync?.points ?? []).filter((p) => p.category !== 'risk')

  // Persistent ROAM register (risks live across syncs until Resolved)
  const openRisks = data.roamRisks.filter((r) => r.roam !== 'resolved')
  const resolvedRisks = data.roamRisks.filter((r) => r.roam === 'resolved')
  const reportedRiskIds = new Set(sync?.reportedRisks ?? [])

  // Unified actions store, filtered on this sync
  const actions = data.actions.filter(
    (a) => a.source === 'art-sync' && a.syncDate === date,
  )

  /* ---------------- points (non-risk categories) ---------------- */
  function addPoint(category: ArtSyncCategory, text: string) {
    const t = text.trim()
    if (!t) return
    update((d) => {
      ensureSync(d, date).points.push({
        id: uid(),
        category,
        text: t,
        reported: false,
      })
    })
  }
  function patchPoint(id: string, patch: Partial<ArtSyncPointPatch>) {
    update((d) => {
      const p = ensureSync(d, date).points.find((x) => x.id === id)
      if (p) Object.assign(p, patch)
    })
  }
  function removePoint(id: string) {
    update((d) => {
      const s = ensureSync(d, date)
      s.points = s.points.filter((x) => x.id !== id)
    })
  }

  /** Pull impediments / at-risk dependencies from the rest of the dashboard. */
  function suggest(category: ArtSyncCategory) {
    const existing = new Set(
      points.filter((p) => p.category === category).map((p) => p.text),
    )
    let candidates: string[] = []
    if (category === 'impediment') {
      candidates = data.kanban
        .filter((c) => c.column === 'blocked')
        .map((c) => c.title)
    } else if (category === 'dependency') {
      candidates = data.dependencies
        .filter(
          (x) =>
            x.status !== 'closed' &&
            (x.criticality === 'high' || (daysFromToday(x.neededBy) ?? 9999) < 0),
        )
        .map((x) => (x.party ? `${x.title} · ${x.party}` : x.title))
    }
    const toAdd = candidates.filter((t) => t && !existing.has(t))
    if (toAdd.length === 0) return
    update((d) => {
      const s = ensureSync(d, date)
      toAdd.forEach((t) =>
        s.points.push({ id: uid(), category, text: t, reported: false }),
      )
    })
  }

  /* ---------------- ROAM risk register ---------------- */
  function addRisk(text: string) {
    const t = text.trim()
    if (!t) return
    update((d) => {
      d.roamRisks.push({ id: uid(), title: t, createdAt: nowISO(), updatedAt: nowISO() })
    })
  }
  function patchRisk(id: string, patch: Partial<RoamRisk>) {
    update((d) => {
      const r = d.roamRisks.find((x) => x.id === id)
      if (r) {
        Object.assign(r, patch)
        r.updatedAt = nowISO()
      }
    })
  }
  function removeRisk(id: string) {
    update((d) => {
      d.roamRisks = d.roamRisks.filter((x) => x.id !== id)
    })
  }
  function toggleRiskReported(id: string) {
    update((d) => {
      const s = ensureSync(d, date)
      const set = new Set(s.reportedRisks ?? [])
      if (set.has(id)) set.delete(id)
      else set.add(id)
      s.reportedRisks = [...set]
    })
  }

  /* ---------------- actions (unified store) ---------------- */
  function addAction() {
    const t = actionText.trim()
    if (!t) return
    update((d) => {
      ensureSync(d, date) // so the date shows up among recent syncs
      d.actions.unshift({
        id: uid(),
        title: t,
        status: 'todo',
        priority: 'med',
        source: 'art-sync',
        syncDate: date,
        createdAt: nowISO(),
      })
    })
    setActionText('')
  }
  function patchAction(id: string, patch: Partial<ActionItem>) {
    update((d) => {
      const a = d.actions.find((x) => x.id === id)
      if (a) Object.assign(a, patch)
    })
  }
  function removeAction(id: string) {
    update((d) => {
      d.actions = d.actions.filter((x) => x.id !== id)
    })
  }
  function toDiario(a: ActionItem) {
    const today = todayISO()
    update((d) => {
      const arr = [...(d.dailyActivities[today] ?? [])]
      arr.push({
        id: uid(),
        text: a.title,
        status: 'todo',
        note: 'da ART Sync',
        actionId: a.id,
        createdAt: nowISO(),
      })
      d.dailyActivities[today] = arr
    })
  }
  function toKanban(a: ActionItem) {
    update((d) => {
      d.kanban.unshift({
        id: uid(),
        title: a.title,
        column: 'todo',
        priority: a.priority ?? 'med',
        tag: 'art-sync',
        due: a.due,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      })
    })
  }

  const syncDates = Object.keys(data.artSyncs).sort().reverse()
  const reportable = points.length + openRisks.length
  const reported =
    points.filter((p) => p.reported).length +
    openRisks.filter((r) => reportedRiskIds.has(r.id)).length
  const hasContent = !!sync || actions.length > 0

  return (
    <div>
      <PageHeader
        title="ART Sync"
        subtitle="Coach Sync + PO Sync: progresso verso gli obiettivi di PI, impedimenti, dipendenze cross-team, rischi (ROAM) e scope."
        actions={
          <>
            <GuideButton section="artsync" />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-40"
            />
            <CopyButton
              text={buildSyncText(sync, date, openRisks, actions)}
              disabled={!hasContent && openRisks.length === 0}
            />
          </>
        }
      />

      {syncDates.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[var(--color-muted)]">Sync recenti:</span>
          {syncDates.slice(0, 6).map((d) => (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={cn(
                'rounded-full border px-2 py-0.5',
                d === date
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]',
              )}
            >
              {fmtDate(d)}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Prepara */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <IconTrain width={16} height={16} />
            <h3 className="text-sm font-semibold">Da riportare · {fmtDate(date)}</h3>
            <Badge
              color={reported === reportable && reportable > 0 ? 'success' : 'neutral'}
            >
              {reported}/{reportable} riportati
            </Badge>
          </div>

          <div className="space-y-5">
            {ART_CATEGORIES.map((cat) => {
              if (cat.key === 'risk') {
                return (
                  <div key={cat.key}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                        {cat.label}
                      </span>
                      <span className="text-[11px] text-[var(--color-muted)]">
                        registro persistente — resta finché non è Resolved
                      </span>
                      {resolvedRisks.length > 0 && (
                        <button
                          onClick={() => setShowResolved((v) => !v)}
                          className="ml-auto text-[11px] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                        >
                          {showResolved ? 'nascondi' : 'mostra'} {resolvedRisks.length} risolti
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {openRisks.map((r) => (
                        <RiskRow
                          key={r.id}
                          risk={r}
                          reported={reportedRiskIds.has(r.id)}
                          onToggleReported={() => toggleRiskReported(r.id)}
                          onPatch={(p) => patchRisk(r.id, p)}
                          onRemove={() => removeRisk(r.id)}
                        />
                      ))}
                      {showResolved &&
                        resolvedRisks.map((r) => (
                          <RiskRow
                            key={r.id}
                            risk={r}
                            resolved
                            reported={reportedRiskIds.has(r.id)}
                            onToggleReported={() => toggleRiskReported(r.id)}
                            onPatch={(p) => patchRisk(r.id, p)}
                            onRemove={() => removeRisk(r.id)}
                          />
                        ))}
                      <AddLine onAdd={addRisk} />
                    </div>
                  </div>
                )
              }
              const pts = points.filter((p) => p.category === cat.key)
              return (
                <div key={cat.key}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                      {cat.label}
                    </span>
                    <span className="text-[11px] text-[var(--color-muted)]">{cat.hint}</span>
                    {cat.suggestable && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto"
                        onClick={() => suggest(cat.key)}
                        title="Prendi dai tuoi dati (Kanban bloccati / Dipendenze critiche)"
                      >
                        ↻ suggerisci
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {pts.map((p) => (
                      <div
                        key={p.id}
                        className="group rounded-[calc(var(--radius)-0.25rem)] border px-2.5 py-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => patchPoint(p.id, { reported: !p.reported })}
                            title="Segna come riportato"
                            className={cn(
                              'grid h-5 w-5 shrink-0 place-items-center rounded-md border',
                              p.reported
                                ? 'border-[var(--color-success)] bg-[var(--color-success)] text-white'
                                : 'text-transparent',
                            )}
                          >
                            <IconCheck width={13} height={13} />
                          </button>
                          <input
                            value={p.text}
                            onChange={(e) => patchPoint(p.id, { text: e.target.value })}
                            className={cn(
                              'flex-1 bg-transparent text-sm outline-none',
                              p.reported && 'text-[var(--color-muted)]',
                            )}
                          />
                          <button
                            onClick={() => removePoint(p.id)}
                            className="text-[var(--color-muted)] opacity-0 transition-opacity hover:text-[var(--color-danger)] group-hover:opacity-100"
                          >
                            <IconTrash width={14} height={14} />
                          </button>
                        </div>
                        <input
                          value={p.note ?? ''}
                          onChange={(e) => patchPoint(p.id, { note: e.target.value })}
                          placeholder="+ nota (cosa è emerso)"
                          className="ml-7 w-[calc(100%-1.75rem)] bg-transparent py-0.5 text-xs text-[var(--color-muted)] outline-none placeholder:text-[var(--color-muted)]/50 focus:text-[var(--color-fg)]"
                        />
                      </div>
                    ))}
                    <AddLine onAdd={(t) => addPoint(cat.key, t)} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Action in uscita — vive nello store unificato (Decisioni & Azioni) */}
        <Card className="h-fit p-5">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold">Action in uscita</h3>
            <Badge color="neutral">
              {actions.filter((a) => a.status !== 'done').length} aperte
            </Badge>
          </div>
          <p className="mb-3 text-[11px] text-[var(--color-muted)]">
            Le action vivono in «Decisioni & Azioni» (tag ART Sync): un solo stato,
            ovunque le guardi.
          </p>
          <div className="flex gap-2">
            <Input
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAction()}
              placeholder="Nuova action dal sync…"
            />
            <Button variant="primary" onClick={addAction}>
              <IconPlus width={15} height={15} />
            </Button>
          </div>

          {actions.length === 0 ? (
            <p className="mt-3 py-2 text-center text-xs text-[var(--color-muted)]">
              Nessuna action. Dall'ART Sync deve uscire almeno un'azione con owner.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {actions.map((a) => {
                const done = a.status === 'done'
                return (
                  <div
                    key={a.id}
                    className="group rounded-[calc(var(--radius)-0.25rem)] border px-2.5 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          patchAction(a.id, { status: done ? 'todo' : 'done' })
                        }
                        className={cn(
                          'grid h-5 w-5 shrink-0 place-items-center rounded-md border',
                          done
                            ? 'border-[var(--color-success)] bg-[var(--color-success)] text-white'
                            : 'text-transparent',
                        )}
                      >
                        <IconCheck width={13} height={13} />
                      </button>
                      <input
                        value={a.title}
                        onChange={(e) => patchAction(a.id, { title: e.target.value })}
                        className={cn(
                          'flex-1 bg-transparent text-sm outline-none',
                          done && 'text-[var(--color-muted)] line-through',
                        )}
                      />
                      <Badge color={PRIO_META[a.priority ?? 'med'].color}>
                        {PRIO_META[a.priority ?? 'med'].label}
                      </Badge>
                      <button
                        onClick={() => removeAction(a.id)}
                        className="text-[var(--color-muted)] opacity-0 transition-opacity hover:text-[var(--color-danger)] group-hover:opacity-100"
                      >
                        <IconTrash width={14} height={14} />
                      </button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-7">
                      <input
                        value={a.owner ?? ''}
                        onChange={(e) => patchAction(a.id, { owner: e.target.value })}
                        placeholder="owner"
                        className="h-7 w-24 rounded border bg-transparent px-2 text-xs outline-none focus:border-[var(--color-primary)]"
                      />
                      <input
                        type="date"
                        value={a.due ?? ''}
                        onChange={(e) => patchAction(a.id, { due: e.target.value })}
                        className="h-7 rounded border bg-transparent px-2 text-xs outline-none focus:border-[var(--color-primary)]"
                      />
                      <Select
                        value={a.priority ?? 'med'}
                        onChange={(e) =>
                          patchAction(a.id, { priority: e.target.value as Priority })
                        }
                        className="h-7 text-xs"
                      >
                        <option value="high">Alta</option>
                        <option value="med">Media</option>
                        <option value="low">Bassa</option>
                      </Select>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toDiario(a)}
                        title="Portala nel Diario di oggi (stato collegato)"
                      >
                        → Diario
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toKanban(a)}
                        title="Crea una card nel Kanban"
                      >
                        <IconBoard width={13} height={13} /> Kanban
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {!hasContent && (
        <div className="mt-5">
          <EmptyState
            icon={<IconTrain width={28} height={28} />}
            title={`Nessuna preparazione per il ${fmtDate(date)}`}
            hint="Aggiungi i punti da riportare (o usa «↻ suggerisci» per pescare impedimenti e dipendenze critiche dai tuoi dati). Timebox del meeting: 30-60 minuti — si identificano i problemi, non si risolvono."
          />
        </div>
      )}
    </div>
  )
}

function RiskRow({
  risk,
  resolved,
  reported,
  onToggleReported,
  onPatch,
  onRemove,
}: {
  risk: RoamRisk
  resolved?: boolean
  reported: boolean
  onToggleReported: () => void
  onPatch: (p: Partial<RoamRisk>) => void
  onRemove: () => void
}) {
  const age = ageInDays(risk.createdAt)
  return (
    <div
      className={cn(
        'group rounded-[calc(var(--radius)-0.25rem)] border px-2.5 py-1.5',
        resolved && 'opacity-50',
      )}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleReported}
          title="Segna come riportato in questo sync"
          className={cn(
            'grid h-5 w-5 shrink-0 place-items-center rounded-md border',
            reported
              ? 'border-[var(--color-success)] bg-[var(--color-success)] text-white'
              : 'text-transparent',
          )}
        >
          <IconCheck width={13} height={13} />
        </button>
        <input
          value={risk.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          className={cn(
            'flex-1 bg-transparent text-sm outline-none',
            resolved && 'line-through',
          )}
        />
        {age >= 1 && !resolved && (
          <span className="shrink-0 text-[10px] text-[var(--color-muted)]">
            aperto da {age}g
          </span>
        )}
        {risk.roam && <Badge color={ROAM_COLOR[risk.roam]}>{risk.roam}</Badge>}
        <Select
          value={risk.roam ?? ''}
          onChange={(e) =>
            onPatch({ roam: (e.target.value || undefined) as RoamStatus | undefined })
          }
          className="h-7 text-xs"
        >
          <option value="">ROAM…</option>
          {ROAM_STATUSES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </Select>
        <button
          onClick={onRemove}
          className="text-[var(--color-muted)] opacity-0 transition-opacity hover:text-[var(--color-danger)] group-hover:opacity-100"
        >
          <IconTrash width={14} height={14} />
        </button>
      </div>
      <div className="ml-7 flex items-center gap-2">
        <input
          value={risk.owner ?? ''}
          onChange={(e) => onPatch({ owner: e.target.value })}
          placeholder="owner"
          className="w-28 bg-transparent py-0.5 text-xs text-[var(--color-muted)] outline-none placeholder:text-[var(--color-muted)]/50 focus:text-[var(--color-fg)]"
        />
        <input
          value={risk.note ?? ''}
          onChange={(e) => onPatch({ note: e.target.value })}
          placeholder="+ nota"
          className="flex-1 bg-transparent py-0.5 text-xs text-[var(--color-muted)] outline-none placeholder:text-[var(--color-muted)]/50 focus:text-[var(--color-fg)]"
        />
      </div>
    </div>
  )
}

type ArtSyncPointPatch = {
  text: string
  note: string
  reported: boolean
}

function AddLine({ onAdd }: { onAdd: (t: string) => void }) {
  const [t, setT] = useState('')
  return (
    <input
      value={t}
      onChange={(e) => setT(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && t.trim()) {
          onAdd(t)
          setT('')
        }
      }}
      placeholder="+ aggiungi e Invio"
      className="h-8 w-full rounded-[calc(var(--radius)-0.25rem)] border border-dashed bg-transparent px-2.5 text-xs outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:bg-[var(--color-bg)]"
    />
  )
}

function buildSyncText(
  sync: ArtSync | undefined,
  date: string,
  openRisks: RoamRisk[],
  actions: ActionItem[],
): string {
  const L: string[] = [`ART Sync — ${fmtDate(date)}`, '']
  ART_CATEGORIES.forEach((cat) => {
    if (cat.key === 'risk') {
      if (openRisks.length === 0) return
      L.push('RISCHI (ROAM):')
      openRisks.forEach((r) => {
        const parts = []
        if (r.roam) parts.push(r.roam)
        if (r.owner) parts.push(r.owner)
        L.push(
          `- ${r.title}${parts.length ? ` [${parts.join(' · ')}]` : ''}${r.note ? ` (${r.note})` : ''}`,
        )
      })
      L.push('')
      return
    }
    const pts = (sync?.points ?? []).filter((p) => p.category === cat.key)
    if (pts.length === 0) return
    L.push(`${cat.label.toUpperCase()}:`)
    pts.forEach((p) => {
      L.push(`- ${p.text}${p.note ? ` (${p.note})` : ''}`)
    })
    L.push('')
  })
  if (actions.length) {
    L.push('ACTION IN USCITA:')
    actions.forEach((a) => {
      const parts = [PRIO_META[a.priority ?? 'med'].label]
      if (a.owner) parts.push(a.owner)
      if (a.due) parts.push(`scad. ${fmtDate(a.due)}`)
      L.push(`- ${a.title} (${parts.join(' · ')})`)
    })
  }
  return L.join('\n')
}

function CopyButton({ text, disabled }: { text: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size="sm"
      variant={copied ? 'primary' : 'outline'}
      disabled={disabled}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        } catch {
          /* clipboard may be blocked */
        }
      }}
    >
      {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
      {copied ? 'Copiato' : 'Copia'}
    </Button>
  )
}

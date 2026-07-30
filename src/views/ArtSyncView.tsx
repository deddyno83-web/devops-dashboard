import { useState } from 'react'
import { useStore } from '../store'
import {
  type AppData,
  type ArtSync,
  type ActionItem,
  type RoamRisk,
  type RoamStatus,
  type Priority,
  type SyncSection,
  type SyncSectionKind,
  ROAM_STATUSES,
} from '../types'
import {
  Button,
  Card,
  Badge,
  Modal,
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
import { RowMenu, AssigneePicker } from '../components/RowMenu'
import { StreamPicker } from '../components/Stream'
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
const KIND_LABEL: Record<SyncSectionKind, string> = {
  stream: 'Stream',
  dependencies: 'Dipendenze esterne',
  meeting: 'Meeting esterni',
  risks: 'Rischi ROAM',
  free: 'Libera',
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
  const [configOpen, setConfigOpen] = useState(false)

  const sync = data.artSyncs[date]
  const agenda = [...data.syncAgenda].sort((a, b) => a.order - b.order)
  const points = sync?.points ?? []

  const openRisks = data.roamRisks.filter((r) => r.roam !== 'resolved')
  const resolvedRisks = data.roamRisks.filter((r) => r.roam === 'resolved')
  const reportedRiskIds = new Set(sync?.reportedRisks ?? [])
  const actions = data.actions.filter(
    (a) => a.source === 'art-sync' && a.syncDate === date,
  )

  const pointsOf = (sec: SyncSection) =>
    points.filter(
      (p) =>
        p.sectionId === sec.id ||
        // legacy points without a section land in the first section
        (!p.sectionId && p.category !== 'risk' && sec.id === agenda[0]?.id),
    )

  /* ------------------------------- points -------------------------------- */
  function addPoint(sec: SyncSection, text: string) {
    const t = text.trim()
    if (!t) return
    update((d) => {
      ensureSync(d, date).points.push({
        id: uid(),
        category: 'progress',
        sectionId: sec.id,
        text: t,
        reported: false,
      })
    })
  }
  function patchPoint(id: string, patch: Record<string, unknown>) {
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

  /** Candidates pulled from the rest of the dashboard for this section. */
  function suggestionsFor(sec: SyncSection): string[] {
    const existing = new Set(pointsOf(sec).map((p) => p.text))
    let out: string[] = []
    if (sec.kind === 'stream' && sec.streamId) {
      const acts = (data.dailyActivities[date] ?? []).filter(
        (a) => a.streamId === sec.streamId,
      )
      out.push(
        ...acts.map(
          (a) =>
            `${a.text}${a.status === 'done' ? ' ✔' : a.status === 'doing' ? ' (in corso)' : ''}`,
        ),
      )
      out.push(
        ...data.actions
          .filter((a) => a.streamId === sec.streamId && a.status !== 'done')
          .map((a) => `${a.title}${a.owner ? ` → ${a.owner}` : ''}`),
      )
      out.push(
        ...data.externalItems
          .filter((x) => x.streamId === sec.streamId && x.status !== 'done' && x.status !== 'dropped')
          .map((x) => `${x.ref ? `[${x.ref}] ` : ''}${x.title}`),
      )
      out.push(
        ...data.dependencies
          .filter(
            (x) =>
              x.streamId === sec.streamId &&
              x.status !== 'closed' &&
              x.status !== 'unblocked',
          )
          .map((x) => `${x.title} (dipendenza)`),
      )
    } else if (sec.kind === 'dependencies') {
      out = data.dependencies
        .filter(
          (x) =>
            x.status !== 'closed' &&
            (x.criticality === 'high' || (daysFromToday(x.neededBy) ?? 9999) < 0),
        )
        .map((x) => (x.party ? `${x.title} · ${x.party}` : x.title))
    } else if (sec.kind === 'meeting') {
      out = data.inbox
        .filter((i) => i.source === 'meeting' && !i.triagedAt)
        .map((i) => i.text)
    }
    return Array.from(new Set(out.filter((t) => t && !existing.has(t))))
  }

  function suggest(sec: SyncSection) {
    const toAdd = suggestionsFor(sec)
    if (toAdd.length === 0) return
    update((d) => {
      const s = ensureSync(d, date)
      toAdd.forEach((t) =>
        s.points.push({
          id: uid(),
          category: 'progress',
          sectionId: sec.id,
          text: t,
          reported: false,
        }),
      )
    })
  }

  /* -------------------------------- risks -------------------------------- */
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
      set.has(id) ? set.delete(id) : set.add(id)
      s.reportedRisks = [...set]
    })
  }

  /* ------------------------------- actions ------------------------------- */
  function addAction() {
    const t = actionText.trim()
    if (!t) return
    update((d) => {
      ensureSync(d, date)
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
  function actionToDiario(a: ActionItem) {
    const today = todayISO()
    update((d) => {
      const arr = [...(d.dailyActivities[today] ?? [])]
      arr.push({
        id: uid(),
        text: a.title,
        status: 'todo',
        note: 'da ART Sync',
        owner: a.owner,
        streamId: a.streamId,
        actionId: a.id,
        createdAt: nowISO(),
      })
      d.dailyActivities[today] = arr
    })
  }
  function actionToKanban(a: ActionItem) {
    update((d) => {
      d.kanban.unshift({
        id: uid(),
        title: a.title,
        column: 'todo',
        priority: a.priority ?? 'med',
        tag: d.streams.find((s) => s.id === a.streamId)?.name ?? 'art-sync',
        due: a.due,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      })
    })
  }

  /* ------------------------------- agenda -------------------------------- */
  function patchSection(id: string, patch: Partial<SyncSection>) {
    update((d) => {
      const s = d.syncAgenda.find((x) => x.id === id)
      if (s) Object.assign(s, patch)
    })
  }
  function addSection() {
    update((d) => {
      d.syncAgenda.push({
        id: uid(),
        label: 'Nuova sezione',
        kind: 'free',
        order: d.syncAgenda.length,
      })
    })
  }
  function removeSection(id: string) {
    update((d) => {
      d.syncAgenda = d.syncAgenda.filter((x) => x.id !== id)
    })
  }
  function moveSection(id: string, dir: -1 | 1) {
    update((d) => {
      const sorted = [...d.syncAgenda].sort((a, b) => a.order - b.order)
      const i = sorted.findIndex((x) => x.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= sorted.length) return
      ;[sorted[i], sorted[j]] = [sorted[j], sorted[i]]
      sorted.forEach((s, k) => (s.order = k))
      d.syncAgenda = sorted
    })
  }

  const syncDates = Object.keys(data.artSyncs).sort().reverse()
  const reportable = points.length + openRisks.length
  const reported =
    points.filter((p) => p.reported).length +
    openRisks.filter((r) => reportedRiskIds.has(r.id)).length
  const hasContent = !!sync || actions.length > 0 || openRisks.length > 0

  return (
    <div>
      <PageHeader
        title="ART Sync"
        subtitle="La tua agenda di presentazione, già compilata dai tuoi dati. Da qui escono le action da portare al team."
        actions={
          <>
            <GuideButton section="artsync" />
            <Button size="sm" variant="ghost" onClick={() => setConfigOpen(true)}>
              Agenda
            </Button>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-40"
            />
            <CopyButton
              text={buildSyncText(data, date, agenda, points, openRisks, actions)}
              disabled={!hasContent}
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
        {/* Agenda */}
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
            {agenda.map((sec) => {
              if (sec.kind === 'risks') {
                return (
                  <div key={sec.id}>
                    <SectionHeader
                      label={sec.label}
                      hint="registro persistente — resta finché non è Resolved"
                      right={
                        resolvedRisks.length > 0 && (
                          <button
                            onClick={() => setShowResolved((v) => !v)}
                            className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                          >
                            {showResolved ? 'nascondi' : 'mostra'} {resolvedRisks.length} risolti
                          </button>
                        )
                      }
                    />
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

              const pts = pointsOf(sec)
              const stream = data.streams.find((s) => s.id === sec.streamId)
              const nSugg = suggestionsFor(sec).length
              return (
                <div key={sec.id}>
                  <SectionHeader
                    label={sec.label}
                    color={stream?.color}
                    hint={
                      sec.kind === 'dependencies'
                        ? 'critiche o scadute'
                        : sec.kind === 'meeting'
                          ? 'incontri con esterni da riportare'
                          : stream?.name
                    }
                    right={
                      nSugg > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => suggest(sec)}
                          title="Componi dai tuoi dati (attività, action, dipendenze, backlog esterni)"
                        >
                          ↻ componi ({nSugg})
                        </Button>
                      )
                    }
                  />
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
                          <RowMenu
                            items={[
                              {
                                label: '→ Sposta in…',
                                onClick: () => {
                                  const next =
                                    agenda[(agenda.findIndex((a) => a.id === sec.id) + 1) % agenda.length]
                                  if (next) patchPoint(p.id, { sectionId: next.id })
                                },
                              },
                              {
                                label: 'Elimina',
                                onClick: () => removePoint(p.id),
                                danger: true,
                              },
                            ]}
                          />
                        </div>
                        <input
                          value={p.note ?? ''}
                          onChange={(e) => patchPoint(p.id, { note: e.target.value })}
                          placeholder="+ nota (cosa è emerso)"
                          className="ml-7 w-[calc(100%-1.75rem)] bg-transparent py-0.5 text-xs text-[var(--color-muted)] outline-none placeholder:text-[var(--color-muted)]/50 focus:text-[var(--color-fg)]"
                        />
                      </div>
                    ))}
                    <AddLine onAdd={(t) => addPoint(sec, t)} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Actions */}
        <Card className="h-fit p-5">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold">Action in uscita</h3>
            <Badge color="neutral">
              {actions.filter((a) => a.status !== 'done').length} aperte
            </Badge>
          </div>
          <p className="mb-3 text-[11px] text-[var(--color-muted)]">
            Assegna owner e portale nella giornata. Le trovi anche in «Decisioni &
            Azioni» e in «Team → Deleghe».
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
              Dall'ART Sync deve uscire almeno un'azione con owner.
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
                      <AssigneePicker
                        owner={a.owner}
                        people={data.people}
                        onAssign={(name) => patchAction(a.id, { owner: name })}
                      />
                      <RowMenu
                        items={[
                          { label: '→ Diario di oggi', onClick: () => actionToDiario(a) },
                          { label: '→ Card Kanban', onClick: () => actionToKanban(a) },
                          {
                            label: 'Elimina',
                            onClick: () => removeAction(a.id),
                            danger: true,
                          },
                        ]}
                      />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-7">
                      <StreamPicker
                        streamId={a.streamId}
                        streams={data.streams}
                        onPick={(id) => patchAction(a.id, { streamId: id })}
                        compact
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
                      <Badge color={PRIO_META[a.priority ?? 'med'].color}>
                        {PRIO_META[a.priority ?? 'med'].label}
                      </Badge>
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
            hint="Usa «↻ componi» in ogni sezione per pescare dai tuoi dati (attività, action, dipendenze, backlog esterni), poi aggiungi a mano ciò che manca. Timebox 30-60 min: si identificano i problemi, non si risolvono."
          />
        </div>
      )}

      {/* Agenda config */}
      <Modal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Agenda ART Sync"
        wide
        footer={
          <>
            <Button onClick={addSection}>
              <IconPlus width={15} height={15} /> Aggiungi sezione
            </Button>
            <Button variant="primary" onClick={() => setConfigOpen(false)}>
              Chiudi
            </Button>
          </>
        }
      >
        <p className="mb-3 text-xs text-[var(--color-muted)]">
          Queste sono le sezioni che presenti. «Stream» si compila dagli item
          taggati con quel flusso; «Dipendenze» e «Meeting» pescano dalle rispettive
          sezioni; «Rischi» mostra il registro ROAM.
        </p>
        <div className="space-y-2">
          {agenda.map((sec, i) => (
            <div key={sec.id} className="flex flex-wrap items-center gap-2">
              <div className="flex flex-col">
                <button
                  onClick={() => moveSection(sec.id, -1)}
                  disabled={i === 0}
                  className="text-xs text-[var(--color-muted)] disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveSection(sec.id, 1)}
                  disabled={i === agenda.length - 1}
                  className="text-xs text-[var(--color-muted)] disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
              <Input
                value={sec.label}
                onChange={(e) => patchSection(sec.id, { label: e.target.value })}
                className="w-52"
              />
              <Select
                value={sec.kind}
                onChange={(e) =>
                  patchSection(sec.id, { kind: e.target.value as SyncSectionKind })
                }
                className="h-9"
              >
                {(Object.keys(KIND_LABEL) as SyncSectionKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </Select>
              {sec.kind === 'stream' && (
                <Select
                  value={sec.streamId ?? ''}
                  onChange={(e) =>
                    patchSection(sec.id, { streamId: e.target.value || undefined })
                  }
                  className="h-9"
                >
                  <option value="">— stream —</option>
                  {data.streams.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
              <button
                onClick={() => removeSection(sec.id)}
                className="ml-auto text-[var(--color-muted)] hover:text-[var(--color-danger)]"
              >
                <IconTrash width={15} height={15} />
              </button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}

function SectionHeader({
  label,
  hint,
  right,
  color,
}: {
  label: string
  hint?: string
  right?: React.ReactNode
  color?: string
}) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      {color && (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: color }}
        />
      )}
      <span
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: color ?? 'var(--color-primary)' }}
      >
        {label}
      </span>
      {hint && <span className="text-[11px] text-[var(--color-muted)]">{hint}</span>}
      <span className="ml-auto">{right}</span>
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

/** Builds the presentation text in the user's own agenda format. */
function buildSyncText(
  data: AppData,
  date: string,
  agenda: SyncSection[],
  points: ArtSync['points'],
  openRisks: RoamRisk[],
  actions: ActionItem[],
): string {
  const L: string[] = [`ART Sync — ${fmtDate(date)}`, '']
  agenda.forEach((sec) => {
    L.push(`${sec.label}:`)
    if (sec.kind === 'risks') {
      openRisks.forEach((r) => {
        const meta = [r.roam, r.owner].filter(Boolean)
        L.push(`- ${r.title}${meta.length ? ` [${meta.join(' · ')}]` : ''}`)
      })
    } else {
      points
        .filter(
          (p) =>
            p.sectionId === sec.id ||
            (!p.sectionId && p.category !== 'risk' && sec.id === agenda[0]?.id),
        )
        .forEach((p) => L.push(`- ${p.text}${p.note ? ` (${p.note})` : ''}`))
    }
    L.push('')
  })
  if (actions.length) {
    L.push('Action in uscita:')
    actions.forEach((a) => {
      const meta = [PRIO_META[a.priority ?? 'med'].label]
      if (a.owner) meta.push(a.owner)
      if (a.due) meta.push(`scad. ${fmtDate(a.due)}`)
      L.push(`- ${a.title} (${meta.join(' · ')})`)
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

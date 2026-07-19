import { useState } from 'react'
import { useStore } from '../store'
import type { AppData, WeeklyReviewStats } from '../types'
import { Button, Card, Badge, Field, Textarea } from '../components/ui'
import { IconCheck, IconActivity } from '../components/icons'
import { uid, nowISO, mondayOf, weekLabel } from '../lib/utils'

/** Auto-computed numbers for the week starting at `wkStart` (Monday ISO). */
export function computeWeekStats(data: AppData, wkStart: string): WeeklyReviewStats {
  let activitiesDone = 0
  let activitiesCarried = 0
  for (const [day, acts] of Object.entries(data.dailyActivities)) {
    if (day < wkStart) continue
    for (const a of acts) {
      if (a.status === 'done') activitiesDone++
      if ((a.carryCount ?? 0) > 0) activitiesCarried++
    }
  }
  const doneThisWeek = data.kanban.filter(
    (c) => c.column === 'done' && c.updatedAt.slice(0, 10) >= wkStart,
  )
  const cycleTimes = doneThisWeek
    .map(
      (c) =>
        (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()) /
        86400000,
    )
    .filter((n) => n >= 0)
  return {
    activitiesDone,
    activitiesCarried,
    kanbanDone: doneThisWeek.length,
    depsClosed: data.dependencies.filter(
      (x) => x.status === 'closed' && x.lastUpdate.slice(0, 10) >= wkStart,
    ).length,
    risksResolved: data.roamRisks.filter(
      (r) => r.roam === 'resolved' && r.updatedAt.slice(0, 10) >= wkStart,
    ).length,
    avgCycleTimeDays: cycleTimes.length
      ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
      : undefined,
  }
}

const STAT_LABELS: { key: keyof WeeklyReviewStats; label: string }[] = [
  { key: 'activitiesDone', label: 'Attività chiuse' },
  { key: 'activitiesCarried', label: 'Riportate' },
  { key: 'kanbanDone', label: 'Card chiuse' },
  { key: 'depsClosed', label: 'Dipendenze chiuse' },
  { key: 'risksResolved', label: 'Rischi risolti' },
]

export default function WeekClose() {
  const { data, update } = useStore()
  const wkStart = mondayOf()
  const existing = data.weeklyReviews[wkStart]
  const [wentWell, setWentWell] = useState(existing?.wentWell ?? '')
  const [toImprove, setToImprove] = useState(existing?.toImprove ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [saved, setSaved] = useState(false)
  const [actionCreated, setActionCreated] = useState(false)

  const stats = computeWeekStats(data, wkStart)

  function closeWeek() {
    update((d) => {
      d.weeklyReviews[wkStart] = {
        weekOf: wkStart,
        wentWell: wentWell.trim(),
        toImprove: toImprove.trim(),
        notes: notes.trim(),
        stats,
        closedAt: nowISO(),
      }
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  function improveToAction() {
    const t = toImprove.trim()
    if (!t) return
    update((d) =>
      d.actions.unshift({
        id: uid(),
        title: t,
        status: 'todo',
        createdAt: nowISO(),
      }),
    )
    setActionCreated(true)
    setTimeout(() => setActionCreated(false), 2200)
  }

  const history = Object.values(data.weeklyReviews).sort((a, b) =>
    b.weekOf.localeCompare(a.weekOf),
  )

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <div className="mb-1 flex items-center gap-2">
          <IconActivity width={16} height={16} />
          <h3 className="text-sm font-semibold">
            Chiudi la settimana del {weekLabel(wkStart)}
          </h3>
          {existing && <Badge color="success">già chiusa — puoi aggiornarla</Badge>}
        </div>
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          5 minuti il venerdì: guarda i numeri, scrivi due righe, chiudi. È la tua
          retrospettiva personale.
        </p>

        {/* Auto stats */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {STAT_LABELS.map((s) => (
            <div
              key={s.key}
              className="rounded-[calc(var(--radius)-0.25rem)] border bg-[var(--color-surface-2)]/40 px-3 py-2"
            >
              <div className="text-xl font-semibold tabular-nums">
                {stats[s.key] as number}
              </div>
              <div className="text-[11px] text-[var(--color-muted)]">{s.label}</div>
            </div>
          ))}
          {stats.avgCycleTimeDays !== undefined && (
            <div className="rounded-[calc(var(--radius)-0.25rem)] border bg-[var(--color-surface-2)]/40 px-3 py-2">
              <div className="text-xl font-semibold tabular-nums">
                {stats.avgCycleTimeDays < 1
                  ? '<1'
                  : stats.avgCycleTimeDays.toFixed(1)}
                <span className="text-sm font-normal"> g</span>
              </div>
              <div className="text-[11px] text-[var(--color-muted)]">
                Cycle time medio
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Field label="✅ Cosa è andato bene">
            <Textarea
              rows={2}
              value={wentWell}
              onChange={(e) => setWentWell(e.target.value)}
              placeholder="Vittorie, sblocchi, cose da ripetere…"
            />
          </Field>
          <div>
            <Field label="▲ Cosa migliorare">
              <Textarea
                rows={2}
                value={toImprove}
                onChange={(e) => setToImprove(e.target.value)}
                placeholder="Un miglioramento concreto per la prossima settimana…"
              />
            </Field>
            {toImprove.trim() && (
              <button
                onClick={improveToAction}
                className="mt-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
              >
                {actionCreated ? '✓ Creato in Azioni' : '→ Crea action item'}
              </button>
            )}
          </div>
          <Field label="📝 Note">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contesto, decisioni, cose da ricordare…"
            />
          </Field>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button variant="primary" onClick={closeWeek}>
            {existing ? 'Aggiorna chiusura' : 'Chiudi la settimana'}
          </Button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-[var(--color-success)]">
              <IconCheck width={15} height={15} /> Salvata
            </span>
          )}
        </div>
      </Card>

      {/* History */}
      <Card className="h-fit p-5">
        <h3 className="mb-3 text-sm font-semibold">Settimane chiuse</h3>
        {history.length === 0 ? (
          <p className="py-4 text-center text-xs text-[var(--color-muted)]">
            Nessuna chiusura ancora. La prima è quella che conta di più. 📈
          </p>
        ) : (
          <div className="space-y-3">
            {history.slice(0, 8).map((r) => (
              <div
                key={r.weekOf}
                className="rounded-[calc(var(--radius)-0.25rem)] border p-3"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-medium">
                    Settimana del {weekLabel(r.weekOf)}
                  </span>
                  {r.weekOf === wkStart && <Badge color="primary">questa</Badge>}
                </div>
                <p className="text-xs text-[var(--color-muted)]">
                  {r.stats.activitiesDone} attività · {r.stats.kanbanDone} card ·{' '}
                  {r.stats.depsClosed} dipendenze · {r.stats.risksResolved} rischi
                  {r.stats.activitiesCarried > 0 &&
                    ` · ${r.stats.activitiesCarried} riportate`}
                </p>
                {r.wentWell && (
                  <p className="mt-1.5 text-xs">
                    <span className="font-semibold text-[var(--color-success)]">
                      Bene:{' '}
                    </span>
                    {r.wentWell}
                  </p>
                )}
                {r.toImprove && (
                  <p className="text-xs">
                    <span className="font-semibold text-[var(--color-warning)]">
                      Migliorare:{' '}
                    </span>
                    {r.toImprove}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

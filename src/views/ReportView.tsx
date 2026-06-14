import { useStore } from '../store'
import { Button } from '../components/ui'
import { IconPrint } from '../components/icons'
import {
  todayISO,
  fmtDate,
  relativeDays,
  ageInDays,
  mondayOf,
  weekLabel,
  daysFromToday,
} from '../lib/utils'
import { KANBAN_COLUMNS, DORA_METRICS, type DoraEntry } from '../types'

export default function ReportView() {
  const { data } = useStore()
  const today = todayISO()
  const dailyTop = (data.dailyTop[today] ?? []).filter(Boolean)
  const weekTop = data.weekTop.filter(Boolean)

  const colCounts = KANBAN_COLUMNS.map((c) => ({
    ...c,
    n: data.kanban.filter((k) => k.column === c.key).length,
  }))
  const stale = data.kanban.filter(
    (k) => k.column !== 'done' && ageInDays(k.updatedAt) >= 7,
  )
  const openActions = data.actions
    .filter((a) => a.status !== 'done')
    .sort((a, b) => (daysFromToday(a.due) ?? 9e9) - (daysFromToday(b.due) ?? 9e9))
  const activeSprint =
    data.sprints.find((s) => s.status === 'active') ?? data.sprints[0]
  const openRisks = data.risks.filter((r) => r.status !== 'closed')
  const recentDecisions = data.decisions.slice(0, 5)

  const week = mondayOf()
  const dora = data.dora.find((e) => e.weekOf === week)
  const doraAvg = dora
    ? (dora.leadTime + dora.deployFreq + dora.mttr + dora.changeFail) / 4
    : null

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-3" data-noprint>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Report</h2>
          <p className="mt-0.5 text-sm text-[var(--color-muted)]">
            Anteprima del resoconto. Usa «Stampa / Salva PDF» e scegli «Salva come
            PDF» come stampante.
          </p>
        </div>
        <Button variant="primary" onClick={() => window.print()}>
          <IconPrint width={16} height={16} /> Stampa / Salva PDF
        </Button>
      </div>

      <div className="report-print mx-auto max-w-3xl rounded-[var(--radius)] border bg-[var(--color-surface)] p-8">
        <header className="mb-6 border-b pb-4">
          <h1 className="text-xl font-bold">Report DevOps Manager</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {new Date().toLocaleDateString('it-IT', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            {data.settings.managerName ? ` · ${data.settings.managerName}` : ''}
          </p>
        </header>

        <Section title="Focus">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="mb-1 font-medium">Oggi</p>
              {dailyTop.length ? (
                <ol className="list-decimal pl-4">
                  {dailyTop.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ol>
              ) : (
                <Dash />
              )}
            </div>
            <div>
              <p className="mb-1 font-medium">Settimana</p>
              {weekTop.length ? (
                <ol className="list-decimal pl-4">
                  {weekTop.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ol>
              ) : (
                <Dash />
              )}
            </div>
          </div>
        </Section>

        {activeSprint && (
          <Section title={`Sprint corrente · ${activeSprint.name}`}>
            {activeSprint.goals ? (
              <p className="whitespace-pre-wrap text-sm">{activeSprint.goals}</p>
            ) : (
              <Dash />
            )}
            {activeSprint.retroImprove && (
              <p className="mt-1 text-sm">
                <span className="font-medium">Da migliorare: </span>
                {activeSprint.retroImprove}
              </p>
            )}
          </Section>
        )}

        <Section title="Kanban">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {colCounts.map((c) => (
              <span key={c.key}>
                {c.label}: <strong>{c.n}</strong>
              </span>
            ))}
          </div>
          {stale.length > 0 && (
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Ferme da ≥7 giorni: {stale.map((s) => s.title).join(', ')}
            </p>
          )}
        </Section>

        <Section title={`Team (${data.people.length})`}>
          {data.people.length === 0 ? (
            <Dash />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--color-muted)]">
                  <th className="py-1 font-medium">Persona</th>
                  <th className="py-1 font-medium">Ultimo 1:1</th>
                  <th className="py-1 font-medium">Prossimo 1:1</th>
                </tr>
              </thead>
              <tbody>
                {data.people.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="py-1">{p.name}</td>
                    <td className="py-1">
                      {p.oneOnOnes[0] ? fmtDate(p.oneOnOnes[0].date) : '—'}
                    </td>
                    <td className="py-1">
                      {p.nextOneOnOne ? relativeDays(p.nextOneOnOne) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Salute (DORA)">
          {doraAvg === null ? (
            <Dash hint="Nessuna valutazione questa settimana" />
          ) : (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <span>
                Media settimana {weekLabel(week)}:{' '}
                <strong>{doraAvg.toFixed(1)}/5</strong>
              </span>
              {DORA_METRICS.map((m) => (
                <span key={m.key as string} className="text-[var(--color-muted)]">
                  {m.label}: {(dora as DoraEntry)[m.key] as number}
                </span>
              ))}
            </div>
          )}
        </Section>

        <Section title={`Action item aperti (${openActions.length})`}>
          {openActions.length === 0 ? (
            <Dash />
          ) : (
            <ul className="space-y-0.5 text-sm">
              {openActions.slice(0, 12).map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span>
                    {a.title}
                    {a.owner ? ` · ${a.owner}` : ''}
                  </span>
                  <span className="shrink-0 text-[var(--color-muted)]">
                    {a.due ? relativeDays(a.due) : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {openRisks.length > 0 && (
          <Section title={`Rischi aperti (${openRisks.length})`}>
            <ul className="space-y-0.5 text-sm">
              {openRisks.map((r) => (
                <li key={r.id}>
                  {r.title}{' '}
                  <span className="text-[var(--color-muted)]">
                    ({r.severity === 'high' ? 'alto' : r.severity === 'med' ? 'medio' : 'basso'})
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {recentDecisions.length > 0 && (
          <Section title="Decisioni recenti">
            <ul className="space-y-0.5 text-sm">
              {recentDecisions.map((d) => (
                <li key={d.id} className="flex justify-between gap-3">
                  <span>{d.title}</span>
                  <span className="shrink-0 text-[var(--color-muted)]">
                    {fmtDate(d.date)}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Dash({ hint }: { hint?: string }) {
  return <p className="text-sm text-[var(--color-muted)]">{hint ?? '—'}</p>
}

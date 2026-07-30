import { useStore } from '../store'
import { Card, Badge, EmptyState } from '../components/ui'
import { IconUsers, IconCheck } from '../components/icons'
import { StreamChip } from '../components/Stream'
import {
  fmtDate,
  relativeDays,
  daysFromToday,
  ageInDays,
  initials,
  cn,
} from '../lib/utils'

interface Row {
  id: string
  title: string
  kind: 'Attività' | 'Action'
  status: 'todo' | 'doing' | 'done'
  due?: string
  streamId?: string
  age: number
  day?: string
}

/** Everything assigned to someone, grouped by person: what I delegated and how it's going. */
export default function Delegations() {
  const { data } = useStore()

  const rows: Record<string, Row[]> = {}
  const push = (owner: string, r: Row) => {
    if (!rows[owner]) rows[owner] = []
    rows[owner].push(r)
  }

  for (const [day, acts] of Object.entries(data.dailyActivities)) {
    for (const a of acts) {
      if (!a.owner) continue
      push(a.owner, {
        id: a.id,
        title: a.text,
        kind: 'Attività',
        status: a.status,
        streamId: a.streamId,
        age: ageInDays(a.createdAt),
        day,
      })
    }
  }
  for (const a of data.actions) {
    if (!a.owner) continue
    push(a.owner, {
      id: a.id,
      title: a.title,
      kind: 'Action',
      status: a.status,
      due: a.due,
      streamId: a.streamId,
      age: ageInDays(a.createdAt),
    })
  }

  const owners = Object.keys(rows).sort()
  const openCount = (o: string) => rows[o].filter((r) => r.status !== 'done').length

  if (owners.length === 0) {
    return (
      <EmptyState
        icon={<IconUsers width={28} height={28} />}
        title="Nessuna delega attiva"
        hint="Assegna attività dal Diario di oggi o action dall'ART Sync con l'avatar: qui trovi il quadro di cosa hai passato a chi, con lo stato e da quanto tempo."
      />
    )
  }

  return (
    <div className="space-y-4">
      {owners.map((owner) => {
        const person = data.people.find((p) => p.name === owner)
        const list = [...rows[owner]].sort((a, b) => {
          if ((a.status === 'done') !== (b.status === 'done'))
            return a.status === 'done' ? 1 : -1
          return (daysFromToday(a.due) ?? 9999) - (daysFromToday(b.due) ?? 9999)
        })
        const stuck = list.filter((r) => r.status !== 'done' && r.age >= 5).length
        return (
          <Card key={owner} className="p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <span
                className="grid h-8 w-8 place-items-center rounded-full text-xs font-semibold text-white"
                style={{ background: person?.color ?? 'var(--color-muted)' }}
              >
                {initials(owner)}
              </span>
              <div className="leading-tight">
                <p className="font-medium">{owner}</p>
                <p className="text-xs text-[var(--color-muted)]">
                  {person?.role || 'non nel team'}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <Badge color={openCount(owner) > 0 ? 'primary' : 'success'}>
                  {openCount(owner)} aperte
                </Badge>
                {stuck > 0 && <Badge color="danger">{stuck} ferme ≥5g</Badge>}
              </div>
            </div>

            <div className="space-y-1.5">
              {list.map((r) => {
                const overdue =
                  r.status !== 'done' && r.due && (daysFromToday(r.due) ?? 0) < 0
                return (
                  <div
                    key={r.kind + r.id}
                    className={cn(
                      'flex flex-wrap items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] border px-3 py-1.5 text-sm',
                      r.status === 'done' && 'opacity-50',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-4 w-4 shrink-0 place-items-center rounded border text-white',
                        r.status === 'done'
                          ? 'border-[var(--color-success)] bg-[var(--color-success)]'
                          : r.status === 'doing'
                            ? 'border-[var(--color-warning)] bg-[var(--color-warning)]'
                            : 'bg-transparent',
                      )}
                    >
                      {r.status === 'done' && <IconCheck width={11} height={11} />}
                    </span>
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate',
                        r.status === 'done' && 'line-through',
                      )}
                    >
                      {r.title}
                    </span>
                    <StreamChip
                      stream={data.streams.find((s) => s.id === r.streamId)}
                    />
                    <Badge color="neutral">{r.kind}</Badge>
                    {r.day && (
                      <span className="text-[11px] text-[var(--color-muted)]">
                        {fmtDate(r.day)}
                      </span>
                    )}
                    {r.due && (
                      <Badge color={overdue ? 'danger' : 'neutral'}>
                        {relativeDays(r.due)}
                      </Badge>
                    )}
                    {r.status !== 'done' && r.age >= 5 && (
                      <Badge color="warning">da {r.age}g</Badge>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

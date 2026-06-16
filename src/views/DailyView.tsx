import { useState } from 'react'
import { useStore } from '../store'
import { Button, Card, Badge, EmptyState, Modal } from '../components/ui'
import {
  IconPlus,
  IconCheck,
  IconTrash,
  IconCalendar,
  IconWarn,
  IconBoard,
} from '../components/icons'
import {
  todayISO,
  uid,
  nowISO,
  fmtDate,
  relativeDays,
  daysFromToday,
  mondayOf,
  weekLabel,
  parseCapture,
} from '../lib/utils'
import { PageHeader } from '../components/ui'
import { GuideButton } from '../components/Guide'

export default function DailyView() {
  const { data, update } = useStore()
  const today = todayISO()
  const thisWeek = mondayOf()
  const top = data.dailyTop[today] ?? ['', '', '']
  const doneArr = data.dailyDone[today] ?? [false, false, false]
  const [capture, setCapture] = useState('')
  const peopleNames = data.people.map((p) => p.name)

  function setTop(i: number, value: string) {
    update((d) => {
      const arr = [...(d.dailyTop[today] ?? ['', '', ''])]
      arr[i] = value
      d.dailyTop[today] = arr
    })
  }

  function toggleTopDone(i: number) {
    update((d) => {
      const arr = [...(d.dailyDone[today] ?? [false, false, false])]
      arr[i] = !arr[i]
      d.dailyDone[today] = arr
    })
  }

  // Carry-over: most recent past day with priorities still open
  const prevKey = Object.keys(data.dailyTop)
    .filter((k) => k < today && (data.dailyTop[k] ?? []).some((x) => x && x.trim()))
    .sort()
    .pop()
  const carryItems = prevKey
    ? (data.dailyTop[prevKey] ?? [])
        .map((t, i) => ({ t, done: (data.dailyDone[prevKey] ?? [])[i] }))
        .filter((x) => x.t && x.t.trim() && !x.done)
        .map((x) => x.t)
    : []
  const todayEmpty = !top.some((x) => x && x.trim())
  const showCarry = todayEmpty && carryItems.length > 0

  function applyCarry() {
    update((d) => {
      const arr = ['', '', '']
      carryItems.slice(0, 3).forEach((t, i) => (arr[i] = t))
      d.dailyTop[today] = arr
    })
  }

  function setWeek(i: number, value: string) {
    update((d) => {
      const arr = [...(d.weeklyFocus[thisWeek] ?? ['', '', ''])]
      while (arr.length < 3) arr.push('')
      arr[i] = value
      d.weeklyFocus[thisWeek] = arr
    })
  }

  function addCapture() {
    const text = capture.trim()
    if (!text) return
    update((d) =>
      d.quickCapture.unshift({ id: uid(), text, createdAt: nowISO(), done: false }),
    )
    setCapture('')
  }

  function toggleCapture(id: string) {
    update((d) => {
      const n = d.quickCapture.find((x) => x.id === id)
      if (n) n.done = !n.done
    })
  }

  function removeCapture(id: string) {
    update((d) => {
      d.quickCapture = d.quickCapture.filter((x) => x.id !== id)
    })
  }

  function promoteToKanban(id: string) {
    update((d) => {
      const n = d.quickCapture.find((x) => x.id === id)
      if (!n) return
      const p = parseCapture(n.text, d.people.map((x) => x.name))
      d.kanban.unshift({
        id: uid(),
        title: p.title || n.text,
        column: 'todo',
        priority: p.priority ?? 'med',
        tag: p.owner,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      })
      d.quickCapture = d.quickCapture.filter((x) => x.id !== id)
    })
  }

  function promoteToAction(id: string) {
    update((d) => {
      const n = d.quickCapture.find((x) => x.id === id)
      if (!n) return
      const p = parseCapture(n.text, d.people.map((x) => x.name))
      d.actions.unshift({
        id: uid(),
        title: p.title || n.text,
        owner: p.owner,
        due: p.due,
        status: 'todo',
        createdAt: nowISO(),
      })
      d.quickCapture = d.quickCapture.filter((x) => x.id !== id)
    })
  }

  const weekArr = data.weeklyFocus[thisWeek] ?? ['', '', '']
  const week = [weekArr[0] ?? '', weekArr[1] ?? '', weekArr[2] ?? '']
  const openCapture = data.quickCapture.filter((n) => !n.done)

  // Daily overview signals
  const upcoming1on1 = data.people
    .filter((p) => p.nextOneOnOne)
    .map((p) => ({ p, d: daysFromToday(p.nextOneOnOne) }))
    .filter((x) => x.d !== null && (x.d as number) <= 7)
    .sort((a, b) => (a.d as number) - (b.d as number))

  const dueActions = data.actions
    .filter((a) => a.status !== 'done' && a.due)
    .map((a) => ({ a, d: daysFromToday(a.due) }))
    .filter((x) => x.d !== null && (x.d as number) <= 3)
    .sort((a, b) => (a.d as number) - (b.d as number))

  const dateLabel = new Date().toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div>
      <PageHeader
        title="Oggi"
        subtitle={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
        actions={<GuideButton section="daily" />}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Focus columns */}
        <div className="space-y-5 lg:col-span-2">
          {showCarry && (
            <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-dashed bg-[color-mix(in_oklch,var(--color-warning)_10%,transparent)] px-4 py-2.5 text-sm">
              <IconWarn width={16} height={16} className="text-[var(--color-warning)]" />
              <span>
                Hai <strong>{carryItems.length}</strong>{' '}
                {carryItems.length === 1 ? 'priorità non chiusa' : 'priorità non chiuse'} da{' '}
                {fmtDate(prevKey)}.
              </span>
              <Button size="sm" variant="primary" className="ml-auto" onClick={applyCarry}>
                Riporta a oggi
              </Button>
            </div>
          )}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Le 3 priorità di oggi</h3>
              <HistoryButton
                title="Storico priorità giornaliere"
                entries={data.dailyTop}
                currentKey={today}
                labelFor={(k) => fmtDate(k)}
              />
            </div>
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <PriorityRow
                  key={i}
                  index={i}
                  value={top[i] ?? ''}
                  onChange={(v) => setTop(i, v)}
                  done={doneArr[i]}
                  onToggleDone={() => toggleTopDone(i)}
                />
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-sm font-semibold">Quick capture</h3>
              <span className="text-xs text-[var(--color-muted)]">
                butta giù tutto, smista dopo
              </span>
            </div>
            <div className="flex gap-2">
              <input
                value={capture}
                onChange={(e) => setCapture(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCapture()}
                placeholder="Es. «Sollecitare vendor @Luca !alta /ven»"
                className="h-9 flex-1 rounded-[calc(var(--radius)-0.25rem)] border bg-[var(--color-bg)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
              />
              <Button variant="primary" onClick={addCapture}>
                <IconPlus /> Aggiungi
              </Button>
            </div>
            {(() => {
              const cap = capture.trim()
                ? parseCapture(capture, peopleNames)
                : null
              if (!cap || (!cap.owner && !cap.priority && !cap.due)) return null
              return (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-muted)]">
                  <span>Riconosciuto:</span>
                  {cap.owner && <Badge color="primary">owner: {cap.owner}</Badge>}
                  {cap.priority && (
                    <Badge
                      color={
                        cap.priority === 'high'
                          ? 'danger'
                          : cap.priority === 'low'
                            ? 'neutral'
                            : 'warning'
                      }
                    >
                      priorità:{' '}
                      {cap.priority === 'high'
                        ? 'alta'
                        : cap.priority === 'low'
                          ? 'bassa'
                          : 'media'}
                    </Badge>
                  )}
                  {cap.due && <Badge color="success">scad.: {fmtDate(cap.due)}</Badge>}
                </div>
              )
            })()}

            <div className="mt-3 space-y-1.5">
              {openCapture.length === 0 && (
                <p className="py-2 text-center text-xs text-[var(--color-muted)]">
                  Inbox vuota. 🎯
                </p>
              )}
              {openCapture.map((n) => (
                <div
                  key={n.id}
                  className="group flex items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] border px-3 py-2"
                >
                  <button
                    onClick={() => toggleCapture(n.id)}
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-md border text-transparent hover:text-[var(--color-success)]"
                    aria-label="Completa"
                  >
                    <IconCheck width={14} height={14} />
                  </button>
                  <span className="flex-1 text-sm">{n.text}</span>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => promoteToKanban(n.id)}
                      title="Sposta nel Kanban"
                    >
                      <IconBoard width={14} height={14} /> Kanban
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => promoteToAction(n.id)}
                      title="Crea action item"
                    >
                      <IconCheck width={14} height={14} /> Azione
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeCapture(n.id)}
                      aria-label="Elimina"
                    >
                      <IconTrash width={14} height={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Side rail */}
        <div className="space-y-5">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Focus della settimana</h3>
              <HistoryButton
                title="Storico focus settimanali"
                entries={data.weeklyFocus}
                currentKey={thisWeek}
                labelFor={(k) => `Settimana del ${weekLabel(k)}`}
              />
            </div>
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <PriorityRow
                  key={i}
                  index={i}
                  value={week[i]}
                  onChange={(v) => setWeek(i, v)}
                  subtle
                />
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <IconCalendar width={16} height={16} />
              <h3 className="text-sm font-semibold">1:1 in arrivo</h3>
            </div>
            {upcoming1on1.length === 0 ? (
              <p className="text-xs text-[var(--color-muted)]">
                Nessun 1:1 pianificato nei prossimi 7 giorni.
              </p>
            ) : (
              <div className="space-y-2">
                {upcoming1on1.map(({ p, d }) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <span className="text-sm">{p.name}</span>
                    <Badge color={(d as number) <= 1 ? 'warning' : 'neutral'}>
                      {relativeDays(p.nextOneOnOne)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <IconWarn width={16} height={16} />
              <h3 className="text-sm font-semibold">Azioni in scadenza</h3>
            </div>
            {dueActions.length === 0 ? (
              <p className="text-xs text-[var(--color-muted)]">
                Niente in scadenza nei prossimi 3 giorni.
              </p>
            ) : (
              <div className="space-y-2">
                {dueActions.map(({ a, d }) => (
                  <div key={a.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm">{a.title}</span>
                    <Badge color={(d as number) < 0 ? 'danger' : 'warning'}>
                      {fmtDate(a.due)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {data.people.length === 0 &&
        data.kanban.length === 0 &&
        data.actions.length === 0 && (
          <div className="mt-5">
            <EmptyState
              title="Benvenuto nella tua dashboard"
              hint="Inizia aggiungendo le persone del team, le tue attività nel Kanban o registrando le decisioni. Tutto resta salvato sul tuo PC."
            />
          </div>
        )}
    </div>
  )
}

function HistoryButton({
  title,
  entries,
  currentKey,
  labelFor,
}: {
  title: string
  entries: Record<string, string[]>
  currentKey: string
  labelFor: (key: string) => string
}) {
  const [open, setOpen] = useState(false)
  const items = Object.entries(entries)
    .filter(
      ([k, v]) =>
        k !== currentKey && Array.isArray(v) && v.some((x) => x && x.trim()),
    )
    .sort((a, b) => b[0].localeCompare(a[0]))

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} title="Vedi lo storico">
        <IconCalendar width={14} height={14} /> Storico
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={
          <Button variant="primary" onClick={() => setOpen(false)}>
            Chiudi
          </Button>
        }
      >
        {items.length === 0 ? (
          <p className="py-2 text-center text-sm text-[var(--color-muted)]">
            Ancora nessuno storico da mostrare.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map(([k, v]) => (
              <div
                key={k}
                className="rounded-[calc(var(--radius)-0.25rem)] border p-3"
              >
                <p className="mb-1.5 text-xs font-semibold text-[var(--color-muted)]">
                  {labelFor(k)}
                </p>
                <ol className="list-decimal space-y-0.5 pl-5 text-sm">
                  {v
                    .filter((x) => x && x.trim())
                    .map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  )
}

function PriorityRow({
  index,
  value,
  onChange,
  subtle,
  done,
  onToggleDone,
}: {
  index: number
  value: string
  onChange: (v: string) => void
  subtle?: boolean
  done?: boolean
  onToggleDone?: () => void
}) {
  const badgeClass =
    'grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors ' +
    (done
      ? 'bg-[var(--color-success)] text-white'
      : subtle
        ? 'bg-[var(--color-surface-2)] text-[var(--color-muted)]'
        : 'bg-[color-mix(in_oklch,var(--color-primary)_15%,transparent)] text-[var(--color-primary)]')

  return (
    <div className="flex items-center gap-3">
      {onToggleDone ? (
        <button
          onClick={onToggleDone}
          className={badgeClass}
          title={done ? 'Segna come da fare' : 'Segna come fatta'}
        >
          {done ? <IconCheck width={14} height={14} /> : index + 1}
        </button>
      ) : (
        <span className={badgeClass}>{index + 1}</span>
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={index === 0 ? 'La cosa più importante…' : '…'}
        className={
          'h-9 flex-1 border-b bg-transparent text-sm outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] ' +
          (done ? 'text-[var(--color-muted)] line-through' : '')
        }
      />
    </div>
  )
}

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
  IconLink,
  IconActivity,
} from '../components/icons'
import {
  todayISO,
  uid,
  nowISO,
  fmtDate,
  fmtTime,
  relativeDays,
  daysFromToday,
  mondayOf,
  weekLabel,
  ageInDays,
} from '../lib/utils'
import type { ActivityStatus } from '../types'
import { PageHeader } from '../components/ui'
import { GuideButton } from '../components/Guide'
import { RowMenu, AssigneePicker } from '../components/RowMenu'
import { StreamPicker } from '../components/Stream'
import { sectionForStream } from '../lib/sync'
import { KANBAN_COLUMNS } from '../types'

export default function DailyView({
  onNavigate,
}: {
  onNavigate?: (tab: string) => void
}) {
  const { data, update } = useStore()
  const today = todayISO()
  const thisWeek = mondayOf()
  const top = data.dailyTop[today] ?? ['', '', '']
  const doneArr = data.dailyDone[today] ?? [false, false, false]
  const topNotes = data.dailyTopNotes[today] ?? ['', '', '']

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

  function setTopNote(i: number, value: string) {
    update((d) => {
      const arr = [...(d.dailyTopNotes[today] ?? ['', '', ''])]
      arr[i] = value
      d.dailyTopNotes[today] = arr
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

  // Cockpit: what to work on now — in-progress + due/overdue cards
  const focusCards = (() => {
    const m = new Map<string, (typeof data.kanban)[number]>()
    data.kanban
      .filter((c) => c.column !== 'done')
      .forEach((c) => {
        const d = daysFromToday(c.due)
        if (c.column === 'doing' || (d !== null && d <= 2)) m.set(c.id, c)
      })
    return [...m.values()].sort(
      (a, b) => (daysFromToday(a.due) ?? 9999) - (daysFromToday(b.due) ?? 9999),
    )
  })()

  function completeCard(id: string) {
    update((d) => {
      const c = d.kanban.find((x) => x.id === id)
      if (c) {
        c.column = 'done'
        c.updatedAt = nowISO()
      }
    })
  }

  // --- Activity diary (the day's worklog) ---
  const activities = data.dailyActivities[today] ?? []
  const [actText, setActText] = useState('')

  const plusDaysISO = (n: number) => {
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() + n)
    const tz = d.getTimezoneOffset() * 60000
    return new Date(d.getTime() - tz).toISOString().slice(0, 10)
  }

  function addActivityLines(raw: string) {
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.replace(/^[\s\-*•\d.)]+/, '').trim())
      .filter(Boolean)
    if (lines.length === 0) return
    update((d) => {
      const arr = [...(d.dailyActivities[today] ?? [])]
      lines.forEach((l) =>
        arr.push({ id: uid(), text: l, status: 'todo', createdAt: nowISO() }),
      )
      d.dailyActivities[today] = arr
    })
  }

  function addActivity() {
    if (!actText.trim()) return
    addActivityLines(actText)
    setActText('')
  }

  function assignActivity(id: string, owner: string | undefined) {
    update((d) => {
      const a = (d.dailyActivities[today] ?? []).find((x) => x.id === id)
      if (!a) return
      a.owner = owner
      // Keep the linked action (e.g. from ART Sync) in sync: one owner everywhere.
      if (a.actionId) {
        const act = d.actions.find((x) => x.id === a.actionId)
        if (act) act.owner = owner
      }
    })
  }

  function activityToKanban(a: (typeof activities)[number]) {
    update((d) => {
      d.kanban.unshift({
        id: uid(),
        title: a.text,
        notes: [a.note, a.owner ? `Assegnata a: ${a.owner}` : '']
          .filter(Boolean)
          .join('\n') || undefined,
        column: 'todo',
        priority: 'med',
        createdAt: nowISO(),
        updatedAt: nowISO(),
      })
    })
  }

  function activityToArtSync(a: (typeof activities)[number]) {
    const tmr = plusDaysISO(1)
    update((d) => {
      if (!d.artSyncs[tmr])
        d.artSyncs[tmr] = { date: tmr, points: [], actions: [], createdAt: nowISO() }
      d.artSyncs[tmr].points.push({
        id: uid(),
        category: 'progress',
        sectionId: sectionForStream(d, a.streamId),
        text: a.owner ? `${a.text} (→ ${a.owner})` : a.text,
        note: a.note,
        reported: false,
      })
    })
  }

  function moveActivityToTomorrow(a: (typeof activities)[number]) {
    const tmr = plusDaysISO(1)
    update((d) => {
      d.dailyActivities[today] = (d.dailyActivities[today] ?? []).filter(
        (x) => x.id !== a.id,
      )
      const arr = [...(d.dailyActivities[tmr] ?? [])]
      arr.push({
        id: uid(),
        text: a.text,
        status: 'todo',
        note: a.note,
        owner: a.owner,
        actionId: a.actionId,
        carryCount: (a.carryCount ?? 0) + 1,
        createdAt: nowISO(),
      })
      d.dailyActivities[tmr] = arr
    })
  }

  function cycleActivity(id: string) {
    const order: ActivityStatus[] = ['todo', 'doing', 'done']
    update((d) => {
      const a = (d.dailyActivities[today] ?? []).find((x) => x.id === id)
      if (!a) return
      a.status = order[(order.indexOf(a.status) + 1) % 3]
      // Linked action (e.g. from ART Sync): keep one single state everywhere.
      if (a.actionId) {
        const act = d.actions.find((x) => x.id === a.actionId)
        if (act) act.status = a.status
      }
    })
  }

  function setActivityText(id: string, text: string) {
    update((d) => {
      const a = (d.dailyActivities[today] ?? []).find((x) => x.id === id)
      if (a) a.text = text
    })
  }

  function setActivityNote(id: string, note: string) {
    update((d) => {
      const a = (d.dailyActivities[today] ?? []).find((x) => x.id === id)
      if (a) a.note = note
    })
  }

  function removeActivity(id: string) {
    update((d) => {
      d.dailyActivities[today] = (d.dailyActivities[today] ?? []).filter(
        (x) => x.id !== id,
      )
    })
  }

  function promoteToPriority(text: string) {
    update((d) => {
      const arr = [...(d.dailyTop[today] ?? ['', '', ''])]
      const idx = arr.findIndex((x) => !x || !x.trim())
      if (idx >= 0) arr[idx] = text
      d.dailyTop[today] = arr
    })
  }

  // Carry-over of yesterday's unfinished activities
  const prevActKey = Object.keys(data.dailyActivities)
    .filter(
      (k) => k < today && (data.dailyActivities[k] ?? []).some((a) => a.status !== 'done'),
    )
    .sort()
    .pop()
  const carryActs = prevActKey
    ? (data.dailyActivities[prevActKey] ?? []).filter((a) => a.status !== 'done')
    : []

  function carryActivities() {
    update((d) => {
      const arr = [...(d.dailyActivities[today] ?? [])]
      carryActs.forEach((a) =>
        arr.push({
          id: uid(),
          text: a.text,
          status: 'todo',
          note: a.note,
          actionId: a.actionId,
          carryCount: (a.carryCount ?? 0) + 1,
          createdAt: nowISO(),
        }),
      )
      d.dailyActivities[today] = arr
    })
  }

  // Automatic weekly mini-trend — derived from existing data, zero input.
  const wkStart = mondayOf()
  const prevWkStart = mondayOf(new Date(Date.now() - 7 * 86400000))
  const trend = (() => {
    let doneThis = 0
    let doneLast = 0
    let carriesThis = 0
    for (const [day, acts] of Object.entries(data.dailyActivities)) {
      for (const a of acts) {
        if (a.status === 'done') {
          if (day >= wkStart) doneThis++
          else if (day >= prevWkStart) doneLast++
        }
        if ((a.carryCount ?? 0) > 0 && day >= wkStart) carriesThis++
      }
    }
    const kanbanDone = data.kanban.filter(
      (c) => c.column === 'done' && c.updatedAt.slice(0, 10) >= wkStart,
    ).length
    const depsClosed = data.dependencies.filter(
      (x) => x.status === 'closed' && x.lastUpdate.slice(0, 10) >= wkStart,
    ).length
    return { doneThis, doneLast, carriesThis, kanbanDone, depsClosed }
  })()

  // "Quadro completo": everything still open across the whole dashboard.
  // If these are all zero, nothing has slipped through the cracks.
  const overview = [
    {
      label: 'da smistare',
      value: data.inbox.filter((i) => !i.triagedAt).length,
      tab: 'inbox',
      color: 'var(--color-warning)',
    },
    {
      label: 'dipendenze a rischio',
      value: data.dependencies.filter(
        (x) =>
          x.status !== 'closed' &&
          (x.criticality === 'high' ||
            (daysFromToday(x.neededBy) ?? 9999) < 0 ||
            (x.chaseCount ?? 0) >= 3),
      ).length,
      tab: 'dependencies',
      color: 'var(--color-danger)',
    },
    {
      label: 'deleghe ferme',
      value: (() => {
        let n = 0
        for (const acts of Object.values(data.dailyActivities))
          for (const a of acts)
            if (a.owner && a.status !== 'done' && ageInDays(a.createdAt) >= 5) n++
        n += data.actions.filter(
          (a) => a.owner && a.status !== 'done' && ageInDays(a.createdAt) >= 5,
        ).length
        n += data.inbox.filter(
          (i) => i.owner && !i.triagedAt && ageInDays(i.createdAt) >= 5,
        ).length
        return n
      })(),
      tab: 'team',
      color: 'var(--color-warning)',
    },
    {
      label: 'action aperte',
      value: data.actions.filter((a) => a.status !== 'done').length,
      tab: 'decisions',
      color: 'var(--color-primary)',
    },
    {
      label: 'backlog da ricontrollare',
      value: data.externalItems.filter(
        (x) =>
          x.status !== 'done' && x.status !== 'dropped' && ageInDays(x.lastCheck) >= 7,
      ).length,
      tab: 'dependencies',
      color: 'var(--color-muted)',
    },
  ]
  const allClear = overview.every((o) => o.value === 0)

  // Critical / overdue external dependencies for the side rail
  const hotDeps = data.dependencies
    .filter(
      (x) =>
        x.status !== 'closed' &&
        (x.criticality === 'high' || (daysFromToday(x.neededBy) ?? 9999) < 0),
    )
    .slice(0, 6)

  function setWeek(i: number, value: string) {
    update((d) => {
      const arr = [...(d.weeklyFocus[thisWeek] ?? ['', '', ''])]
      while (arr.length < 3) arr.push('')
      arr[i] = value
      d.weeklyFocus[thisWeek] = arr
    })
  }

  function setWeekNote(i: number, value: string) {
    update((d) => {
      const arr = [...(d.weeklyFocusNotes[thisWeek] ?? ['', '', ''])]
      while (arr.length < 3) arr.push('')
      arr[i] = value
      d.weeklyFocusNotes[thisWeek] = arr
    })
  }

  const weekArr = data.weeklyFocus[thisWeek] ?? ['', '', '']
  const week = [weekArr[0] ?? '', weekArr[1] ?? '', weekArr[2] ?? '']
  const weekNotesArr = data.weeklyFocusNotes[thisWeek] ?? ['', '', '']

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

      {/* Quadro completo — niente si perde */}
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius)] border bg-[var(--color-surface)] px-4 py-2.5">
        <span className="text-xs font-semibold">Quadro completo</span>
        {allClear ? (
          <span className="text-sm text-[var(--color-success)]">
            Tutto sotto controllo 🎯
          </span>
        ) : (
          overview
            .filter((o) => o.value > 0)
            .map((o) => (
              <button
                key={o.label}
                onClick={() => onNavigate?.(o.tab)}
                className="group inline-flex items-baseline gap-1.5 text-sm hover:underline"
                title="Vai alla sezione"
              >
                <span
                  className="text-lg font-semibold tabular-nums"
                  style={{ color: o.color }}
                >
                  {o.value}
                </span>
                <span className="text-[var(--color-muted)] group-hover:text-[var(--color-fg)]">
                  {o.label}
                </span>
              </button>
            ))
        )}
      </div>

      {focusCards.length > 0 && (
        <Card className="mb-5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <IconBoard width={16} height={16} />
            <h3 className="text-sm font-semibold">Su cosa lavoro adesso</h3>
            <span className="text-xs text-[var(--color-muted)]">
              in corso e in scadenza
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {focusCards.map((c) => {
              const d = daysFromToday(c.due)
              const overdue = d !== null && d < 0
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] border px-3 py-2"
                >
                  <button
                    onClick={() => completeCard(c.id)}
                    title="Segna come fatto"
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-md border text-transparent transition-colors hover:border-[var(--color-success)] hover:text-[var(--color-success)]"
                  >
                    <IconCheck width={13} height={13} />
                  </button>
                  <span className="flex-1 truncate text-sm">{c.title}</span>
                  <Badge
                    color={
                      c.column === 'blocked'
                        ? 'danger'
                        : c.column === 'doing'
                          ? 'primary'
                          : 'neutral'
                    }
                  >
                    {KANBAN_COLUMNS.find((k) => k.key === c.column)?.label}
                  </Badge>
                  {c.due && (
                    <Badge color={overdue ? 'danger' : 'warning'}>
                      {relativeDays(c.due)}
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

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
                  note={topNotes[i] ?? ''}
                  onNoteChange={(v) => setTopNote(i, v)}
                />
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-sm font-semibold">Diario di oggi</h3>
              <span className="text-xs text-[var(--color-muted)]">
                {activities.filter((a) => a.status === 'done').length}/
                {activities.length} fatte
              </span>
              {activities.length === 0 && carryActs.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={carryActivities}
                >
                  ↩ Riporta {carryActs.length} non finite
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={actText}
                onChange={(e) => setActText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addActivity()}
                onPaste={(e) => {
                  const text = e.clipboardData.getData('text')
                  if (/\r?\n/.test(text.trim())) {
                    e.preventDefault()
                    addActivityLines(text)
                  }
                }}
                placeholder="Aggiungi una richiesta… (incolla più righe per aggiungerne tante)"
                className="h-9 flex-1 rounded-[calc(var(--radius)-0.25rem)] border bg-[var(--color-bg)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
              />
              <Button variant="primary" onClick={addActivity}>
                <IconPlus /> Aggiungi
              </Button>
            </div>
            <div className="mt-3 space-y-1.5">
              {activities.length === 0 && (
                <p className="py-2 text-center text-xs text-[var(--color-muted)]">
                  Nessuna attività ancora. Registrale man mano che lavori: a fine
                  giornata diventano il tuo standup.
                </p>
              )}
              {activities.map((a) => (
                <div
                  key={a.id}
                  className="group rounded-[calc(var(--radius)-0.25rem)] border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => cycleActivity(a.id)}
                      title="Stato: da fare → in corso → fatto"
                      className={
                        'grid h-5 w-5 shrink-0 place-items-center rounded-md border ' +
                        (a.status === 'done'
                          ? 'border-[var(--color-success)] bg-[var(--color-success)] text-white'
                          : a.status === 'doing'
                            ? 'border-[var(--color-warning)]'
                            : 'border-[var(--color-border)]')
                      }
                    >
                      {a.status === 'done' ? (
                        <IconCheck width={13} height={13} />
                      ) : a.status === 'doing' ? (
                        <span className="h-2 w-2 rounded-full bg-[var(--color-warning)]" />
                      ) : null}
                    </button>
                    <input
                      value={a.text}
                      onChange={(e) => setActivityText(a.id, e.target.value)}
                      className={
                        'flex-1 bg-transparent text-sm outline-none ' +
                        (a.status === 'done'
                          ? 'text-[var(--color-muted)] line-through'
                          : '')
                      }
                    />
                    {a.source === 'art-sync' && (
                      <Badge color="primary" className="shrink-0">
                        ART Sync
                      </Badge>
                    )}
                    {a.source === 'inbox' && (
                      <Badge color="neutral" className="shrink-0">
                        Inbox
                      </Badge>
                    )}
                    {(a.carryCount ?? 0) > 0 && (
                      <Badge color={(a.carryCount ?? 0) >= 2 ? 'danger' : 'warning'}>
                        {(a.carryCount ?? 0) + 1}° giorno
                      </Badge>
                    )}
                    <StreamPicker
                      streamId={a.streamId}
                      streams={data.streams}
                      onPick={(id) =>
                        update((d) => {
                          const x = (d.dailyActivities[today] ?? []).find(
                            (y) => y.id === a.id,
                          )
                          if (x) x.streamId = id
                        })
                      }
                      compact
                    />
                    <AssigneePicker
                      owner={a.owner}
                      people={data.people}
                      onAssign={(name) => assignActivity(a.id, name)}
                    />
                    <span className="shrink-0 text-[11px] text-[var(--color-muted)]">
                      {fmtTime(a.createdAt)}
                    </span>
                    <RowMenu
                      items={[
                        {
                          label: '↑ Priorità del giorno',
                          onClick: () => promoteToPriority(a.text),
                        },
                        {
                          label: '→ Card Kanban',
                          onClick: () => activityToKanban(a),
                        },
                        {
                          label: '→ Riporta in ART Sync (domani)',
                          onClick: () => activityToArtSync(a),
                        },
                        {
                          label: '→ Sposta a domani',
                          onClick: () => moveActivityToTomorrow(a),
                        },
                        {
                          label: 'Elimina',
                          onClick: () => removeActivity(a.id),
                          danger: true,
                        },
                      ]}
                    />
                  </div>
                  <input
                    value={a.note ?? ''}
                    onChange={(e) => setActivityNote(a.id, e.target.value)}
                    placeholder="+ nota"
                    className="ml-7 w-[calc(100%-1.75rem)] bg-transparent py-0.5 text-xs text-[var(--color-muted)] outline-none placeholder:text-[var(--color-muted)]/50 focus:text-[var(--color-fg)]"
                  />
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
                  note={weekNotesArr[i] ?? ''}
                  onNoteChange={(v) => setWeekNote(i, v)}
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

          {hotDeps.length > 0 && (
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <IconLink width={16} height={16} />
                <h3 className="text-sm font-semibold">Dipendenze critiche</h3>
              </div>
              <div className="space-y-2">
                {hotDeps.map((x) => {
                  const dd = daysFromToday(x.neededBy)
                  const overdue = dd !== null && dd < 0
                  return (
                    <div key={x.id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm">{x.title}</span>
                      <Badge color={overdue ? 'danger' : 'warning'}>
                        {x.neededBy ? relativeDays(x.neededBy) : x.party || 'critica'}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <IconActivity width={16} height={16} />
              <h3 className="text-sm font-semibold">Andamento settimana</h3>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span>Attività chiuse</span>
                <span className="font-semibold tabular-nums">
                  {trend.doneThis}
                  <span className="ml-1 text-xs font-normal text-[var(--color-muted)]">
                    (scorsa: {trend.doneLast})
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Attività riportate</span>
                <span
                  className={
                    'font-semibold tabular-nums ' +
                    (trend.carriesThis >= 3 ? 'text-[var(--color-danger)]' : '')
                  }
                >
                  {trend.carriesThis}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Card Kanban chiuse</span>
                <span className="font-semibold tabular-nums">{trend.kanbanDone}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Dipendenze chiuse</span>
                <span className="font-semibold tabular-nums">{trend.depsClosed}</span>
              </div>
            </div>
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
  note,
  onNoteChange,
}: {
  index: number
  value: string
  onChange: (v: string) => void
  subtle?: boolean
  done?: boolean
  onToggleDone?: () => void
  note?: string
  onNoteChange?: (v: string) => void
}) {
  const badgeClass =
    'grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors ' +
    (done
      ? 'bg-[var(--color-success)] text-white'
      : subtle
        ? 'bg-[var(--color-surface-2)] text-[var(--color-muted)]'
        : 'bg-[color-mix(in_oklch,var(--color-primary)_15%,transparent)] text-[var(--color-primary)]')

  return (
    <div>
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
      {onNoteChange && (
        <input
          value={note ?? ''}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="+ nota"
          className="ml-9 w-[calc(100%-2.25rem)] bg-transparent py-0.5 text-xs text-[var(--color-muted)] outline-none placeholder:text-[var(--color-muted)]/50 focus:text-[var(--color-fg)]"
        />
      )}
    </div>
  )
}

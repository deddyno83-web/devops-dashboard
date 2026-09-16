import { useState } from 'react'
import { useStore } from '../store'
import {
  type InboxItem,
  type InboxSource,
  type InboxStage,
  type Raci,
  INBOX_SOURCES,
  INBOX_STAGES,
  raciIsEmpty,
} from '../types'
import {
  Button,
  Card,
  Badge,
  Select,
  Textarea,
  EmptyState,
  PageHeader,
} from '../components/ui'
import { IconPlus, IconTrash, IconInbox, IconWarn } from '../components/icons'
import { RowMenu, AssigneePicker } from '../components/RowMenu'
import { StreamPicker, StreamChip } from '../components/Stream'
import { RaciChip, RaciModal } from '../components/RaciEditor'
import { uid, nowISO, todayISO, fmtDate, ageInDays, cn } from '../lib/utils'
import { sectionForStream } from '../lib/sync'
import { GuideButton } from '../components/Guide'

const SOURCE_COLOR: Record<InboxSource, any> = {
  mail: 'primary',
  meeting: 'warning',
  sync: 'danger',
  chat: 'neutral',
  idea: 'success',
}
const STAGE_COLOR: Record<InboxStage, string> = {
  new: 'var(--color-danger)',
  seen: 'var(--color-warning)',
  progress: 'var(--color-primary)',
  done: 'var(--color-success)',
}
const STAGE_ORDER: InboxStage[] = ['new', 'seen', 'progress', 'done']
/** Days an item may sit in "Nuove" before the app flags the wait. */
const WAIT_DAYS = 3

export default function InboxView() {
  const { data, update } = useStore()
  const [tab, setTab] = useState<'queue' | 'raci'>('queue')
  const [text, setText] = useState('')
  const [source, setSource] = useState<InboxSource>('mail')
  const [streamId, setStreamId] = useState<string | undefined>()
  const [urgentNew, setUrgentNew] = useState(false)
  const [fStage, setFStage] = useState<InboxStage | 'open' | 'all'>('open')
  const [fStream, setFStream] = useState('')
  const [raciFor, setRaciFor] = useState<InboxItem | null>(null)

  const stageOf = (i: InboxItem): InboxStage =>
    i.stage ?? (i.triagedAt ? 'done' : 'new')
  const isOpen = (i: InboxItem) => stageOf(i) !== 'done'
  const waiting = (i: InboxItem) =>
    stageOf(i) === 'new' && ageInDays(i.createdAt) >= WAIT_DAYS

  const openItems = data.inbox.filter(isOpen)
  const counts = Object.fromEntries(
    STAGE_ORDER.map((s) => [s, data.inbox.filter((i) => stageOf(i) === s).length]),
  ) as Record<InboxStage, number>

  const visible = data.inbox
    .filter((i) => {
      if (fStage === 'open' && !isOpen(i)) return false
      if (fStage !== 'open' && fStage !== 'all' && stageOf(i) !== fStage) return false
      if (fStream && i.streamId !== fStream) return false
      return true
    })
    .sort((a, b) => {
      if (!!a.urgent !== !!b.urgent) return a.urgent ? -1 : 1
      const sa = STAGE_ORDER.indexOf(stageOf(a))
      const sb = STAGE_ORDER.indexOf(stageOf(b))
      if (sa !== sb) return sa - sb
      return b.createdAt.localeCompare(a.createdAt)
    })

  function addLines(raw: string) {
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.replace(/^[\s\-*•\d.)]+/, '').trim())
      .filter(Boolean)
    if (lines.length === 0) return
    update((d) => {
      lines.forEach((l) =>
        d.inbox.unshift({
          id: uid(),
          text: l,
          source,
          streamId,
          stage: 'new',
          urgent: urgentNew || undefined,
          createdAt: nowISO(),
        }),
      )
    })
    setText('')
    setUrgentNew(false)
  }

  function patch(id: string, p: Partial<InboxItem>) {
    update((d) => {
      const it = d.inbox.find((x) => x.id === id)
      if (it) Object.assign(it, p)
    })
  }

  function setStage(it: InboxItem, stage: InboxStage) {
    patch(it.id, {
      stage,
      triagedAt: stage === 'done' ? (it.triagedAt ?? nowISO()) : undefined,
      outcome: stage === 'done' ? (it.outcome ?? 'Chiusa') : undefined,
    })
  }

  function remove(id: string) {
    update((d) => {
      d.inbox = d.inbox.filter((x) => x.id !== id)
    })
  }

  /* ------------------------- triage destinations ------------------------- */
  const close = (d: any, id: string, outcome: string) => {
    const x = d.inbox.find((y: InboxItem) => y.id === id)
    if (x) {
      x.stage = 'done'
      x.triagedAt = nowISO()
      x.outcome = outcome
    }
  }

  function toActivity(it: InboxItem) {
    const today = todayISO()
    update((d) => {
      const arr = [...(d.dailyActivities[today] ?? [])]
      arr.push({
        id: uid(),
        text: it.text,
        status: 'todo',
        note: it.note,
        owner: it.owner,
        streamId: it.streamId,
        source: 'inbox',
        raci: it.raci,
        createdAt: nowISO(),
      })
      d.dailyActivities[today] = arr
      close(d, it.id, 'Attività di oggi')
    })
  }

  function toKanban(it: InboxItem) {
    update((d) => {
      d.kanban.unshift({
        id: uid(),
        title: it.text,
        notes:
          [it.note, it.owner ? `Assegnata a: ${it.owner}` : '']
            .filter(Boolean)
            .join('\n') || undefined,
        column: 'todo',
        priority: it.urgent ? 'high' : 'med',
        tag: d.streams.find((s) => s.id === it.streamId)?.name,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      })
      close(d, it.id, 'Card Kanban')
    })
  }

  function toTicket(it: InboxItem) {
    update((d) => {
      const stream = d.streams.find((s) => s.id === it.streamId)
      d.dependencies.unshift({
        id: uid(),
        title: it.text,
        party: stream?.name ?? '',
        streamId: it.streamId,
        type: 'ticket',
        status: 'open',
        criticality: it.urgent ? 'high' : 'med',
        notes: it.note,
        origin: 'ours',
        lastUpdate: nowISO(),
        createdAt: nowISO(),
      })
      close(d, it.id, 'Ticket')
    })
  }

  function toDelegated(it: InboxItem) {
    update((d) => {
      d.actions.unshift({
        id: uid(),
        title: it.text,
        owner: it.owner,
        status: 'todo',
        priority: it.urgent ? 'high' : 'med',
        streamId: it.streamId,
        createdAt: nowISO(),
      })
      close(d, it.id, it.owner ? `Delegata a ${it.owner}` : 'Action item')
    })
  }

  function toRoadmap(it: InboxItem) {
    update((d) => {
      d.roadmap.push({
        id: uid(),
        title: it.text,
        description: it.note,
        area: d.streams.find((s) => s.id === it.streamId)?.name,
        horizon: 'next',
        status: 'planned',
        createdAt: nowISO(),
        updatedAt: nowISO(),
      })
      close(d, it.id, 'Roadmap')
    })
  }

  function toArtSync(it: InboxItem) {
    const tmr = (() => {
      const d0 = new Date(todayISO() + 'T00:00:00')
      d0.setDate(d0.getDate() + 1)
      const tz = d0.getTimezoneOffset() * 60000
      return new Date(d0.getTime() - tz).toISOString().slice(0, 10)
    })()
    update((d) => {
      if (!d.artSyncs[tmr])
        d.artSyncs[tmr] = { date: tmr, points: [], actions: [], createdAt: nowISO() }
      d.artSyncs[tmr].points.push({
        id: uid(),
        category: 'progress',
        sectionId: sectionForStream(d, it.streamId),
        text: it.text,
        note: it.note,
        reported: false,
      })
      close(d, it.id, 'Portata in ART Sync')
    })
  }

  const urgentOpen = openItems.filter((i) => i.urgent).length
  const waitingOpen = openItems.filter(waiting).length

  return (
    <div>
      <PageHeader
        title="Attività in ingresso"
        subtitle="Quello che ti arriva e devi gestire: entra, lo vedi, ci lavori, lo chiudi. Niente resta fuori dal radar."
        actions={
          <>
            <GuideButton section="inbox" />
            {urgentOpen > 0 && (
              <Badge color="danger">
                <IconWarn width={11} height={11} /> {urgentOpen} urgenti
              </Badge>
            )}
            <Badge color={openItems.length > 0 ? 'warning' : 'success'}>
              {openItems.length === 0 ? 'Coda vuota 🎯' : `${openItems.length} aperte`}
            </Badge>
          </>
        }
      />

      <div className="mb-4 inline-flex rounded-[calc(var(--radius)-0.2rem)] border bg-[var(--color-surface-2)]/50 p-1 text-sm">
        {(['queue', 'raci'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-[calc(var(--radius)-0.35rem)] px-3 py-1.5 font-medium transition-colors',
              tab === t
                ? 'bg-[var(--color-surface)] shadow-sm'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]',
            )}
          >
            {t === 'queue' ? 'Coda' : 'RACI'}
          </button>
        ))}
      </div>

      {tab === 'raci' ? (
        <RaciBoard onOpen={(it) => setRaciFor(it)} />
      ) : (
        <>
          {/* Intake */}
          <Card className="mb-5 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-muted)]">
                Fonte:
              </span>
              <Select
                value={source}
                onChange={(e) => setSource(e.target.value as InboxSource)}
                className="h-8"
              >
                {INBOX_SOURCES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </Select>
              <StreamPicker
                streamId={streamId}
                streams={data.streams}
                onPick={setStreamId}
              />
              <Button
                size="sm"
                variant={urgentNew ? 'primary' : 'outline'}
                onClick={() => setUrgentNew((v) => !v)}
                title="Segna come urgente ciò che aggiungi"
              >
                <IconWarn width={14} height={14} /> Urgente
              </Button>
              <span className="text-[11px] text-[var(--color-muted)]">
                incolla una mail o un blocco: una riga = un'attività
              </span>
            </div>
            <div className="flex gap-2">
              <Textarea
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addLines(text)
                }}
                placeholder="Incolla qui… (Ctrl+Invio per aggiungere)"
              />
              <Button
                variant="primary"
                onClick={() => addLines(text)}
                className="self-end"
              >
                <IconPlus /> Aggiungi
              </Button>
            </div>
          </Card>

          {/* Queue filters */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setFStage('open')}
              className={cn(
                'rounded-full border px-2.5 py-1',
                fStage === 'open'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]',
              )}
            >
              Aperte ({openItems.length})
            </button>
            {INBOX_STAGES.map((s) => (
              <button
                key={s.key}
                onClick={() => setFStage(s.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
                  fStage === s.key
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]',
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: STAGE_COLOR[s.key] }}
                />
                {s.label} ({counts[s.key] ?? 0})
              </button>
            ))}
            {data.streams.length > 0 && (
              <Select
                value={fStream}
                onChange={(e) => setFStream(e.target.value)}
                className="ml-auto h-8"
              >
                <option value="">Tutti gli stream</option>
                {data.streams.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {waitingOpen > 0 && fStage !== 'done' && (
            <p className="mb-3 text-xs text-[var(--color-warning)]">
              ⚠ {waitingOpen} {waitingOpen === 1 ? 'attività ferma' : 'attività ferme'} in
              «Nuove» da {WAIT_DAYS}+ giorni.
            </p>
          )}

          {visible.length === 0 ? (
            <EmptyState
              icon={<IconInbox width={28} height={28} />}
              title={openItems.length === 0 ? 'Coda vuota' : 'Nessun risultato'}
              hint={
                openItems.length === 0
                  ? 'Tutto gestito. Quando arriva una mail o esce qualcosa da un meeting, incollala qui sopra: nessuna richiesta si perde.'
                  : 'Nessuna attività con questi filtri.'
              }
            />
          ) : (
            <div className="space-y-2">
              {visible.map((it) => {
                const stage = stageOf(it)
                const age = ageInDays(it.createdAt)
                return (
                  <Card
                    key={it.id}
                    className={cn('p-3', it.urgent && 'border-[var(--color-danger)]')}
                    >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="h-6 w-1 shrink-0 rounded-full"
                        style={{ background: STAGE_COLOR[stage] }}
                      />
                      <button
                        onClick={() => patch(it.id, { urgent: !it.urgent })}
                        title={it.urgent ? 'Togli urgenza' : 'Segna urgente'}
                        className={cn(
                          'grid h-6 w-6 shrink-0 place-items-center rounded-md border',
                          it.urgent
                            ? 'border-[var(--color-danger)] bg-[var(--color-danger)] text-white'
                            : 'text-[var(--color-muted)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]',
                        )}
                      >
                        <IconWarn width={13} height={13} />
                      </button>
                      <Badge color={SOURCE_COLOR[it.source]}>
                        {INBOX_SOURCES.find((s) => s.key === it.source)?.label}
                      </Badge>
                      <input
                        value={it.text}
                        onChange={(e) => patch(it.id, { text: e.target.value })}
                        className={cn(
                          'min-w-[160px] flex-1 bg-transparent text-sm outline-none',
                          stage === 'done' && 'text-[var(--color-muted)] line-through',
                        )}
                      />
                      {it.urgent && <Badge color="danger">URGENTE</Badge>}
                      {waiting(it) && <Badge color="warning">ferma da {age}g</Badge>}
                      <StreamPicker
                        streamId={it.streamId}
                        streams={data.streams}
                        onPick={(id) => patch(it.id, { streamId: id })}
                        compact
                      />
                      <RaciChip raci={it.raci} onClick={() => setRaciFor(it)} />
                      <AssigneePicker
                        owner={it.owner}
                        people={data.people}
                        onAssign={(name) => patch(it.id, { owner: name })}
                      />
                      <Select
                        value={stage}
                        onChange={(e) => setStage(it, e.target.value as InboxStage)}
                        className="h-8"
                        title="Avanzamento in coda"
                      >
                        {INBOX_STAGES.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </Select>
                      <RowMenu
                        items={[
                          { label: '→ Attività di oggi', onClick: () => toActivity(it) },
                          { label: '→ Card Kanban', onClick: () => toKanban(it) },
                          { label: '→ Ticket esterno', onClick: () => toTicket(it) },
                          {
                            label: it.owner
                              ? `→ Action item (${it.owner})`
                              : '→ Action item',
                            onClick: () => toDelegated(it),
                          },
                          { label: '→ Porta in ART Sync', onClick: () => toArtSync(it) },
                          { label: '→ Roadmap', onClick: () => toRoadmap(it) },
                          { label: 'Definisci RACI', onClick: () => setRaciFor(it) },
                          { label: 'Elimina', onClick: () => remove(it.id), danger: true },
                        ]}
                      />
                    </div>
                    <div className="mt-1 flex items-center gap-2 pl-3">
                      <input
                        value={it.note ?? ''}
                        onChange={(e) => patch(it.id, { note: e.target.value })}
                        placeholder="+ nota / contesto"
                        className="flex-1 bg-transparent text-xs text-[var(--color-muted)] outline-none placeholder:text-[var(--color-muted)]/50 focus:text-[var(--color-fg)]"
                      />
                      {it.outcome && (
                        <Badge color="neutral">{it.outcome}</Badge>
                      )}
                      <span className="shrink-0 text-[11px] text-[var(--color-muted)]">
                        {fmtDate(it.createdAt.slice(0, 10))}
                      </span>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      <RaciModal
        open={raciFor !== null}
        onClose={() => setRaciFor(null)}
        title={raciFor?.text ?? ''}
        raci={raciFor?.raci}
        people={data.people}
        onChange={(r: Raci) => {
          if (!raciFor) return
          patch(raciFor.id, { raci: r })
          setRaciFor({ ...raciFor, raci: r })
        }}
      />
    </div>
  )
}

/** Monitoring view: every incoming activity that has a RACI defined. */
function RaciBoard({ onOpen }: { onOpen: (it: InboxItem) => void }) {
  const { data } = useStore()
  const withRaci = data.inbox.filter((i) => !raciIsEmpty(i.raci))

  if (withRaci.length === 0) {
    return (
      <EmptyState
        title="Nessuna RACI definita"
        hint="Apri il menu ⋯ di un'attività e scegli «Definisci RACI» (o clicca le lettere R A C I sulla riga) per stabilire chi esegue, chi è responsabile finale, chi va consultato e chi informato."
      />
    )
  }

  const cell = (v?: string[] | string) => {
    const list = Array.isArray(v) ? v : v ? [v] : []
    return list.length ? list.join(', ') : '—'
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[var(--color-surface-2)]/60">
            <th className="px-3 py-2 text-left font-medium">Attività</th>
            <th className="px-3 py-2 text-left font-medium">
              <span className="text-[var(--color-primary)]">R</span> esponsible
            </th>
            <th className="px-3 py-2 text-left font-medium">
              <span className="text-[var(--color-danger)]">A</span> ccountable
            </th>
            <th className="px-3 py-2 text-left font-medium">
              <span className="text-[var(--color-warning)]">C</span> onsulted
            </th>
            <th className="px-3 py-2 text-left font-medium">
              <span className="text-[var(--color-muted)]">I</span> nformed
            </th>
          </tr>
        </thead>
        <tbody>
          {withRaci.map((i) => {
            const stream = data.streams.find((s) => s.id === i.streamId)
            const stage = i.stage ?? (i.triagedAt ? 'done' : 'new')
            return (
              <tr
                key={i.id}
                className="cursor-pointer border-t hover:bg-[var(--color-surface-2)]/40"
                onClick={() => onOpen(i)}
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: STAGE_COLOR[stage] }}
                    />
                    <span className={cn(stage === 'done' && 'line-through opacity-60')}>
                      {i.text}
                    </span>
                    {i.urgent && <Badge color="danger">URGENTE</Badge>}
                    <StreamChip stream={stream} />
                  </div>
                </td>
                <td className="px-3 py-2 text-[var(--color-muted)]">
                  {cell(i.raci?.responsible)}
                </td>
                <td className="px-3 py-2 font-medium">{cell(i.raci?.accountable)}</td>
                <td className="px-3 py-2 text-[var(--color-muted)]">
                  {cell(i.raci?.consulted)}
                </td>
                <td className="px-3 py-2 text-[var(--color-muted)]">
                  {cell(i.raci?.informed)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

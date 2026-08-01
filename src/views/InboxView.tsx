import { useState } from 'react'
import { useStore } from '../store'
import {
  type InboxItem,
  type InboxSource,
  INBOX_SOURCES,
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
import { IconPlus, IconTrash, IconInbox, IconCheck } from '../components/icons'
import { RowMenu, AssigneePicker } from '../components/RowMenu'
import { StreamPicker } from '../components/Stream'
import { uid, nowISO, todayISO, fmtDate, fmtTime, cn } from '../lib/utils'
import { sectionForStream } from '../lib/sync'
import { GuideButton } from '../components/Guide'

const SOURCE_COLOR: Record<InboxSource, any> = {
  mail: 'primary',
  meeting: 'warning',
  sync: 'danger',
  chat: 'neutral',
  idea: 'success',
}

export default function InboxView() {
  const { data, update } = useStore()
  const [text, setText] = useState('')
  const [source, setSource] = useState<InboxSource>('mail')
  const [streamId, setStreamId] = useState<string | undefined>()
  const [showDone, setShowDone] = useState(false)
  const [filterStream, setFilterStream] = useState('')

  const pending = data.inbox.filter((i) => !i.triagedAt)
  const triaged = data.inbox.filter((i) => i.triagedAt)
  const visible = filterStream
    ? pending.filter((i) => i.streamId === filterStream)
    : pending

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
          createdAt: nowISO(),
        }),
      )
    })
    setText('')
  }

  function patch(id: string, p: Partial<InboxItem>) {
    update((d) => {
      const it = d.inbox.find((x) => x.id === id)
      if (it) Object.assign(it, p)
    })
  }

  function remove(id: string) {
    update((d) => {
      d.inbox = d.inbox.filter((x) => x.id !== id)
    })
  }

  const markTriaged = (id: string, outcome: string) =>
    patch(id, { triagedAt: nowISO(), outcome })

  /* ------------------------- triage destinations ------------------------- */
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
        createdAt: nowISO(),
      })
      d.dailyActivities[today] = arr
      const x = d.inbox.find((y) => y.id === it.id)
      if (x) {
        x.triagedAt = nowISO()
        x.outcome = 'Attività di oggi'
      }
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
        priority: 'med',
        tag: d.streams.find((s) => s.id === it.streamId)?.name,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      })
      const x = d.inbox.find((y) => y.id === it.id)
      if (x) {
        x.triagedAt = nowISO()
        x.outcome = 'Card Kanban'
      }
    })
  }

  function toDependency(it: InboxItem) {
    update((d) => {
      const stream = d.streams.find((s) => s.id === it.streamId)
      d.dependencies.unshift({
        id: uid(),
        title: it.text,
        party: stream?.name ?? '',
        streamId: it.streamId,
        type: 'ticket',
        status: 'open',
        criticality: 'med',
        notes: it.note,
        lastUpdate: nowISO(),
        createdAt: nowISO(),
      })
      const x = d.inbox.find((y) => y.id === it.id)
      if (x) {
        x.triagedAt = nowISO()
        x.outcome = 'Dipendenza'
      }
    })
  }

  function toDelegated(it: InboxItem) {
    update((d) => {
      d.actions.unshift({
        id: uid(),
        title: it.text,
        owner: it.owner,
        status: 'todo',
        priority: 'med',
        streamId: it.streamId,
        createdAt: nowISO(),
      })
      const x = d.inbox.find((y) => y.id === it.id)
      if (x) {
        x.triagedAt = nowISO()
        x.outcome = it.owner ? `Delegata a ${it.owner}` : 'Action item'
      }
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
      const x = d.inbox.find((y) => y.id === it.id)
      if (x) {
        x.triagedAt = nowISO()
        x.outcome = 'Roadmap'
      }
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
      const x = d.inbox.find((y) => y.id === it.id)
      if (x) {
        x.triagedAt = nowISO()
        x.outcome = 'Portata in ART Sync'
      }
    })
  }

  return (
    <div>
      <PageHeader
        title="Inbox"
        subtitle="Dove atterra tutto ciò che arriva: mail, note di meeting, richieste. Smista e non perdi niente."
        actions={
          <>
            <GuideButton section="inbox" />
            <Badge color={pending.length > 0 ? 'warning' : 'success'}>
              {pending.length === 0 ? 'Inbox vuota 🎯' : `${pending.length} da smistare`}
            </Badge>
            {pending.some((i) => i.owner) && (
              <Badge color="primary">
                {pending.filter((i) => i.owner).length} assegnate
              </Badge>
            )}
          </>
        }
      />

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
          <span className="text-[11px] text-[var(--color-muted)]">
            incolla una mail o un blocco: una riga = un item
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
          <Button variant="primary" onClick={() => addLines(text)} className="self-end">
            <IconPlus /> Aggiungi
          </Button>
        </div>
      </Card>

      {/* Filter */}
      {data.streams.length > 0 && pending.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={() => setFilterStream('')}
            className={cn(
              'rounded-full border px-2 py-0.5',
              !filterStream
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]',
            )}
          >
            Tutti
          </button>
          {data.streams.map((s) => {
            const n = pending.filter((i) => i.streamId === s.id).length
            if (n === 0) return null
            return (
              <button
                key={s.id}
                onClick={() => setFilterStream(s.id)}
                className={cn(
                  'rounded-full border px-2 py-0.5',
                  filterStream === s.id
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]',
                )}
              >
                {s.name} ({n})
              </button>
            )
          })}
        </div>
      )}

      {/* Pending */}
      {pending.length === 0 ? (
        <EmptyState
          icon={<IconInbox width={28} height={28} />}
          title="Inbox vuota"
          hint="Tutto smistato. Quando arriva una mail o esce qualcosa da un meeting, incollala qui sopra: nessuna richiesta si perde."
        />
      ) : (
        <div className="space-y-2">
          {visible.map((it) => (
            <Card key={it.id} className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={SOURCE_COLOR[it.source]}>
                  {INBOX_SOURCES.find((s) => s.key === it.source)?.label}
                </Badge>
                <input
                  value={it.text}
                  onChange={(e) => patch(it.id, { text: e.target.value })}
                  className="min-w-[160px] flex-1 bg-transparent text-sm outline-none"
                />
                <StreamPicker
                  streamId={it.streamId}
                  streams={data.streams}
                  onPick={(id) => patch(it.id, { streamId: id })}
                />
                <span className="text-[11px] text-[var(--color-muted)]">
                  {fmtDate(it.createdAt.slice(0, 10))} {fmtTime(it.createdAt)}
                </span>
                <AssigneePicker
                  owner={it.owner}
                  people={data.people}
                  onAssign={(name) => patch(it.id, { owner: name })}
                />
                <RowMenu
                  items={[
                    { label: '→ Attività di oggi', onClick: () => toActivity(it) },
                    { label: '→ Card Kanban', onClick: () => toKanban(it) },
                    { label: '→ Dipendenza esterna', onClick: () => toDependency(it) },
                    {
                      label: it.owner
                        ? `→ Action item (${it.owner})`
                        : '→ Action item',
                      onClick: () => toDelegated(it),
                    },
                    { label: '→ Porta in ART Sync', onClick: () => toArtSync(it) },
                    { label: '→ Roadmap', onClick: () => toRoadmap(it) },
                    {
                      label: 'Archivia (nessuna azione)',
                      onClick: () => markTriaged(it.id, 'Archiviata'),
                    },
                    { label: 'Elimina', onClick: () => remove(it.id), danger: true },
                  ]}
                />
              </div>
              <input
                value={it.note ?? ''}
                onChange={(e) => patch(it.id, { note: e.target.value })}
                placeholder="+ nota / contesto"
                className="mt-1 w-full bg-transparent text-xs text-[var(--color-muted)] outline-none placeholder:text-[var(--color-muted)]/50 focus:text-[var(--color-fg)]"
              />
            </Card>
          ))}
        </div>
      )}

      {/* Triaged history */}
      {triaged.length > 0 && (
        <div className="mt-5">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            {showDone ? '▾' : '▸'} Smistate ({triaged.length})
          </button>
          {showDone && (
            <div className="mt-2 space-y-1">
              {triaged.slice(0, 40).map((it) => (
                <div
                  key={it.id}
                  className="group flex items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] border px-3 py-1.5 text-sm opacity-60"
                >
                  <IconCheck width={13} height={13} className="text-[var(--color-success)]" />
                  <span className="flex-1 truncate">{it.text}</span>
                  <Badge color="neutral">{it.outcome}</Badge>
                  <button
                    onClick={() => remove(it.id)}
                    className="text-[var(--color-muted)] opacity-0 transition-opacity hover:text-[var(--color-danger)] group-hover:opacity-100"
                  >
                    <IconTrash width={14} height={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

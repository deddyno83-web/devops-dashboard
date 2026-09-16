import { useState } from 'react'
import { useStore } from '../store'
import {
  type Dependency,
  type DependencyType,
  type DependencyStatus,
  type Criticality,
  DEP_TYPES,
  DEP_STATUSES,
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
import {
  IconPlus,
  IconTrash,
  IconLink,
  IconExternal,
  IconWarn,
  IconX,
} from '../components/icons'
import { StreamDot } from '../components/Stream'
import {
  uid,
  nowISO,
  fmtDate,
  relativeDays,
  ageInDays,
  daysFromToday,
  cn,
} from '../lib/utils'
import { GuideButton } from '../components/Guide'

const CRIT_META: Record<Criticality, { label: string; color: any; weight: number }> = {
  high: { label: 'Alta', color: 'danger', weight: 0 },
  med: { label: 'Media', color: 'warning', weight: 1 },
  low: { label: 'Bassa', color: 'neutral', weight: 2 },
}
const STATUS_COLOR: Record<DependencyStatus, string> = {
  open: 'var(--color-warning)',
  waiting: 'var(--color-muted)',
  chased: 'var(--color-primary)',
  unblocked: 'var(--color-success)',
  closed: 'var(--color-border)',
}
const STALE_DAYS = 5
const ESCALATE_AFTER = 3

const emptyDraft = (streamId?: string): Partial<Dependency> => ({
  title: '',
  party: '',
  streamId,
  type: 'ticket',
  ref: '',
  link: '',
  status: 'open',
  neededBy: '',
  owner: '',
  blocks: '',
  criticality: 'med',
  notes: '',
  origin: 'ours',
})

export default function DependenciesView() {
  const { data, update } = useStore()
  const [draft, setDraft] = useState<Partial<Dependency> | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [fText, setFText] = useState('')
  const [fStream, setFStream] = useState('')
  const [fOrigin, setFOrigin] = useState<'all' | 'ours' | 'theirs'>('all')
  const [openOnly, setOpenOnly] = useState(true)
  const [quick, setQuick] = useState('')

  const tickets = data.dependencies
  const streamOf = (id?: string) => data.streams.find((s) => s.id === id)
  const originOf = (x: Dependency) => x.origin ?? 'ours'

  const isOpen = (x: Dependency) => x.status !== 'closed'
  const isStale = (x: Dependency) =>
    (x.status === 'open' || x.status === 'waiting') &&
    ageInDays(x.lastUpdate) >= STALE_DAYS
  const isOverdue = (x: Dependency) => {
    const dd = daysFromToday(x.neededBy)
    return x.status !== 'closed' && dd !== null && dd < 0
  }
  const needsEscalation = (x: Dependency) =>
    (x.chaseCount ?? 0) >= ESCALATE_AFTER &&
    x.status !== 'closed' &&
    x.status !== 'unblocked'

  /* ------------------------------- mutations ------------------------------ */
  function save() {
    if (!draft?.title?.trim()) return
    update((d) => {
      const party =
        draft.party?.trim() ||
        d.streams.find((s) => s.id === draft.streamId)?.name ||
        ''
      if (editId) {
        const x = d.dependencies.find((y) => y.id === editId)
        if (x) {
          Object.assign(x, draft, {
            title: draft.title!.trim(),
            party,
            ref: draft.ref?.trim() || undefined,
            link: draft.link?.trim() || undefined,
            neededBy: draft.neededBy || undefined,
            owner: draft.owner?.trim() || undefined,
            lastUpdate: nowISO(),
          })
        }
      } else {
        d.dependencies.unshift({
          id: uid(),
          title: draft.title!.trim(),
          party,
          streamId: draft.streamId,
          type: (draft.type as DependencyType) ?? 'ticket',
          ref: draft.ref?.trim() || undefined,
          link: draft.link?.trim() || undefined,
          status: (draft.status as DependencyStatus) ?? 'open',
          neededBy: draft.neededBy || undefined,
          owner: draft.owner?.trim() || undefined,
          blocks: draft.blocks?.trim() || undefined,
          criticality: (draft.criticality as Criticality) ?? 'med',
          notes: draft.notes?.trim() || undefined,
          origin: (draft.origin as 'ours' | 'theirs') ?? 'ours',
          lastUpdate: nowISO(),
          createdAt: nowISO(),
        })
      }
    })
    setDraft(null)
    setEditId(null)
  }

  function quickAdd() {
    const t = quick.trim()
    if (!t) return
    // "REF titolo" → ref staccato se il primo token sembra un codice ticket
    const m = t.match(/^([A-Z][A-Z0-9]*-?\d+)\s+(.*)$/)
    update((d) => {
      d.dependencies.unshift({
        id: uid(),
        title: m ? m[2] : t,
        ref: m ? m[1] : undefined,
        party: streamOf(fStream)?.name ?? '',
        streamId: fStream || undefined,
        type: 'ticket',
        status: 'open',
        criticality: 'med',
        origin: fOrigin === 'theirs' ? 'theirs' : 'ours',
        lastUpdate: nowISO(),
        createdAt: nowISO(),
      })
    })
    setQuick('')
  }

  function patchDep(id: string, patch: Partial<Dependency>) {
    update((d) => {
      const x = d.dependencies.find((y) => y.id === id)
      if (x) Object.assign(x, patch)
    })
  }
  function remove(id: string) {
    update((d) => {
      d.dependencies = d.dependencies.filter((x) => x.id !== id)
    })
    setDraft(null)
    setEditId(null)
  }
  function chase(id: string) {
    update((d) => {
      const x = d.dependencies.find((y) => y.id === id)
      if (x) {
        x.status = 'chased'
        x.chaseCount = (x.chaseCount ?? 0) + 1
        x.lastUpdate = nowISO()
      }
    })
  }

  /* --------------------- per-counterpart status summary ------------------- */
  type Health = 'critical' | 'attention' | 'ok' | 'idle'
  const HEALTH: Record<Health, { color: string; label: string }> = {
    critical: { color: 'var(--color-danger)', label: 'Da escalare' },
    attention: { color: 'var(--color-warning)', label: 'Da sollecitare' },
    ok: { color: 'var(--color-success)', label: 'Sotto controllo' },
    idle: { color: 'var(--color-border)', label: 'Nessun ticket' },
  }

  const summaries = data.streams.map((s) => {
    const mine = tickets.filter((x) => x.streamId === s.id)
    const open = mine.filter(isOpen)
    const overdue = open.filter(isOverdue).length
    const escalate = open.filter(needsEscalation).length
    const stale = open.filter(isStale).length
    const ours = open.filter((x) => originOf(x) === 'ours').length
    const theirs = open.filter((x) => originOf(x) === 'theirs').length
    const lastTouch = mine.map((x) => x.lastUpdate).sort().pop()
    const health: Health =
      overdue > 0 || escalate > 0
        ? 'critical'
        : stale > 0
          ? 'attention'
          : open.length > 0
            ? 'ok'
            : 'idle'
    return { stream: s, open: open.length, overdue, escalate, stale, ours, theirs, lastTouch, health }
  })

  const visible = tickets
    .filter((x) => {
      if (openOnly && !isOpen(x)) return false
      if (fStream && x.streamId !== fStream) return false
      if (fOrigin !== 'all' && originOf(x) !== fOrigin) return false
      if (
        fText &&
        !`${x.title} ${x.party} ${x.ref ?? ''} ${x.blocks ?? ''}`
          .toLowerCase()
          .includes(fText.toLowerCase())
      )
        return false
      return true
    })
    .sort((a, b) => {
      if (isOpen(a) !== isOpen(b)) return isOpen(a) ? -1 : 1
      const ua = isOverdue(a) || needsEscalation(a) ? 0 : isStale(a) ? 1 : 2
      const ub = isOverdue(b) || needsEscalation(b) ? 0 : isStale(b) ? 1 : 2
      if (ua !== ub) return ua - ub
      if (CRIT_META[a.criticality].weight !== CRIT_META[b.criticality].weight)
        return CRIT_META[a.criticality].weight - CRIT_META[b.criticality].weight
      return (daysFromToday(a.neededBy) ?? 9999) - (daysFromToday(b.neededBy) ?? 9999)
    })

  return (
    <div>
      <PageHeader
        title="Ticket"
        subtitle="I ticket che apri verso i team esterni (CCoE, RunOps…) e quelli che segui da loro: sempre sotto controllo."
        actions={
          <>
            <GuideButton section="dependencies" />
            <Button
              variant="primary"
              onClick={() => {
                setEditId(null)
                setDraft(emptyDraft(fStream || undefined))
              }}
            >
              <IconPlus /> Nuovo ticket
            </Button>
          </>
        }
      />

      {/* Stato per interlocutore */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {summaries.map((s) => {
          const active = fStream === s.stream.id
          const meta = HEALTH[s.health]
          return (
            <button
              key={s.stream.id}
              onClick={() => setFStream(active ? '' : s.stream.id)}
              className={cn(
                'rounded-[var(--radius)] border bg-[var(--color-surface)] p-3 text-left transition-shadow hover:shadow-md',
                active && 'ring-2 ring-[var(--color-primary)]',
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: meta.color }}
                />
                <span className="truncate text-sm font-semibold">{s.stream.name}</span>
                <span
                  className="ml-auto shrink-0 text-[10px] font-medium"
                  style={{ color: meta.color }}
                >
                  {meta.label}
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-2xl font-semibold tabular-nums">{s.open}</span>
                <span className="text-[11px] text-[var(--color-muted)]">
                  ticket aperti
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {s.overdue > 0 && <Badge color="danger">{s.overdue} scaduti</Badge>}
                {s.escalate > 0 && <Badge color="danger">{s.escalate} da escalare</Badge>}
                {s.stale > 0 && <Badge color="warning">{s.stale} da sollecitare</Badge>}
                {s.ours > 0 && <Badge color="primary">{s.ours} nostri</Badge>}
                {s.theirs > 0 && <Badge color="neutral">{s.theirs} loro</Badge>}
              </div>
              <p className="mt-2 text-[11px] text-[var(--color-muted)]">
                {s.lastTouch
                  ? `ultimo aggiornamento ${relativeDays(s.lastTouch.slice(0, 10))}`
                  : 'nessun ticket registrato'}
              </p>
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {fStream ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            <StreamDot stream={streamOf(fStream)} />
            {streamOf(fStream)?.name}
            <button
              onClick={() => setFStream('')}
              className="text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              title="Mostra tutti"
            >
              <IconX width={14} height={14} />
            </button>
          </span>
        ) : (
          <span className="text-sm font-medium text-[var(--color-muted)]">
            Tutti gli interlocutori
          </span>
        )}
        <Select
          value={fOrigin}
          onChange={(e) => setFOrigin(e.target.value as any)}
          className="h-8"
        >
          <option value="all">Tutti i ticket</option>
          <option value="ours">Aperti da noi</option>
          <option value="theirs">Dal loro backlog</option>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Input
            value={fText}
            onChange={(e) => setFText(e.target.value)}
            placeholder="Cerca (titolo, rif.)…"
            className="h-8 w-44"
          />
          <Button
            size="sm"
            variant={openOnly ? 'primary' : 'outline'}
            onClick={() => setOpenOnly((v) => !v)}
          >
            Solo aperti
          </Button>
        </div>
      </div>

      {/* Aggiunta rapida */}
      <div className="mb-4 flex gap-2">
        <Input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && quickAdd()}
          placeholder={
            fStream
              ? `Nuovo ticket per ${streamOf(fStream)?.name}… (es. "INC0012345 apertura firewall")`
              : 'Nuovo ticket… (seleziona prima un interlocutore per assegnarlo)'
          }
        />
        <Button variant="primary" onClick={quickAdd}>
          <IconPlus width={15} height={15} />
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<IconLink width={26} height={26} />}
          title="Nessun ticket"
          hint="Registra qui i ticket che apri verso CCoE, RunOps e gli altri team: riferimento, link, scadenza e owner che li segue. Con «Sollecita» tieni traccia dei follow-up."
        />
      ) : (
        <div className="space-y-2">
          {visible.map((x) => {
            const stale = isStale(x)
            const overdue = isOverdue(x)
            const escalate = needsEscalation(x)
            const age = ageInDays(x.lastUpdate)
            const stream = streamOf(x.streamId)
            return (
              <Card
                key={x.id}
                className={cn('p-3', (overdue || escalate) && 'border-[var(--color-danger)]')}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="h-6 w-1 shrink-0 rounded-full"
                    style={{ background: STATUS_COLOR[x.status] }}
                  />
                  {x.ref && (
                    <span className="shrink-0 rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 font-mono text-[11px]">
                      {x.ref}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setEditId(x.id)
                      setDraft({ ...x })
                    }}
                    className="min-w-[160px] flex-1 truncate text-left text-sm font-medium"
                  >
                    {x.title}
                  </button>

                  {stream && (
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        background: `color-mix(in oklch, ${stream.color} 16%, transparent)`,
                        color: stream.color,
                      }}
                    >
                      {stream.name}
                    </span>
                  )}
                  <Badge color={originOf(x) === 'ours' ? 'primary' : 'neutral'}>
                    {originOf(x) === 'ours' ? 'nostro' : 'loro'}
                  </Badge>
                  <Badge color={CRIT_META[x.criticality].color}>
                    {CRIT_META[x.criticality].label}
                  </Badge>

                  {x.link && /^https?:\/\//.test(x.link) && (
                    <a
                      href={x.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Apri il ticket"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
                    >
                      <IconExternal width={15} height={15} />
                    </a>
                  )}

                  {x.neededBy && (
                    <Badge color={overdue ? 'danger' : 'neutral'}>
                      <IconWarn width={11} height={11} /> {relativeDays(x.neededBy)}
                    </Badge>
                  )}
                  {stale && <Badge color="warning">fermo da {age}g</Badge>}
                  {(x.chaseCount ?? 0) > 0 && (
                    <Badge color="neutral">×{x.chaseCount} solleciti</Badge>
                  )}
                  {escalate && <Badge color="danger">da escalare</Badge>}

                  <Select
                    value={x.status}
                    onChange={(e) =>
                      patchDep(x.id, {
                        status: e.target.value as DependencyStatus,
                        lastUpdate: nowISO(),
                      })
                    }
                    className="h-8"
                  >
                    {DEP_STATUSES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                  {isOpen(x) && x.status !== 'unblocked' && (
                    <Button
                      size="sm"
                      variant={stale || escalate ? 'primary' : 'outline'}
                      onClick={() => chase(x.id)}
                      title="Registra un sollecito"
                    >
                      Sollecita
                    </Button>
                  )}
                </div>
                {(x.blocks || x.owner) && (
                  <p className="mt-1.5 pl-3 text-xs text-[var(--color-muted)]">
                    {x.owner && <>Segue: {x.owner}</>}
                    {x.owner && x.blocks && ' · '}
                    {x.blocks && <>Blocca: {x.blocks}</>}
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Edit modal */}
      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={editId ? 'Ticket' : 'Nuovo ticket'}
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
            <Field label="Cosa serve / oggetto del ticket">
              <Input
                autoFocus
                value={draft.title ?? ''}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Es. Apertura firewall verso il nuovo servizio"
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Interlocutore">
                <Select
                  value={draft.streamId ?? ''}
                  onChange={(e) =>
                    setDraft({ ...draft, streamId: e.target.value || undefined })
                  }
                  className="w-full"
                >
                  <option value="">— scegli —</option>
                  {data.streams.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Origine">
                <Select
                  value={draft.origin ?? 'ours'}
                  onChange={(e) =>
                    setDraft({ ...draft, origin: e.target.value as 'ours' | 'theirs' })
                  }
                  className="w-full"
                >
                  <option value="ours">Aperto da noi</option>
                  <option value="theirs">Dal loro backlog</option>
                </Select>
              </Field>
              <Field label="Tipo">
                <Select
                  value={draft.type}
                  onChange={(e) =>
                    setDraft({ ...draft, type: e.target.value as DependencyType })
                  }
                  className="w-full"
                >
                  {DEP_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Riferimento (ID ticket)">
                <Input
                  value={draft.ref ?? ''}
                  onChange={(e) => setDraft({ ...draft, ref: e.target.value })}
                  placeholder="INC0012345"
                />
              </Field>
              <Field label="Link al ticket">
                <Input
                  value={draft.link ?? ''}
                  onChange={(e) => setDraft({ ...draft, link: e.target.value })}
                  placeholder="https://…"
                />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Stato">
                <Select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value as DependencyStatus })
                  }
                  className="w-full"
                >
                  {DEP_STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Criticità">
                <Select
                  value={draft.criticality}
                  onChange={(e) =>
                    setDraft({ ...draft, criticality: e.target.value as Criticality })
                  }
                  className="w-full"
                >
                  <option value="high">Alta</option>
                  <option value="med">Media</option>
                  <option value="low">Bassa</option>
                </Select>
              </Field>
              <Field label="Needed by">
                <Input
                  type="date"
                  value={draft.neededBy ?? ''}
                  onChange={(e) => setDraft({ ...draft, neededBy: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Chi lo segue">
                <Input
                  value={draft.owner ?? ''}
                  onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
                  placeholder="Tu / un membro del team"
                />
              </Field>
              <Field label="Cosa blocca">
                <Input
                  value={draft.blocks ?? ''}
                  onChange={(e) => setDraft({ ...draft, blocks: e.target.value })}
                  placeholder="Es. Go-live servizio X"
                />
              </Field>
            </div>
            <Field label="Note">
              <Textarea
                rows={2}
                value={draft.notes ?? ''}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Contesto, contatti, prossimo follow-up…"
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  )
}

import { useState } from 'react'
import { useStore } from '../store'
import {
  type Dependency,
  type DependencyType,
  type DependencyStatus,
  type Criticality,
  type ExternalItem,
  type ExternalItemStatus,
  DEP_TYPES,
  DEP_STATUSES,
  EXTERNAL_STATUSES,
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
  IconCheck,
} from '../components/icons'
import { StreamPicker, StreamDot } from '../components/Stream'
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
const STALE_DAYS = 5
const ESCALATE_AFTER = 3
const RECHECK_DAYS = 7 // external backlog items not checked for this long

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
})

export default function DependenciesView() {
  const { data, update } = useStore()
  const [draft, setDraft] = useState<Partial<Dependency> | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [fText, setFText] = useState('')
  const [fStream, setFStream] = useState('')
  const [openOnly, setOpenOnly] = useState(true)
  const [extText, setExtText] = useState('')

  const deps = data.dependencies
  const streamOf = (id?: string) => data.streams.find((s) => s.id === id)

  /* ----------------------------- dependencies ---------------------------- */
  function save() {
    if (!draft?.title?.trim()) return
    update((d) => {
      const party =
        draft.party?.trim() || d.streams.find((s) => s.id === draft.streamId)?.name || ''
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
          lastUpdate: nowISO(),
          createdAt: nowISO(),
        })
      }
    })
    setDraft(null)
    setEditId(null)
  }

  function remove(id: string) {
    update((d) => {
      d.dependencies = d.dependencies.filter((x) => x.id !== id)
    })
    setDraft(null)
    setEditId(null)
  }

  function patchDep(id: string, patch: Partial<Dependency>) {
    update((d) => {
      const x = d.dependencies.find((y) => y.id === id)
      if (x) Object.assign(x, patch)
    })
  }

  function setStatus(id: string, status: DependencyStatus) {
    patchDep(id, { status, lastUpdate: nowISO() })
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

  const isOpen = (x: Dependency) => x.status !== 'closed'
  const isStale = (x: Dependency) =>
    (x.status === 'open' || x.status === 'waiting') && ageInDays(x.lastUpdate) >= STALE_DAYS
  const isOverdue = (x: Dependency) => {
    const dd = daysFromToday(x.neededBy)
    return x.status !== 'closed' && dd !== null && dd < 0
  }
  const needsEscalation = (x: Dependency) =>
    (x.chaseCount ?? 0) >= ESCALATE_AFTER &&
    x.status !== 'closed' &&
    x.status !== 'unblocked'

  /* ---------------------------- external items --------------------------- */
  function addExternal() {
    const t = extText.trim()
    if (!t || !fStream) return
    update((d) => {
      d.externalItems.unshift({
        id: uid(),
        streamId: fStream,
        title: t,
        status: 'watching',
        lastCheck: nowISO(),
        createdAt: nowISO(),
      })
    })
    setExtText('')
  }
  function patchExt(id: string, patch: Partial<ExternalItem>) {
    update((d) => {
      const x = d.externalItems.find((y) => y.id === id)
      if (x) Object.assign(x, patch)
    })
  }
  function removeExt(id: string) {
    update((d) => {
      d.externalItems = d.externalItems.filter((x) => x.id !== id)
    })
  }
  const needsRecheck = (x: ExternalItem) =>
    x.status !== 'done' && x.status !== 'dropped' && ageInDays(x.lastCheck) >= RECHECK_DAYS

  /* --------------------- per-counterpart status summary ------------------- */
  type Health = 'critical' | 'attention' | 'ok' | 'idle'
  const HEALTH: Record<Health, { color: string; label: string }> = {
    critical: { color: 'var(--color-danger)', label: 'Da escalare' },
    attention: { color: 'var(--color-warning)', label: 'Da sollecitare' },
    ok: { color: 'var(--color-success)', label: 'Sotto controllo' },
    idle: { color: 'var(--color-border)', label: 'Niente in corso' },
  }

  const summaries = data.streams.map((s) => {
    const sDeps = deps.filter((x) => x.streamId === s.id)
    const sExt = data.externalItems.filter((x) => x.streamId === s.id)
    const open = sDeps.filter(isOpen).length
    const overdue = sDeps.filter(isOverdue).length
    const escalate = sDeps.filter(needsEscalation).length
    const stale = sDeps.filter(isStale).length
    const recheck = sExt.filter(needsRecheck).length
    const watching = sExt.filter(
      (x) => x.status !== 'done' && x.status !== 'dropped',
    ).length
    const openActions = data.actions.filter(
      (a) => a.streamId === s.id && a.status !== 'done',
    ).length
    const lastTouch = [
      ...sDeps.map((x) => x.lastUpdate),
      ...sExt.map((x) => x.lastCheck),
    ].sort().pop()
    const health: Health =
      overdue > 0 || escalate > 0
        ? 'critical'
        : stale > 0 || recheck > 0
          ? 'attention'
          : open > 0 || watching > 0 || openActions > 0
            ? 'ok'
            : 'idle'
    return {
      stream: s,
      open,
      overdue,
      escalate,
      stale,
      recheck,
      watching,
      openActions,
      lastTouch,
      health,
    }
  })

  const matches = (x: Dependency) => {
    if (openOnly && x.status === 'closed') return false
    if (fStream && x.streamId !== fStream) return false
    if (
      fText &&
      !`${x.title} ${x.party} ${x.ref ?? ''} ${x.blocks ?? ''}`
        .toLowerCase()
        .includes(fText.toLowerCase())
    )
      return false
    return true
  }

  const visible = deps.filter(matches).sort((a, b) => {
    if (isOpen(a) !== isOpen(b)) return isOpen(a) ? -1 : 1
    if (CRIT_META[a.criticality].weight !== CRIT_META[b.criticality].weight)
      return CRIT_META[a.criticality].weight - CRIT_META[b.criticality].weight
    return (daysFromToday(a.neededBy) ?? 9999) - (daysFromToday(b.neededBy) ?? 9999)
  })

  const extVisible = data.externalItems.filter(
    (x) => (!fStream || x.streamId === fStream) && (!openOnly || x.status !== 'done'),
  )
  const streamActions = fStream
    ? data.actions.filter((a) => a.streamId === fStream && a.status !== 'done')
    : []

  return (
    <div>
      <PageHeader
        title="Interlocutori"
        subtitle="Cosa hai aperto con CCoE, RunOps e gli altri team: dipendenze, item del loro backlog che monitori, action verso di loro."
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
              <IconPlus /> Nuova dipendenza
            </Button>
          </>
        }
      />

      {/* Counterpart status cards — lo stato a colpo d'occhio */}
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
                  dipendenze aperte
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap gap-1">
                {s.overdue > 0 && <Badge color="danger">{s.overdue} scadute</Badge>}
                {s.escalate > 0 && <Badge color="danger">{s.escalate} da escalare</Badge>}
                {s.stale > 0 && <Badge color="warning">{s.stale} da sollecitare</Badge>}
                {s.recheck > 0 && (
                  <Badge color="warning">{s.recheck} da ricontrollare</Badge>
                )}
                {s.watching > 0 && <Badge color="neutral">{s.watching} in backlog</Badge>}
                {s.openActions > 0 && (
                  <Badge color="primary">{s.openActions} action</Badge>
                )}
              </div>

              <p className="mt-2 text-[11px] text-[var(--color-muted)]">
                {s.lastTouch
                  ? `ultimo contatto ${relativeDays(s.lastTouch.slice(0, 10))}`
                  : 'nessun contatto registrato'}
              </p>
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
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
        <div className="ml-auto flex items-center gap-2">
          <Input
            value={fText}
            onChange={(e) => setFText(e.target.value)}
            placeholder="Filtra…"
            className="h-8 w-36"
          />
          <Button
            size="sm"
            variant={openOnly ? 'primary' : 'outline'}
            onClick={() => setOpenOnly((v) => !v)}
          >
            Solo aperte
          </Button>
        </div>
      </div>

      {/* Dependencies */}
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Dipendenze
      </h3>
      {visible.length === 0 ? (
        <EmptyState
          icon={<IconLink width={26} height={26} />}
          title="Nessuna dipendenza"
          hint="Registra qui i ticket e i blocchi che dipendono da altri team: owner che li insegue, data «needed by», e li tieni visibili."
        />
      ) : (
        <div className="space-y-2">
          {visible.map((x) => {
            const stale = isStale(x)
            const overdue = isOverdue(x)
            const age = ageInDays(x.lastUpdate)
            return (
              <Card key={x.id} className="p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="h-6 w-1 shrink-0 rounded-full"
                    style={{
                      background:
                        x.criticality === 'high'
                          ? 'var(--color-danger)'
                          : x.criticality === 'med'
                            ? 'var(--color-warning)'
                            : 'var(--color-border)',
                    }}
                  />
                  <button
                    onClick={() => {
                      setEditId(x.id)
                      setDraft({ ...x })
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{x.title}</span>
                      {x.ref && (
                        <span className="shrink-0 text-xs text-[var(--color-muted)]">
                          #{x.ref}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <Badge color="neutral">
                        {DEP_TYPES.find((t) => t.key === x.type)?.label}
                      </Badge>
                      <Badge color={CRIT_META[x.criticality].color}>
                        {CRIT_META[x.criticality].label}
                      </Badge>
                      {x.owner && (
                        <span className="text-xs text-[var(--color-muted)]">· {x.owner}</span>
                      )}
                    </div>
                  </button>

                  <StreamPicker
                    streamId={x.streamId}
                    streams={data.streams}
                    onPick={(id) =>
                      patchDep(x.id, {
                        streamId: id,
                        party: streamOf(id)?.name ?? x.party,
                      })
                    }
                    compact
                  />

                  {x.link && /^https?:\/\//.test(x.link) && (
                    <a
                      href={x.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Apri il ticket"
                      className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
                    >
                      <IconExternal width={15} height={15} />
                    </a>
                  )}

                  {x.neededBy && (
                    <Badge color={overdue ? 'danger' : 'neutral'}>
                      <IconWarn width={11} height={11} /> {relativeDays(x.neededBy)}
                    </Badge>
                  )}
                  {stale && <Badge color="warning">ferma da {age}g</Badge>}
                  {(x.chaseCount ?? 0) > 0 && (
                    <Badge color="neutral">×{x.chaseCount} solleciti</Badge>
                  )}
                  {needsEscalation(x) && <Badge color="danger">da escalare</Badge>}

                  <Select
                    value={x.status}
                    onChange={(e) => setStatus(x.id, e.target.value as DependencyStatus)}
                    className="h-8"
                  >
                    {DEP_STATUSES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                  {x.status !== 'closed' && x.status !== 'unblocked' && (
                    <Button
                      size="sm"
                      variant={stale ? 'primary' : 'outline'}
                      onClick={() => chase(x.id)}
                      title="Registra un sollecito"
                    >
                      Sollecita
                    </Button>
                  )}
                </div>
                {x.blocks && (
                  <p className="mt-2 pl-3 text-xs text-[var(--color-muted)]">
                    <span className="font-medium">Blocca:</span> {x.blocks}
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* External backlog */}
      <div className="mt-6">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Backlog monitorato
          </h3>
          <span className="text-[11px] text-[var(--color-muted)]">
            item del backlog altrui che segui ma non gestisci
          </span>
        </div>

        {fStream ? (
          <div className="mb-2 flex gap-2">
            <Input
              value={extText}
              onChange={(e) => setExtText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addExternal()}
              placeholder={`Aggiungi un item del backlog di ${streamOf(fStream)?.name}…`}
            />
            <Button variant="primary" onClick={addExternal}>
              <IconPlus width={15} height={15} />
            </Button>
          </div>
        ) : (
          <p className="mb-2 text-xs text-[var(--color-muted)]">
            Seleziona un interlocutore qui sopra per aggiungere item al suo backlog.
          </p>
        )}

        {extVisible.length === 0 ? (
          <p className="rounded-[var(--radius)] border border-dashed px-4 py-5 text-center text-xs text-[var(--color-muted)]">
            Nessun item monitorato{fStream ? ` per ${streamOf(fStream)?.name}` : ''}.
          </p>
        ) : (
          <div className="space-y-1.5">
            {extVisible.map((x) => {
              const stream = streamOf(x.streamId)
              const recheck = needsRecheck(x)
              return (
                <div
                  key={x.id}
                  className="group flex flex-wrap items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] border bg-[var(--color-surface)] px-3 py-2"
                >
                  <StreamDot stream={stream} />
                  <input
                    value={x.title}
                    onChange={(e) => patchExt(x.id, { title: e.target.value })}
                    className={cn(
                      'min-w-[160px] flex-1 bg-transparent text-sm outline-none',
                      x.status === 'done' && 'text-[var(--color-muted)] line-through',
                    )}
                  />
                  <input
                    value={x.ref ?? ''}
                    onChange={(e) => patchExt(x.id, { ref: e.target.value })}
                    placeholder="rif."
                    className="h-7 w-24 rounded border bg-transparent px-2 text-xs outline-none focus:border-[var(--color-primary)]"
                  />
                  <input
                    value={x.link ?? ''}
                    onChange={(e) => patchExt(x.id, { link: e.target.value })}
                    placeholder="link"
                    className="h-7 w-28 rounded border bg-transparent px-2 text-xs outline-none focus:border-[var(--color-primary)]"
                  />
                  {x.link && /^https?:\/\//.test(x.link) && (
                    <a
                      href={x.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-muted)] hover:text-[var(--color-primary)]"
                    >
                      <IconExternal width={14} height={14} />
                    </a>
                  )}
                  {recheck && (
                    <Badge color="warning">
                      da ricontrollare ({ageInDays(x.lastCheck)}g)
                    </Badge>
                  )}
                  <Select
                    value={x.status}
                    onChange={(e) =>
                      patchExt(x.id, {
                        status: e.target.value as ExternalItemStatus,
                        lastCheck: nowISO(),
                      })
                    }
                    className="h-7 text-xs"
                  >
                    {EXTERNAL_STATUSES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    variant={recheck ? 'primary' : 'ghost'}
                    onClick={() => patchExt(x.id, { lastCheck: nowISO() })}
                    title={`Ultimo check: ${fmtDate(x.lastCheck.slice(0, 10))}`}
                  >
                    <IconCheck width={13} height={13} /> Controllato
                  </Button>
                  <button
                    onClick={() => removeExt(x.id)}
                    className="text-[var(--color-muted)] opacity-0 transition-opacity hover:text-[var(--color-danger)] group-hover:opacity-100"
                  >
                    <IconTrash width={14} height={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Actions toward the selected counterpart */}
      {fStream && streamActions.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Action verso {streamOf(fStream)?.name}
          </h3>
          <div className="space-y-1.5">
            {streamActions.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] border px-3 py-2 text-sm"
              >
                <span className="flex-1 truncate">{a.title}</span>
                {a.owner && <Badge color="primary">{a.owner}</Badge>}
                {a.due && <Badge color="neutral">{relativeDays(a.due)}</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit modal */}
      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={editId ? 'Dipendenza' : 'Nuova dipendenza'}
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
            <Field label="Cosa serve">
              <Input
                autoFocus
                value={draft.title ?? ''}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Es. Apertura firewall verso il nuovo servizio"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Interlocutore (stream)">
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
              <Field label="Owner (chi la segue)">
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

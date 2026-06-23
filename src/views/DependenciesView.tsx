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
import { uid, nowISO, todayISO, fmtDate, relativeDays, ageInDays, daysFromToday, cn } from '../lib/utils'
import { GuideButton } from '../components/Guide'

const STATUS_META: Record<DependencyStatus, { label: string; color: any }> = {
  open: { label: 'Aperta', color: 'warning' },
  waiting: { label: 'In attesa', color: 'neutral' },
  chased: { label: 'Sollecitata', color: 'primary' },
  unblocked: { label: 'Sbloccata', color: 'success' },
  closed: { label: 'Chiusa', color: 'neutral' },
}
const CRIT_META: Record<Criticality, { label: string; color: any; weight: number }> = {
  high: { label: 'Alta', color: 'danger', weight: 0 },
  med: { label: 'Media', color: 'warning', weight: 1 },
  low: { label: 'Bassa', color: 'neutral', weight: 2 },
}
const STALE_DAYS = 5

const emptyDraft = (): Partial<Dependency> => ({
  title: '',
  party: '',
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
  const [fParty, setFParty] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [openOnly, setOpenOnly] = useState(true)

  const deps = data.dependencies

  function save() {
    if (!draft?.title?.trim()) return
    update((d) => {
      if (editId) {
        const x = d.dependencies.find((y) => y.id === editId)
        if (x) {
          Object.assign(x, draft, {
            title: draft.title!.trim(),
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
          party: draft.party?.trim() ?? '',
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

  function setStatus(id: string, status: DependencyStatus) {
    update((d) => {
      const x = d.dependencies.find((y) => y.id === id)
      if (x) {
        x.status = status
        x.lastUpdate = nowISO()
      }
    })
  }

  function chase(id: string) {
    update((d) => {
      const x = d.dependencies.find((y) => y.id === id)
      if (x) {
        x.status = 'chased'
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

  const kpis = [
    { label: 'Aperte', value: deps.filter(isOpen).length, color: 'var(--color-primary)' },
    { label: 'Critiche in attesa', value: deps.filter((x) => x.criticality === 'high' && x.status !== 'closed' && x.status !== 'unblocked').length, color: 'var(--color-danger)' },
    { label: 'Scadute', value: deps.filter(isOverdue).length, color: 'var(--color-danger)' },
    { label: 'Da sollecitare', value: deps.filter(isStale).length, color: 'var(--color-warning)' },
  ]

  const parties = Array.from(new Set(deps.map((x) => x.party).filter(Boolean)))

  const visible = deps
    .filter((x) => {
      if (openOnly && x.status === 'closed') return false
      if (fText && !`${x.title} ${x.party} ${x.ref ?? ''} ${x.blocks ?? ''}`.toLowerCase().includes(fText.toLowerCase())) return false
      if (fParty && x.party !== fParty) return false
      if (fStatus && x.status !== fStatus) return false
      return true
    })
    .sort((a, b) => {
      if (isOpen(a) !== isOpen(b)) return isOpen(a) ? -1 : 1
      if (CRIT_META[a.criticality].weight !== CRIT_META[b.criticality].weight)
        return CRIT_META[a.criticality].weight - CRIT_META[b.criticality].weight
      return (daysFromToday(a.neededBy) ?? 9999) - (daysFromToday(b.neededBy) ?? 9999)
    })

  return (
    <div>
      <PageHeader
        title="Dipendenze esterne"
        subtitle="Ticket, approvazioni e blocchi che dipendono da altri team o vendor (la «D» del RAID log)."
        actions={
          <>
            <GuideButton section="dependencies" />
            <Button variant="primary" onClick={() => { setEditId(null); setDraft(emptyDraft()) }}>
              <IconPlus /> Nuova dipendenza
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="flex items-center gap-3 rounded-[var(--radius)] border bg-[var(--color-surface)] px-3 py-2">
            <span className="h-7 w-1 rounded-full" style={{ background: k.color }} />
            <div className="leading-tight">
              <div className="text-xl font-semibold tabular-nums">{k.value}</div>
              <div className="text-[11px] text-[var(--color-muted)]">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input value={fText} onChange={(e) => setFText(e.target.value)} placeholder="Filtra…" className="h-8 w-40" />
        <Select value={fParty} onChange={(e) => setFParty(e.target.value)} className="h-8">
          <option value="">Tutti i referenti</option>
          {parties.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
        <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="h-8">
          <option value="">Tutti gli stati</option>
          {DEP_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </Select>
        <Button size="sm" variant={openOnly ? 'primary' : 'outline'} onClick={() => setOpenOnly((v) => !v)}>
          Solo aperte
        </Button>
        {(fText || fParty || fStatus) && (
          <Button size="sm" variant="ghost" onClick={() => { setFText(''); setFParty(''); setFStatus('') }}>
            <IconX width={14} height={14} /> Pulisci
          </Button>
        )}
      </div>

      {deps.length === 0 ? (
        <EmptyState
          icon={<IconLink width={28} height={28} />}
          title="Nessuna dipendenza registrata"
          hint="Aggiungi i ticket e i blocchi che dipendono da altri: tienili visibili, assegna un owner che li solleciti e una data «needed by»."
        />
      ) : visible.length === 0 ? (
        <EmptyState title="Nessun risultato" hint="Nessuna dipendenza con questi filtri." />
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
                    style={{ background: CRIT_META[x.criticality].color === 'danger' ? 'var(--color-danger)' : CRIT_META[x.criticality].color === 'warning' ? 'var(--color-warning)' : 'var(--color-border)' }}
                  />
                  <button onClick={() => { setEditId(x.id); setDraft({ ...x }) }} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{x.title}</span>
                      {x.ref && <span className="shrink-0 text-xs text-[var(--color-muted)]">#{x.ref}</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {x.party && <Badge color="primary">{x.party}</Badge>}
                      <Badge color="neutral">{DEP_TYPES.find((t) => t.key === x.type)?.label}</Badge>
                      <Badge color={CRIT_META[x.criticality].color}>{CRIT_META[x.criticality].label}</Badge>
                      {x.owner && <span className="text-xs text-[var(--color-muted)]">· {x.owner}</span>}
                    </div>
                  </button>

                  {x.link && /^https?:\/\//.test(x.link) && (
                    <a href={x.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Apri il ticket" className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]">
                      <IconExternal width={15} height={15} />
                    </a>
                  )}

                  {x.neededBy && (
                    <Badge color={overdue ? 'danger' : 'neutral'}>
                      <IconWarn width={11} height={11} /> {relativeDays(x.neededBy)}
                    </Badge>
                  )}
                  {stale && <Badge color="warning">ferma da {age}g</Badge>}

                  <Select value={x.status} onChange={(e) => setStatus(x.id, e.target.value as DependencyStatus)} className="h-8">
                    {DEP_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </Select>
                  {x.status !== 'closed' && x.status !== 'unblocked' && (
                    <Button size="sm" variant={stale ? 'primary' : 'outline'} onClick={() => chase(x.id)} title="Registra un sollecito (aggiorna la data)">
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
            <Button variant="primary" onClick={save}>Salva</Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-3">
            <Field label="Cosa serve">
              <Input autoFocus value={draft.title ?? ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Es. Apertura firewall verso il nuovo servizio" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Da chi (referente)">
                <Input value={draft.party ?? ''} onChange={(e) => setDraft({ ...draft, party: e.target.value })} placeholder="Team Network / Vendor X…" />
              </Field>
              <Field label="Tipo">
                <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as DependencyType })} className="w-full">
                  {DEP_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Riferimento (ID ticket)">
                <Input value={draft.ref ?? ''} onChange={(e) => setDraft({ ...draft, ref: e.target.value })} placeholder="INC0012345" />
              </Field>
              <Field label="Link al ticket">
                <Input value={draft.link ?? ''} onChange={(e) => setDraft({ ...draft, link: e.target.value })} placeholder="https://…" />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Stato">
                <Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as DependencyStatus })} className="w-full">
                  {DEP_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </Select>
              </Field>
              <Field label="Criticità">
                <Select value={draft.criticality} onChange={(e) => setDraft({ ...draft, criticality: e.target.value as Criticality })} className="w-full">
                  <option value="high">Alta</option>
                  <option value="med">Media</option>
                  <option value="low">Bassa</option>
                </Select>
              </Field>
              <Field label="Needed by">
                <Input type="date" value={draft.neededBy ?? ''} onChange={(e) => setDraft({ ...draft, neededBy: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Owner (chi la segue)">
                <Input value={draft.owner ?? ''} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} placeholder="Tu / un membro del team" />
              </Field>
              <Field label="Cosa blocca">
                <Input value={draft.blocks ?? ''} onChange={(e) => setDraft({ ...draft, blocks: e.target.value })} placeholder="Es. Go-live servizio X" />
              </Field>
            </div>
            <Field label="Note">
              <Textarea rows={2} value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Contesto, contatti, prossimo follow-up…" />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  )
}

import { useState } from 'react'
import { useStore } from '../store'
import {
  Button,
  Card,
  Badge,
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
  IconCopy,
  IconCheck,
  IconSun,
} from '../components/icons'
import { todayISO, nowISO, fmtDate } from '../lib/utils'
import { GuideButton } from '../components/Guide'

export default function StandupView() {
  const { data, update } = useStore()
  const today = todayISO()
  const existing = data.dailyLogs[today]
  const activeSprint = data.sprints.find((s) => s.status === 'active')

  // --- auto suggestions: primarily from the day's activity diary ---
  const acts = data.dailyActivities[today] ?? []
  const actsDone = acts.filter((a) => a.status === 'done').map((a) => a.text)
  const actsOpen = acts.filter((a) => a.status !== 'done').map((a) => a.text)
  const prioritiesDone = (data.dailyTop[today] ?? []).filter(
    (t, i) => t && t.trim() && (data.dailyDone[today] ?? [])[i],
  )
  const prioritiesOpen = (data.dailyTop[today] ?? []).filter(
    (t, i) => t && t.trim() && !(data.dailyDone[today] ?? [])[i],
  )
  const blockedCards = data.kanban
    .filter((c) => c.column === 'blocked')
    .map((c) => c.title)

  const suggestDone = uniq([...actsDone, ...prioritiesDone])
  const suggestCarry = uniq([...actsOpen, ...prioritiesOpen])
  const suggestBlockers = uniq(blockedCards)

  // --- end-of-day form state ---
  const [done, setDone] = useState<string[]>(existing?.done ?? suggestDone)
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [carry, setCarry] = useState<string[]>(existing?.carryOver ?? suggestCarry)
  const [blockers, setBlockers] = useState<string[]>(
    existing?.blockers ?? suggestBlockers,
  )
  const [saved, setSaved] = useState(false)

  function regenerate() {
    setDone(suggestDone)
    setCarry(suggestCarry)
    setBlockers(suggestBlockers)
  }

  function saveLog() {
    update((d) => {
      d.dailyLogs[today] = {
        date: today,
        done: done.filter((x) => x.trim()),
        notes: notes.trim(),
        carryOver: carry.filter((x) => x.trim()),
        blockers: blockers.filter((x) => x.trim()),
        createdAt: nowISO(),
      }
    })
    setSelectedDate(today)
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  // --- report (pick which logged day to present) ---
  const logDates = Object.keys(data.dailyLogs).sort().reverse()
  const [selectedDate, setSelectedDate] = useState<string>('')
  const effectiveDate =
    selectedDate && logDates.includes(selectedDate) ? selectedDate : logDates[0] ?? ''
  const report = data.dailyLogs[effectiveDate]

  return (
    <div>
      <PageHeader
        title="Standup"
        subtitle="Chiudi la giornata e genera il daily del giorno dopo: Ieri · Oggi · Impedimenti."
        actions={<GuideButton section="standup" />}
      />

      {activeSprint?.goals && (
        <div className="mb-4 flex items-start gap-2 rounded-[var(--radius)] border bg-[color-mix(in_oklch,var(--color-primary)_8%,transparent)] px-4 py-2.5 text-sm">
          <span className="font-semibold text-[var(--color-primary)]">
            Obiettivo sprint{activeSprint.name ? ` · ${activeSprint.name}` : ''}:
          </span>
          <span className="whitespace-pre-wrap">{activeSprint.goals}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Close the day */}
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <IconSun width={16} height={16} />
            <h3 className="text-sm font-semibold">Chiudi la giornata</h3>
            <span className="text-xs text-[var(--color-muted)]">{fmtDate(today)}</span>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={regenerate}
              title="Ricarica i suggerimenti dai dati di oggi"
            >
              ↻ Suggerisci
            </Button>
          </div>

          <div className="space-y-4">
            <ListField label="✅ Fatto oggi" items={done} onChange={setDone} placeholder="Aggiungi cosa hai concluso…" />
            <Field label="📝 Note del giorno">
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Decisioni, contesto, cose emerse…"
              />
            </Field>
            <ListField label="🎯 Non finite → domani" items={carry} onChange={setCarry} placeholder="Aggiungi cosa resta da fare…" />
            <ListField label="⛔ Impedimenti" items={blockers} onChange={setBlockers} placeholder="Aggiungi un blocco…" />
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button variant="primary" onClick={saveLog}>
              Salva chiusura giornata
            </Button>
            {saved && (
              <span className="inline-flex items-center gap-1 text-sm text-[var(--color-success)]">
                <IconCheck width={15} height={15} /> Salvato
              </span>
            )}
          </div>
        </Card>

        {/* Generated standup */}
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold">Il tuo standup</h3>
            {logDates.length > 0 && (
              <Select
                value={effectiveDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-8"
              >
                {logDates.map((d) => (
                  <option key={d} value={d}>
                    {fmtDate(d)}
                  </option>
                ))}
              </Select>
            )}
            <CopyButton
              text={report ? buildStandupText(report, activeSprint?.goals) : ''}
              disabled={!report}
            />
          </div>

          {!report ? (
            <EmptyState
              icon={<IconSun width={26} height={26} />}
              title="Nessuno standup ancora"
              hint="Compila «Chiudi la giornata» a sinistra e salva: qui comparirà il daily pronto da presentare domani."
            />
          ) : (
            <div className="space-y-3 text-sm">
              <ReportBlock title="Ieri" color="var(--color-success)" items={report.done} note={report.notes} />
              <ReportBlock title="Oggi" color="var(--color-primary)" items={report.carryOver} />
              <ReportBlock title="Impedimenti" color="var(--color-danger)" items={report.blockers} emptyLabel="Nessuno 🎉" />
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr.filter((x) => x && x.trim())))
}

function buildStandupText(
  log: { done: string[]; notes: string; carryOver: string[]; blockers: string[]; date: string },
  sprintGoal?: string,
): string {
  const L: string[] = []
  L.push(`Daily standup — ${fmtDate(log.date)}`)
  if (sprintGoal) L.push(`Obiettivo sprint: ${sprintGoal.replace(/\n/g, ' ')}`)
  L.push('')
  L.push('Ieri:')
  log.done.forEach((d) => L.push(`- ${d}`))
  if (log.notes) L.push(`(note: ${log.notes})`)
  L.push('')
  L.push('Oggi:')
  log.carryOver.forEach((d) => L.push(`- ${d}`))
  L.push('')
  L.push('Impedimenti:')
  if (log.blockers.length) log.blockers.forEach((d) => L.push(`- ${d}`))
  else L.push('- nessuno')
  return L.join('\n')
}

function ReportBlock({
  title,
  color,
  items,
  note,
  emptyLabel,
}: {
  title: string
  color: string
  items: string[]
  note?: string
  emptyLabel?: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <span className="font-semibold">{title}</span>
      </div>
      {items.length === 0 && !note ? (
        <p className="pl-4 text-[var(--color-muted)]">{emptyLabel ?? '—'}</p>
      ) : (
        <ul className="space-y-0.5 pl-4">
          {items.map((it, i) => (
            <li key={i} className="list-disc list-inside">
              {it}
            </li>
          ))}
          {note && <li className="list-none text-[var(--color-muted)]">— {note}</li>}
        </ul>
      )}
    </div>
  )
}

function ListField({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
}) {
  const [text, setText] = useState('')
  return (
    <Field label={label}>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[var(--color-muted)]">•</span>
            <input
              value={it}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              className="h-8 flex-1 border-b bg-transparent text-sm outline-none focus:border-[var(--color-primary)]"
            />
            <button
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="text-[var(--color-muted)] hover:text-[var(--color-danger)]"
            >
              <IconTrash width={14} height={14} />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && text.trim()) {
                onChange([...items, text.trim()])
                setText('')
              }
            }}
            placeholder={placeholder}
          />
          <Button
            onClick={() => {
              if (text.trim()) {
                onChange([...items, text.trim()])
                setText('')
              }
            }}
          >
            <IconPlus width={15} height={15} />
          </Button>
        </div>
      </div>
    </Field>
  )
}

function CopyButton({ text, disabled }: { text: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size="sm"
      variant={copied ? 'primary' : 'outline'}
      className="ml-auto"
      disabled={disabled}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        } catch {
          /* clipboard may be blocked */
        }
      }}
    >
      {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
      {copied ? 'Copiato' : 'Copia'}
    </Button>
  )
}

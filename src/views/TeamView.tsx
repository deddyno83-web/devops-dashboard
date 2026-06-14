import { useState } from 'react'
import { useStore } from '../store'
import type { Person, OneOnOne, Mood } from '../types'
import {
  Button,
  Card,
  Badge,
  Modal,
  Field,
  Input,
  Textarea,
  EmptyState,
  PageHeader,
} from '../components/ui'
import { IconPlus, IconTrash, IconUsers, IconCalendar } from '../components/icons'
import SkillMatrix from './SkillMatrix'
import { GuideButton } from '../components/Guide'
import {
  uid,
  nowISO,
  todayISO,
  fmtDate,
  relativeDays,
  initials,
  pickColor,
  cn,
} from '../lib/utils'

const MOODS: { v: Mood; emoji: string; label: string }[] = [
  { v: 1, emoji: '😟', label: 'Giù' },
  { v: 2, emoji: '🙁', label: 'Fiacco' },
  { v: 3, emoji: '😐', label: 'Neutro' },
  { v: 4, emoji: '🙂', label: 'Bene' },
  { v: 5, emoji: '😄', label: 'Carico' },
]

export default function TeamView() {
  const { data, update } = useStore()
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<'cards' | 'matrix'>('cards')

  function addPerson() {
    const id = uid()
    update((d) =>
      d.people.push({
        id,
        name: 'Nuova persona',
        role: '',
        skills: [],
        goals: '',
        notes: '',
        oneOnOnes: [],
        color: pickColor(d.people.length),
      }),
    )
    setOpenId(id)
  }

  const person = data.people.find((p) => p.id === openId) ?? null

  return (
    <div>
      <PageHeader
        title="Team & 1:1"
        subtitle={`${data.people.length} ${
          data.people.length === 1 ? 'persona' : 'persone'
        } · scheda, 1:1, skill, obiettivi`}
        actions={
          <>
            <GuideButton section="team" />
            {tab === 'cards' && (
              <Button variant="primary" onClick={addPerson}>
                <IconPlus /> Aggiungi persona
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 inline-flex rounded-[calc(var(--radius)-0.2rem)] border bg-[var(--color-surface-2)]/50 p-1 text-sm">
        <button
          onClick={() => setTab('cards')}
          className={
            'rounded-[calc(var(--radius)-0.35rem)] px-3 py-1.5 font-medium transition-colors ' +
            (tab === 'cards'
              ? 'bg-[var(--color-surface)] shadow-sm'
              : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]')
          }
        >
          Schede
        </button>
        <button
          onClick={() => setTab('matrix')}
          className={
            'rounded-[calc(var(--radius)-0.35rem)] px-3 py-1.5 font-medium transition-colors ' +
            (tab === 'matrix'
              ? 'bg-[var(--color-surface)] shadow-sm'
              : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]')
          }
        >
          Skill matrix
        </button>
      </div>

      {tab === 'matrix' ? (
        <SkillMatrix />
      ) : data.people.length === 0 ? (
        <EmptyState
          icon={<IconUsers width={28} height={28} />}
          title="Nessuna persona ancora"
          hint="Aggiungi i membri del tuo team per tenere traccia di 1:1, obiettivi, skill e note."
          action={
            <Button variant="primary" onClick={addPerson}>
              <IconPlus /> Aggiungi la prima persona
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.people.map((p) => (
            <PersonCard key={p.id} person={p} onOpen={() => setOpenId(p.id)} />
          ))}
        </div>
      )}

      <PersonDrawer
        person={person}
        onClose={() => setOpenId(null)}
        update={update}
      />
    </div>
  )
}

function PersonCard({ person, onOpen }: { person: Person; onOpen: () => void }) {
  const last = person.oneOnOnes[0]
  return (
    <Card
      className="cursor-pointer p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-3" onClick={onOpen}>
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
          style={{ background: person.color }}
        >
          {initials(person.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{person.name}</p>
          <p className="truncate text-xs text-[var(--color-muted)]">
            {person.role || 'Ruolo non impostato'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5" onClick={onOpen}>
        {person.skills.slice(0, 4).map((s) => (
          <Badge key={s}>{s}</Badge>
        ))}
        {person.skills.length > 4 && (
          <Badge>+{person.skills.length - 4}</Badge>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-[var(--color-muted)]">
        <span>
          Ultimo 1:1: {last ? fmtDate(last.date) : '—'}
        </span>
        {person.nextOneOnOne && (
          <Badge
            color={
              (relativeDays(person.nextOneOnOne).includes('fa') && 'danger') ||
              'primary'
            }
          >
            <IconCalendar width={12} height={12} />
            {relativeDays(person.nextOneOnOne)}
          </Badge>
        )}
      </div>
    </Card>
  )
}

function PersonDrawer({
  person,
  onClose,
  update,
}: {
  person: Person | null
  onClose: () => void
  update: (m: (d: any) => void) => void
}) {
  const [skillInput, setSkillInput] = useState('')
  const [oneOnOneNote, setOneOnOneNote] = useState('')
  const [oneOnOneMood, setOneOnOneMood] = useState<Mood | undefined>(undefined)

  if (!person) return null

  const set = (patch: Partial<Person>) =>
    update((d) => {
      const p = d.people.find((x: Person) => x.id === person.id)
      if (p) Object.assign(p, patch)
    })

  function addSkill() {
    const s = skillInput.trim()
    if (!s) return
    update((d) => {
      const p = d.people.find((x: Person) => x.id === person!.id)
      if (p && !p.skills.includes(s)) p.skills.push(s)
    })
    setSkillInput('')
  }

  function removeSkill(s: string) {
    update((d) => {
      const p = d.people.find((x: Person) => x.id === person!.id)
      if (p) p.skills = p.skills.filter((x: string) => x !== s)
    })
  }

  function logOneOnOne() {
    const note = oneOnOneNote.trim()
    if (!note) return
    const entry: OneOnOne = {
      id: uid(),
      date: todayISO(),
      notes: note,
      mood: oneOnOneMood,
    }
    update((d) => {
      const p = d.people.find((x: Person) => x.id === person!.id)
      if (p) p.oneOnOnes.unshift(entry)
    })
    setOneOnOneNote('')
    setOneOnOneMood(undefined)
  }

  function deleteOneOnOne(id: string) {
    update((d) => {
      const p = d.people.find((x: Person) => x.id === person!.id)
      if (p) p.oneOnOnes = p.oneOnOnes.filter((o: OneOnOne) => o.id !== id)
    })
  }

  function removePerson() {
    update((d) => {
      d.people = d.people.filter((x: Person) => x.id !== person!.id)
    })
    onClose()
  }

  return (
    <Modal
      open={!!person}
      onClose={onClose}
      title="Scheda persona"
      wide
      footer={
        <>
          <Button variant="danger" onClick={removePerson} className="mr-auto">
            <IconTrash width={15} height={15} /> Rimuovi
          </Button>
          <Button variant="primary" onClick={onClose}>
            Chiudi
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome">
            <Input
              value={person.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </Field>
          <Field label="Ruolo">
            <Input
              value={person.role}
              onChange={(e) => set({ role: e.target.value })}
              placeholder="Es. Senior Cloud Engineer"
            />
          </Field>
        </div>

        <Field label="Skill">
          <div className="flex flex-wrap gap-1.5">
            {person.skills.map((s) => (
              <button
                key={s}
                onClick={() => removeSkill(s)}
                className="group inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-xs"
                title="Rimuovi"
              >
                {s}
                <span className="text-[var(--color-muted)] group-hover:text-[var(--color-danger)]">
                  ×
                </span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSkill()}
              placeholder="Aggiungi skill (Azure, Terraform, K8s…)"
            />
            <Button onClick={addSkill}>
              <IconPlus width={15} height={15} />
            </Button>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Obiettivi del trimestre">
            <Textarea
              rows={3}
              value={person.goals}
              onChange={(e) => set({ goals: e.target.value })}
              placeholder="Crescita, certificazioni, progetti chiave…"
            />
          </Field>
          <Field label="Note / contesto">
            <Textarea
              rows={3}
              value={person.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Aspirazioni, stile di lavoro, cose da ricordare…"
            />
          </Field>
        </div>

        <Field label="Prossimo 1:1">
          <Input
            type="date"
            value={person.nextOneOnOne ?? ''}
            onChange={(e) => set({ nextOneOnOne: e.target.value || undefined })}
            className="w-48"
          />
        </Field>

        {/* 1:1 log */}
        <div className="rounded-[var(--radius)] border bg-[var(--color-surface-2)]/40 p-3">
          <p className="mb-2 text-xs font-semibold text-[var(--color-muted)]">
            NUOVO 1:1 ({fmtDate(todayISO())})
          </p>
          <Textarea
            rows={2}
            value={oneOnOneNote}
            onChange={(e) => setOneOnOneNote(e.target.value)}
            placeholder="Cosa ci siamo detti, decisioni, follow-up…"
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="flex gap-1">
              {MOODS.map((m) => (
                <button
                  key={m.v}
                  title={m.label}
                  onClick={() =>
                    setOneOnOneMood((cur) => (cur === m.v ? undefined : m.v))
                  }
                  className={cn(
                    'grid h-8 w-8 place-items-center rounded-md text-lg transition-transform hover:scale-110',
                    oneOnOneMood === m.v &&
                      'bg-[var(--color-surface)] ring-2 ring-[var(--color-primary)]',
                  )}
                >
                  {m.emoji}
                </button>
              ))}
            </div>
            <Button variant="primary" onClick={logOneOnOne}>
              Registra 1:1
            </Button>
          </div>
        </div>

        {person.oneOnOnes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--color-muted)]">
              STORICO 1:1
            </p>
            {person.oneOnOnes.map((o) => (
              <div
                key={o.id}
                className="group rounded-[calc(var(--radius)-0.25rem)] border p-3"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--color-muted)]">
                    {fmtDate(o.date)}
                    {o.mood && (
                      <span className="ml-2">
                        {MOODS.find((m) => m.v === o.mood)?.emoji}
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => deleteOneOnOne(o.id)}
                    className="text-[var(--color-muted)] opacity-0 transition-opacity hover:text-[var(--color-danger)] group-hover:opacity-100"
                  >
                    <IconTrash width={14} height={14} />
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-sm">{o.notes}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

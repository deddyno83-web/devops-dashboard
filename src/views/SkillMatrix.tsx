import { useState } from 'react'
import { useStore } from '../store'
import { Button, Input, EmptyState } from '../components/ui'
import { IconPlus, IconGrid, IconTrash } from '../components/icons'

const LEVELS = [
  { v: 0, label: '—', bg: 'transparent', fg: 'var(--color-muted)' },
  { v: 1, label: 'Base', bg: 'color-mix(in oklch, var(--color-primary) 18%, transparent)', fg: 'var(--color-fg)' },
  { v: 2, label: 'Solido', bg: 'color-mix(in oklch, var(--color-primary) 45%, transparent)', fg: 'var(--color-fg)' },
  { v: 3, label: 'Esperto', bg: 'var(--color-primary)', fg: 'var(--color-primary-fg)' },
]

export default function SkillMatrix() {
  const { data, update } = useStore()
  const [newSkill, setNewSkill] = useState('')

  function addSkill() {
    const s = newSkill.trim()
    if (!s) return
    update((d) => {
      if (!d.skillList.includes(s)) d.skillList.push(s)
    })
    setNewSkill('')
  }

  function removeSkill(s: string) {
    update((d) => {
      d.skillList = d.skillList.filter((x) => x !== s)
      d.people.forEach((p) => p.skillLevels && delete p.skillLevels[s])
    })
  }

  function cycle(personId: string, skill: string) {
    update((d) => {
      const p = d.people.find((x) => x.id === personId)
      if (!p) return
      if (!p.skillLevels) p.skillLevels = {}
      p.skillLevels[skill] = ((p.skillLevels[skill] ?? 0) + 1) % 4
    })
  }

  function seedFromTags() {
    update((d) => {
      const all = new Set(d.skillList)
      d.people.forEach((p) => p.skills.forEach((s) => all.add(s)))
      d.skillList = Array.from(all)
    })
  }

  if (data.people.length === 0) {
    return (
      <EmptyState
        icon={<IconGrid width={28} height={28} />}
        title="Aggiungi prima le persone"
        hint="La skill matrix incrocia le persone del team con le competenze. Aggiungi i membri dal tab «Schede»."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2">
          <Input
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSkill()}
            placeholder="Aggiungi competenza (Azure, Terraform…)"
            className="w-64"
          />
          <Button onClick={addSkill}>
            <IconPlus width={15} height={15} /> Aggiungi
          </Button>
        </div>
        {data.skillList.length === 0 && (
          <Button variant="ghost" onClick={seedFromTags}>
            Importa dalle skill già inserite
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <span>Livello:</span>
          {LEVELS.slice(1).map((l) => (
            <span key={l.v} className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ background: l.bg }}
              />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {data.skillList.length === 0 ? (
        <EmptyState
          title="Nessuna competenza definita"
          hint="Aggiungi le competenze che vuoi monitorare: diventeranno le colonne della matrice. Clicca una cella per impostare il livello."
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--color-surface-2)]/60">
                <th className="sticky left-0 z-10 bg-[var(--color-surface-2)] px-3 py-2 text-left font-medium">
                  Persona
                </th>
                {data.skillList.map((s) => {
                  const covered = data.people.filter(
                    (p) => (p.skillLevels?.[s] ?? 0) >= 2,
                  ).length
                  return (
                    <th key={s} className="group px-2 py-2 text-center font-medium">
                      <div className="flex items-center justify-center gap-1">
                        <span className="whitespace-nowrap">{s}</span>
                        <button
                          onClick={() => removeSkill(s)}
                          className="text-[var(--color-muted)] opacity-0 transition-opacity hover:text-[var(--color-danger)] group-hover:opacity-100"
                          title="Rimuovi colonna"
                        >
                          <IconTrash width={12} height={12} />
                        </button>
                      </div>
                      <div
                        className={
                          'mt-0.5 text-[10px] font-normal ' +
                          (covered === 0
                            ? 'text-[var(--color-danger)]'
                            : 'text-[var(--color-muted)]')
                        }
                        title="Persone con livello Solido o superiore"
                      >
                        {covered} copert{covered === 1 ? 'a' : 'e'}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {data.people.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-[var(--color-surface)] px-3 py-2 font-medium">
                    {p.name}
                  </td>
                  {data.skillList.map((s) => {
                    const lvl = p.skillLevels?.[s] ?? 0
                    const meta = LEVELS[lvl]
                    return (
                      <td key={s} className="p-1 text-center">
                        <button
                          onClick={() => cycle(p.id, s)}
                          className="h-9 w-full min-w-[64px] rounded-md text-xs font-medium transition-transform hover:scale-[1.03]"
                          style={{ background: meta.bg, color: meta.fg }}
                          title={`${p.name} · ${s}: ${meta.label}`}
                        >
                          {lvl === 0 ? '' : meta.label}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

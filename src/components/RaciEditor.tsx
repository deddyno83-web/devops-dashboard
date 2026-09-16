import { useState } from 'react'
import type { Person, Raci } from '../types'
import { raciIsEmpty } from '../types'
import { Button, Modal, Input, Badge } from './ui'
import { cn, initials } from '../lib/utils'

const ROLES: {
  key: keyof Raci
  letter: string
  label: string
  hint: string
  single?: boolean
  color: string
}[] = [
  {
    key: 'responsible',
    letter: 'R',
    label: 'Responsible',
    hint: 'chi esegue il lavoro',
    color: 'var(--color-primary)',
  },
  {
    key: 'accountable',
    letter: 'A',
    label: 'Accountable',
    hint: 'unico responsabile finale — uno solo',
    single: true,
    color: 'var(--color-danger)',
  },
  {
    key: 'consulted',
    letter: 'C',
    label: 'Consulted',
    hint: 'da consultare prima di decidere',
    color: 'var(--color-warning)',
  },
  {
    key: 'informed',
    letter: 'I',
    label: 'Informed',
    hint: 'da tenere informato a valle',
    color: 'var(--color-muted)',
  },
]

/** Compact read-only summary: R/A/C/I letters, filled when assigned. */
export function RaciChip({ raci, onClick }: { raci?: Raci; onClick?: () => void }) {
  const empty = raciIsEmpty(raci)
  const has = (k: keyof Raci) => {
    const v = raci?.[k]
    return Array.isArray(v) ? v.length > 0 : !!v
  }
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      title={
        empty
          ? 'Definisci la RACI'
          : ROLES.filter((r) => has(r.key))
              .map((r) => {
                const v = raci?.[r.key]
                return `${r.letter}: ${Array.isArray(v) ? v.join(', ') : v}`
              })
              .join(' · ')
      }
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
        empty
          ? 'border-dashed text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
          : 'border-transparent bg-[var(--color-surface-2)]',
      )}
    >
      {ROLES.map((r) => (
        <span
          key={r.key}
          style={{ color: has(r.key) ? r.color : 'var(--color-muted)' }}
          className={has(r.key) ? '' : 'opacity-40'}
        >
          {r.letter}
        </span>
      ))}
    </button>
  )
}

/** Full RACI matrix editor: pick from the team or type an external name. */
export function RaciModal({
  open,
  onClose,
  title,
  raci,
  people,
  onChange,
}: {
  open: boolean
  onClose: () => void
  title: string
  raci?: Raci
  people: Person[]
  onChange: (r: Raci) => void
}) {
  const [custom, setCustom] = useState('')
  const value: Raci = raci ?? {}

  function toggle(role: (typeof ROLES)[number], name: string) {
    const next: Raci = { ...value }
    if (role.single) {
      next.accountable = next.accountable === name ? undefined : name
    } else {
      const list = [...((next[role.key] as string[] | undefined) ?? [])]
      const i = list.indexOf(name)
      if (i >= 0) list.splice(i, 1)
      else list.push(name)
      ;(next as any)[role.key] = list
    }
    onChange(next)
  }

  const isOn = (role: (typeof ROLES)[number], name: string) =>
    role.single
      ? value.accountable === name
      : ((value[role.key] as string[] | undefined) ?? []).includes(name)

  // Everyone that can be assigned: the team plus names typed in by hand.
  const extra = Array.from(
    new Set(
      ROLES.flatMap((r) => {
        const v = value[r.key]
        return Array.isArray(v) ? v : v ? [v] : []
      }).filter((n) => !people.some((p) => p.name === n)),
    ),
  )
  const candidates = [
    ...people.map((p) => ({ name: p.name, color: p.color })),
    ...extra.map((n) => ({ name: n, color: 'var(--color-muted)' })),
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`RACI · ${title}`}
      wide
      footer={
        <>
          <Button variant="danger" className="mr-auto" onClick={() => onChange({})}>
            Svuota
          </Button>
          <Button variant="primary" onClick={onClose}>
            Fatto
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-[var(--color-muted)]">
        Una sola persona <strong>Accountable</strong>: è la regola che rende utile
        la RACI. Responsible possono essere più di uno.
      </p>

      <div className="mb-3 flex gap-2">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && custom.trim()) {
              const n = custom.trim()
              onChange({
                ...value,
                informed: [...(value.informed ?? []), n],
              })
              setCustom('')
            }
          }}
          placeholder="Aggiungi una persona esterna al team e Invio (entra come Informed)"
        />
      </div>

      {candidates.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--color-muted)]">
          Nessuna persona disponibile. Aggiungi il team in «Team & 1:1» o digita un
          nome qui sopra.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--color-surface-2)]/60">
                <th className="px-3 py-2 text-left font-medium">Persona</th>
                {ROLES.map((r) => (
                  <th key={r.key} className="px-2 py-2 text-center font-medium">
                    <span style={{ color: r.color }}>{r.letter}</span>
                    <div className="text-[10px] font-normal text-[var(--color-muted)]">
                      {r.label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.name} className="border-t">
                  <td className="whitespace-nowrap px-3 py-1.5">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-semibold text-white"
                        style={{ background: c.color }}
                      >
                        {initials(c.name)}
                      </span>
                      {c.name}
                    </span>
                  </td>
                  {ROLES.map((r) => (
                    <td key={r.key} className="p-1 text-center">
                      <button
                        onClick={() => toggle(r, c.name)}
                        className={cn(
                          'h-7 w-full min-w-[46px] rounded-md border text-xs font-semibold transition-colors',
                          isOn(r, c.name)
                            ? 'border-transparent text-white'
                            : 'border-dashed text-[var(--color-muted)] hover:border-[var(--color-primary)]',
                        )}
                        style={
                          isOn(r, c.name) ? { background: r.color } : undefined
                        }
                        title={r.hint}
                      >
                        {isOn(r, c.name) ? r.letter : '·'}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ROLES.map((r) => {
          const v = value[r.key]
          const list = Array.isArray(v) ? v : v ? [v] : []
          if (!list.length) return null
          return (
            <Badge key={r.key} color="neutral">
              <span style={{ color: r.color }} className="font-bold">
                {r.letter}
              </span>
              {list.join(', ')}
            </Badge>
          )
        })}
      </div>
    </Modal>
  )
}

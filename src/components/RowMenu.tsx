import { useState } from 'react'
import { cn, initials } from '../lib/utils'
import type { Person } from '../types'
import { IconDots, IconUserPlus } from './icons'

export interface MenuItem {
  label: string
  onClick: () => void
  danger?: boolean
}

/** Compact kebab (⋯) menu for a list row. Closes on outside click. */
export function RowMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative shrink-0">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
        aria-label="Azioni"
      >
        <IconDots width={16} height={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-md border bg-[var(--color-surface)] py-1 shadow-lg">
            {items.map((it, i) => (
              <button
                key={i}
                onClick={() => {
                  it.onClick()
                  setOpen(false)
                }}
                className={cn(
                  'block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--color-surface-2)]',
                  it.danger && 'text-[var(--color-danger)]',
                )}
              >
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Assign a row to a team member (avatar). Closes on outside click. */
export function AssigneePicker({
  owner,
  people,
  onAssign,
}: {
  owner?: string
  people: Person[]
  onAssign: (name: string | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const person = people.find((p) => p.name === owner)
  return (
    <div className="relative shrink-0">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        title={owner ? `Assegnata a ${owner}` : 'Assegna a una persona'}
      >
        {owner ? (
          <span
            className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold text-white"
            style={{ background: person?.color ?? 'var(--color-muted)' }}
          >
            {initials(owner)}
          </span>
        ) : (
          <span className="grid h-6 w-6 place-items-center rounded-full border border-dashed text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
            <IconUserPlus width={13} height={13} />
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-md border bg-[var(--color-surface)] py-1 shadow-lg">
            {people.length === 0 && (
              <p className="px-3 py-2 text-xs text-[var(--color-muted)]">
                Nessuna persona nel team. Aggiungile in «Team & 1:1».
              </p>
            )}
            {people.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onAssign(p.name)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--color-surface-2)]"
              >
                <span
                  className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-semibold text-white"
                  style={{ background: p.color }}
                >
                  {initials(p.name)}
                </span>
                {p.name}
              </button>
            ))}
            {owner && (
              <button
                onClick={() => {
                  onAssign(undefined)
                  setOpen(false)
                }}
                className="block w-full border-t px-3 py-1.5 text-left text-sm text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
              >
                Rimuovi assegnazione
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

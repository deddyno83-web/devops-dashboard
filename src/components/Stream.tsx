import { useState } from 'react'
import type { Stream } from '../types'
import { cn } from '../lib/utils'

export function StreamDot({ stream }: { stream?: Stream }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ background: stream?.color ?? 'var(--color-border)' }}
    />
  )
}

export function StreamChip({ stream }: { stream?: Stream }) {
  if (!stream) return null
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{
        background: `color-mix(in oklch, ${stream.color} 16%, transparent)`,
        color: stream.color,
      }}
    >
      {stream.name}
    </span>
  )
}

/** Small dropdown to tag a row with a stream (CCoE, RunOps…). */
export function StreamPicker({
  streamId,
  streams,
  onPick,
  compact,
}: {
  streamId?: string
  streams: Stream[]
  onPick: (id: string | undefined) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const current = streams.find((s) => s.id === streamId)
  return (
    <div className="relative shrink-0">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        title={current ? `Stream: ${current.name}` : 'Assegna uno stream'}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors',
          current
            ? 'font-medium'
            : 'border-dashed text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
        )}
        style={
          current
            ? {
                background: `color-mix(in oklch, ${current.color} 16%, transparent)`,
                color: current.color,
                borderColor: 'transparent',
              }
            : undefined
        }
      >
        {current ? (compact ? current.name.slice(0, 12) : current.name) : 'stream'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-48 overflow-hidden rounded-md border bg-[var(--color-surface)] py-1 shadow-lg">
            {streams.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  onPick(s.id)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--color-surface-2)]"
              >
                <StreamDot stream={s} />
                {s.name}
              </button>
            ))}
            {current && (
              <button
                onClick={() => {
                  onPick(undefined)
                  setOpen(false)
                }}
                className="block w-full border-t px-3 py-1.5 text-left text-sm text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
              >
                Nessuno stream
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

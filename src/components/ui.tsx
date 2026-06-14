import {
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '../lib/utils'
import { IconX } from './icons'

/* ---------------------------------- Button --------------------------------- */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger'
  size?: 'sm' | 'md' | 'icon'
}

export function Button({
  variant = 'outline',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      'bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:opacity-90 border border-transparent',
    outline:
      'bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] border',
    ghost: 'bg-transparent hover:bg-[var(--color-surface-2)] border border-transparent',
    danger:
      'bg-transparent text-[var(--color-danger)] hover:bg-[color-mix(in_oklch,var(--color-danger)_12%,transparent)] border border-transparent',
  }
  const sizes = {
    sm: 'h-8 px-2.5 text-xs gap-1.5',
    md: 'h-9 px-3.5 text-sm gap-2',
    icon: 'h-8 w-8 justify-center',
  }
  return (
    <button
      className={cn(
        'inline-flex items-center rounded-[calc(var(--radius)-0.25rem)] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}

/* ----------------------------------- Card ---------------------------------- */
export function Card({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius)] border bg-[var(--color-surface)] shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}

/* ---------------------------------- Badge ---------------------------------- */
export function Badge({
  children,
  color = 'neutral',
  className,
}: {
  children: ReactNode
  color?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger'
  className?: string
}) {
  const colors = {
    neutral: 'bg-[var(--color-surface-2)] text-[var(--color-muted)]',
    primary:
      'bg-[color-mix(in_oklch,var(--color-primary)_15%,transparent)] text-[var(--color-primary)]',
    success:
      'bg-[color-mix(in_oklch,var(--color-success)_18%,transparent)] text-[var(--color-success)]',
    warning:
      'bg-[color-mix(in_oklch,var(--color-warning)_22%,transparent)] text-[var(--color-warning)]',
    danger:
      'bg-[color-mix(in_oklch,var(--color-danger)_15%,transparent)] text-[var(--color-danger)]',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        colors[color],
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ---------------------------- Inputs / fields ------------------------------ */
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'h-9 w-full rounded-[calc(var(--radius)-0.25rem)] border bg-[var(--color-bg)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 placeholder:text-[var(--color-muted)]',
        props.className,
      )}
    />
  )
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full rounded-[calc(var(--radius)-0.25rem)] border bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 placeholder:text-[var(--color-muted)] resize-y',
        props.className,
      )}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'h-9 rounded-[calc(var(--radius)-0.25rem)] border bg-[var(--color-bg)] px-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40',
        props.className,
      )}
    />
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-[var(--color-muted)]">
        {label}
      </span>
      {children}
    </label>
  )
}

/* ---------------------------------- Modal ---------------------------------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={onClose}
    >
      <div
        className={cn(
          'w-full rounded-[var(--radius)] border bg-[var(--color-surface)] shadow-xl',
          wide ? 'max-w-2xl' : 'max-w-md',
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <h3 className="text-sm font-semibold">{title}</h3>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Chiudi">
            <IconX />
          </Button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------- Empty state ------------------------------- */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed px-6 py-10 text-center">
      {icon && <div className="text-[var(--color-muted)]">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-sm text-xs text-[var(--color-muted)]">{hint}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

/* ----------------------------- Section header ------------------------------ */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-sm text-[var(--color-muted)]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

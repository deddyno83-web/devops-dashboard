import { useEffect, useState } from 'react'
import { StoreProvider, useStore } from './store'
import { cn } from './lib/utils'
import { Button } from './components/ui'
import {
  IconHome,
  IconBoard,
  IconUsers,
  IconFile,
  IconDisk,
  IconDownload,
  IconUpload,
  IconMoon,
  IconWarn,
  IconCheck,
  IconActivity,
  IconPrint,
  IconSearch,
  IconSun,
  IconLink,
} from './components/icons'
import DailyView from './views/DailyView'
import KanbanView from './views/KanbanView'
import TeamView from './views/TeamView'
import DecisionsView from './views/DecisionsView'
import SprintHealthView from './views/SprintHealthView'
import ReportView from './views/ReportView'
import StandupView from './views/StandupView'
import DependenciesView from './views/DependenciesView'
import { CommandPalette } from './components/CommandPalette'

type Tab =
  | 'daily'
  | 'standup'
  | 'kanban'
  | 'dependencies'
  | 'team'
  | 'sprint'
  | 'decisions'
  | 'report'

const NAV: { key: Tab; label: string; icon: typeof IconHome }[] = [
  { key: 'daily', label: 'Oggi', icon: IconHome },
  { key: 'standup', label: 'Standup', icon: IconSun },
  { key: 'kanban', label: 'Kanban', icon: IconBoard },
  { key: 'dependencies', label: 'Dipendenze', icon: IconLink },
  { key: 'team', label: 'Team & 1:1', icon: IconUsers },
  { key: 'sprint', label: 'Sprint & Salute', icon: IconActivity },
  { key: 'decisions', label: 'Decisioni', icon: IconFile },
  { key: 'report', label: 'Report', icon: IconPrint },
]

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

function Shell() {
  const { data, update } = useStore()
  const [tab, setTab] = useState<Tab>('daily')
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Global Ctrl/Cmd+K to open the command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Apply theme
  useEffect(() => {
    const theme = data.settings.theme
    const dark =
      theme === 'dark' ||
      (theme === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
  }, [data.settings.theme])

  function toggleTheme() {
    update((d) => {
      const isDark = document.documentElement.classList.contains('dark')
      d.settings.theme = isDark ? 'light' : 'dark'
    })
  }

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      {/* Sidebar / topbar */}
      <aside
        data-noprint
        className="flex shrink-0 flex-col border-b bg-[var(--color-surface)] lg:w-60 lg:border-b-0 lg:border-r"
      >
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-primary)] text-sm font-bold text-[var(--color-primary-fg)]">
            DM
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">DevOps Manager</p>
            <p className="text-[11px] text-[var(--color-muted)]">Dashboard personale</p>
          </div>
          <button
            onClick={toggleTheme}
            className="ml-auto grid h-8 w-8 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] lg:hidden"
            aria-label="Tema"
          >
            <IconMoon />
          </button>
        </div>

        <button
          onClick={() => setPaletteOpen(true)}
          className="mx-2 mb-1 hidden items-center gap-2 rounded-[calc(var(--radius)-0.2rem)] border px-3 py-2 text-sm text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-2)] lg:flex"
        >
          <IconSearch width={15} height={15} />
          <span>Cerca o crea…</span>
          <kbd className="ml-auto rounded border px-1.5 py-0.5 text-[10px] font-medium">
            Ctrl K
          </kbd>
        </button>

        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:pb-0">
          {NAV.map((n) => {
            const Icon = n.icon
            return (
              <button
                key={n.key}
                onClick={() => setTab(n.key)}
                className={cn(
                  'flex shrink-0 items-center gap-2.5 rounded-[calc(var(--radius)-0.2rem)] px-3 py-2 text-sm font-medium transition-colors',
                  tab === n.key
                    ? 'bg-[var(--color-accent)] text-[var(--color-primary)]'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]',
                )}
              >
                <Icon width={18} height={18} />
                {n.label}
              </button>
            )
          })}
        </nav>

        <div className="mt-auto hidden border-t p-3 lg:block">
          <StoragePanel />
          <button
            onClick={toggleTheme}
            className="mt-2 flex w-full items-center gap-2 rounded-[calc(var(--radius)-0.2rem)] px-3 py-2 text-sm text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
          >
            <IconMoon width={16} height={16} /> Cambia tema
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          {tab === 'daily' && <DailyView />}
          {tab === 'standup' && <StandupView />}
          {tab === 'kanban' && <KanbanView />}
          {tab === 'dependencies' && <DependenciesView />}
          {tab === 'team' && <TeamView />}
          {tab === 'sprint' && <SprintHealthView />}
          {tab === 'decisions' && <DecisionsView />}
          {tab === 'report' && <ReportView />}
        </div>
        <div className="border-t p-3 lg:hidden" data-noprint>
          <StoragePanel />
        </div>
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={(t) => setTab(t)}
      />
    </div>
  )
}

function StoragePanel() {
  const { storage, connectDisk, reconnectDisk, loadFromDisk, exportJSON, importJSON } =
    useStore()
  const [toast, setToast] = useState('')

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  return (
    <div className="space-y-2 text-xs">
      <StorageStatus />

      {storage.mode === 'memory' && storage.supported && (
        <Button size="sm" className="w-full" onClick={connectDisk}>
          <IconDisk width={14} height={14} /> Collega cartella su disco
        </Button>
      )}
      {storage.mode === 'reconnect' && (
        <Button
          size="sm"
          variant="primary"
          className="w-full"
          onClick={reconnectDisk}
        >
          <IconWarn width={14} height={14} /> Riconnetti «{storage.dirLabel}»
        </Button>
      )}
      {storage.mode === 'disk' && (
        <Button size="sm" className="w-full" onClick={loadFromDisk}>
          <IconUpload width={14} height={14} /> Ricarica dal disco
        </Button>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={() => {
            exportJSON()
            flash('Backup JSON esportato')
          }}
        >
          <IconDownload width={14} height={14} /> Esporta
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={async () => {
            const ok = await importJSON()
            flash(ok ? 'Dati importati' : 'Import annullato')
          }}
        >
          <IconUpload width={14} height={14} /> Importa
        </Button>
      </div>

      {toast && (
        <div className="flex items-center gap-1.5 rounded-md bg-[var(--color-surface-2)] px-2 py-1 text-[var(--color-muted)]">
          <IconCheck width={13} height={13} /> {toast}
        </div>
      )}
    </div>
  )
}

function StorageStatus() {
  const { storage } = useStore()
  const dot =
    storage.mode === 'disk'
      ? 'var(--color-success)'
      : storage.mode === 'reconnect'
        ? 'var(--color-warning)'
        : 'var(--color-muted)'

  let label = 'Salvataggio nel browser'
  if (storage.mode === 'disk') label = `Su disco · ${storage.dirLabel ?? ''}`
  else if (storage.mode === 'reconnect') label = 'Cartella da riconnettere'
  else if (storage.mode === 'memory' && !storage.supported)
    label = 'Solo browser (usa Esporta)'

  return (
    <div className="flex items-center gap-2 rounded-[calc(var(--radius)-0.2rem)] bg-[var(--color-surface-2)]/60 px-2.5 py-1.5">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: dot }}
      />
      <span className="truncate text-[var(--color-muted)]">{label}</span>
      {storage.saving && (
        <span className="ml-auto text-[var(--color-muted)]">salvo…</span>
      )}
    </div>
  )
}

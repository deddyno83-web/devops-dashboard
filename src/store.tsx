import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AppData } from './types'
import { defaultData } from './types'
import { nowISO, mondayOf } from './lib/utils'
import {
  cacheData,
  loadCachedData,
  fsSupported,
  pickDirectory,
  getSavedDirectory,
  dirPermission,
  writeToDirectory,
  readFromDirectory,
  downloadJSON,
  importJSONFile,
} from './lib/storage'

export type StorageMode = 'loading' | 'memory' | 'disk' | 'reconnect'

interface StorageState {
  mode: StorageMode
  supported: boolean
  dirLabel?: string
  lastSaved?: number
  saving: boolean
}

interface Store {
  data: AppData
  update: (mutate: (draft: AppData) => void) => void
  storage: StorageState
  connectDisk: () => Promise<void>
  reconnectDisk: () => Promise<void>
  loadFromDisk: () => Promise<void>
  exportJSON: () => void
  importJSON: () => Promise<boolean>
}

const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(defaultData)
  const [storage, setStorage] = useState<StorageState>({
    mode: 'loading',
    supported: fsSupported,
    saving: false,
  })

  const dirRef = useRef<any>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const booted = useRef(false)

  // ---- initial load -------------------------------------------------
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    ;(async () => {
      const cached = await loadCachedData()
      if (cached) setData(migrate(cached))

      if (fsSupported) {
        const handle = await getSavedDirectory()
        if (handle) {
          dirRef.current = handle
          const granted = await dirPermission(handle, false)
          if (granted) {
            setStorage((s) => ({ ...s, mode: 'disk', dirLabel: handle.name }))
            return
          }
          // Saved handle exists but needs a user gesture to re-grant.
          setStorage((s) => ({
            ...s,
            mode: 'reconnect',
            dirLabel: handle.name,
          }))
          return
        }
      }
      setStorage((s) => ({ ...s, mode: 'memory' }))
    })()
  }, [])

  // ---- persistence (debounced) -------------------------------------
  const persist = useCallback((next: AppData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setStorage((s) => ({ ...s, saving: true }))
    saveTimer.current = setTimeout(async () => {
      await cacheData(next)
      const handle = dirRef.current
      if (handle && (await dirPermission(handle, false))) {
        try {
          await writeToDirectory(handle, next)
        } catch {
          /* keep cache even if disk write fails */
        }
      }
      setStorage((s) => ({ ...s, saving: false, lastSaved: Date.now() }))
    }, 600)
  }, [])

  const update = useCallback(
    (mutate: (draft: AppData) => void) => {
      setData((prev) => {
        const next: AppData = structuredClone(prev)
        mutate(next)
        next.updatedAt = nowISO()
        persist(next)
        return next
      })
    },
    [persist],
  )

  // ---- disk actions -------------------------------------------------
  const connectDisk = useCallback(async () => {
    const handle = await pickDirectory()
    if (!handle) return
    dirRef.current = handle
    setStorage((s) => ({ ...s, mode: 'disk', dirLabel: handle.name }))
    try {
      await writeToDirectory(handle, data)
      setStorage((s) => ({ ...s, lastSaved: Date.now() }))
    } catch {
      /* ignore */
    }
  }, [data])

  const reconnectDisk = useCallback(async () => {
    const handle = dirRef.current
    if (!handle) return
    const granted = await dirPermission(handle, true)
    if (granted) {
      setStorage((s) => ({ ...s, mode: 'disk' }))
      try {
        await writeToDirectory(handle, data)
        setStorage((s) => ({ ...s, lastSaved: Date.now() }))
      } catch {
        /* ignore */
      }
    }
  }, [data])

  const loadFromDisk = useCallback(async () => {
    const handle = dirRef.current
    if (!handle) return
    if (!(await dirPermission(handle, true))) return
    const fromDisk = await readFromDirectory(handle)
    if (fromDisk) {
      const merged = migrate(fromDisk)
      setData(merged)
      await cacheData(merged)
    }
  }, [])

  const exportJSON = useCallback(() => downloadJSON(data), [data])

  const importJSON = useCallback(async () => {
    const imported = await importJSONFile()
    if (!imported) return false
    const merged = migrate(imported)
    setData(merged)
    persist(merged)
    return true
  }, [persist])

  const value: Store = {
    data,
    update,
    storage,
    connectDisk,
    reconnectDisk,
    loadFromDisk,
    exportJSON,
    importJSON,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

/** Fill in any fields missing from older / imported payloads. */
function migrate(d: Partial<AppData>): AppData {
  const base = defaultData()
  // One-time migration: fold the legacy single weekTop list into the current
  // week of the new per-week weeklyFocus map.
  const weeklyFocus = d.weeklyFocus ?? {}
  if (
    !d.weeklyFocus &&
    Array.isArray(d.weekTop) &&
    d.weekTop.some((x) => x && x.trim())
  ) {
    weeklyFocus[mondayOf()] = d.weekTop
  }
  return {
    ...base,
    ...d,
    people: d.people ?? base.people,
    kanban: d.kanban ?? base.kanban,
    decisions: d.decisions ?? base.decisions,
    actions: d.actions ?? base.actions,
    quickCapture: d.quickCapture ?? base.quickCapture,
    weekTop: d.weekTop ?? base.weekTop,
    weeklyFocus,
    weeklyFocusNotes: d.weeklyFocusNotes ?? base.weeklyFocusNotes,
    dailyTop: d.dailyTop ?? base.dailyTop,
    dailyTopNotes: d.dailyTopNotes ?? base.dailyTopNotes,
    dailyDone: d.dailyDone ?? base.dailyDone,
    sprints: d.sprints ?? base.sprints,
    risks: d.risks ?? base.risks,
    dora: d.dora ?? base.dora,
    skillList: d.skillList ?? base.skillList,
    dailyLogs: d.dailyLogs ?? base.dailyLogs,
    settings: { ...base.settings, ...(d.settings ?? {}) },
  }
}

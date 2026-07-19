import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AppData, ArtSync, RoamRisk } from './types'
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

  // One-time migration: build the persistent ROAM register from the legacy
  // sprint-section risks and the per-date ART Sync risk points. Sources are
  // left untouched in the payload (no data loss); runs only while roamRisks
  // is absent, so it never duplicates.
  let roamRisks = d.roamRisks
  if (!roamRisks) {
    roamRisks = []
    for (const r of d.risks ?? []) {
      roamRisks.push({
        id: r.id,
        title: r.title,
        roam:
          r.status === 'mitigated'
            ? 'mitigated'
            : r.status === 'closed'
              ? 'resolved'
              : undefined,
        note: r.notes,
        createdAt: r.createdAt,
        updatedAt: r.createdAt,
      })
    }
    const byTitle = new Map(
      roamRisks.map((r) => [r.title.trim().toLowerCase(), r]),
    )
    for (const date of Object.keys(d.artSyncs ?? {}).sort()) {
      const s = (d.artSyncs ?? {})[date]
      for (const p of s.points ?? []) {
        if (p.category !== 'risk' || !p.text.trim()) continue
        const key = p.text.trim().toLowerCase()
        const existing = byTitle.get(key)
        if (existing) {
          // newer sync wins on classification/notes
          if (p.roam) existing.roam = p.roam
          if (p.note) existing.note = p.note
          existing.updatedAt = s.createdAt ?? existing.updatedAt
        } else {
          const r: RoamRisk = {
            id: p.id,
            title: p.text.trim(),
            roam: p.roam,
            note: p.note,
            createdAt: s.createdAt ?? nowISO(),
            updatedAt: s.createdAt ?? nowISO(),
          }
          roamRisks.push(r)
          byTitle.set(key, r)
        }
      }
    }
  }

  // Migration: ART Sync actions move into the unified actions list (tagged
  // source 'art-sync'). Idempotent — matched by id, so re-running or
  // re-importing never duplicates. The per-sync arrays are emptied (moved).
  const actions = [...(d.actions ?? [])]
  const artSyncs: Record<string, ArtSync> = {}
  for (const [date, s] of Object.entries(d.artSyncs ?? {})) {
    for (const a of s.actions ?? []) {
      if (!actions.some((x) => x.id === a.id)) {
        actions.push({
          id: a.id,
          title: a.title,
          owner: a.owner,
          due: a.due,
          status: a.done ? 'done' : 'todo',
          createdAt: a.createdAt,
          priority: a.priority,
          source: 'art-sync',
          syncDate: date,
        })
      }
    }
    artSyncs[date] = { ...s, actions: [] }
  }

  return {
    ...base,
    ...d,
    people: d.people ?? base.people,
    kanban: d.kanban ?? base.kanban,
    decisions: d.decisions ?? base.decisions,
    actions,
    quickCapture: d.quickCapture ?? base.quickCapture,
    weekTop: d.weekTop ?? base.weekTop,
    weeklyFocus,
    weeklyFocusNotes: d.weeklyFocusNotes ?? base.weeklyFocusNotes,
    dailyTop: d.dailyTop ?? base.dailyTop,
    dailyTopNotes: d.dailyTopNotes ?? base.dailyTopNotes,
    dailyDone: d.dailyDone ?? base.dailyDone,
    dailyActivities: d.dailyActivities ?? base.dailyActivities,
    sprints: d.sprints ?? base.sprints,
    risks: d.risks ?? base.risks,
    dora: d.dora ?? base.dora,
    skillList: d.skillList ?? base.skillList,
    dailyLogs: d.dailyLogs ?? base.dailyLogs,
    dependencies: d.dependencies ?? base.dependencies,
    artSyncs,
    roamRisks,
    settings: { ...base.settings, ...(d.settings ?? {}) },
  }
}

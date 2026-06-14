import type { AppData } from '../types'
import { todayISO } from './utils'

/* ------------------------------------------------------------------ *
 * IndexedDB key-value store — always-on working storage + handle keep *
 * ------------------------------------------------------------------ */

const DB_NAME = 'devops-dashboard'
const STORE = 'kv'
const DATA_KEY = 'appData'
const DIR_KEY = 'dirHandle'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadCachedData(): Promise<AppData | undefined> {
  return idbGet<AppData>(DATA_KEY)
}

export async function cacheData(data: AppData): Promise<void> {
  await idbSet(DATA_KEY, data)
}

/* ------------------------------------------------------------------ *
 * File System Access API — optional real JSON file + rotating backups *
 * ------------------------------------------------------------------ */

type DirHandle = any // FileSystemDirectoryHandle (not in default TS lib)

export const fsSupported =
  typeof window !== 'undefined' && 'showDirectoryPicker' in window

const DATA_FILE = 'dashboard.json'
const BACKUP_DIR = 'backups'
const MAX_BACKUPS = 20
let lastBackupAt = 0
const BACKUP_INTERVAL_MS = 20 * 60 * 1000 // at most one backup every 20 min

export async function pickDirectory(): Promise<DirHandle | null> {
  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      id: 'devops-dashboard-data',
    })
    await idbSet(DIR_KEY, handle)
    return handle
  } catch {
    return null // user cancelled
  }
}

export async function getSavedDirectory(): Promise<DirHandle | null> {
  return (await idbGet<DirHandle>(DIR_KEY)) ?? null
}

export async function dirPermission(
  handle: DirHandle,
  request: boolean,
): Promise<boolean> {
  if (!handle) return false
  const opts = { mode: 'readwrite' }
  try {
    if ((await handle.queryPermission(opts)) === 'granted') return true
    if (request && (await handle.requestPermission(opts)) === 'granted')
      return true
  } catch {
    /* ignore */
  }
  return false
}

export async function writeToDirectory(
  handle: DirHandle,
  data: AppData,
): Promise<void> {
  const json = JSON.stringify(data, null, 2)

  // Main file — overwritten every save.
  const fh = await handle.getFileHandle(DATA_FILE, { create: true })
  const w = await fh.createWritable()
  await w.write(json)
  await w.close()

  // Rotating backup — throttled so we don't flood the folder.
  const now = Date.now()
  if (now - lastBackupAt < BACKUP_INTERVAL_MS) return
  lastBackupAt = now
  try {
    const backups = await handle.getDirectoryHandle(BACKUP_DIR, { create: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const bh = await backups.getFileHandle(`dashboard_${stamp}.json`, {
      create: true,
    })
    const bw = await bh.createWritable()
    await bw.write(json)
    await bw.close()
    await pruneBackups(backups)
  } catch {
    /* backups are best-effort */
  }
}

async function pruneBackups(dir: DirHandle): Promise<void> {
  const names: string[] = []
  for await (const [name, h] of dir.entries()) {
    if ((h as any).kind === 'file' && name.endsWith('.json')) names.push(name)
  }
  names.sort() // timestamped names sort chronologically
  while (names.length > MAX_BACKUPS) {
    const n = names.shift()
    if (n) await dir.removeEntry(n)
  }
}

export async function readFromDirectory(
  handle: DirHandle,
): Promise<AppData | null> {
  try {
    const fh = await handle.getFileHandle(DATA_FILE)
    const file = await fh.getFile()
    const text = await file.text()
    return JSON.parse(text) as AppData
  } catch {
    return null
  }
}

export async function dirName(handle: DirHandle): Promise<string> {
  return handle?.name ?? 'cartella'
}

/* ------------------------------------------------------------------ *
 * Manual export / import — always available, also works from file://  *
 * ------------------------------------------------------------------ */

export function downloadJSON(data: AppData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `devops-dashboard_${todayISO()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function importJSONFile(): Promise<AppData | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = async () => {
      const f = input.files?.[0]
      if (!f) return resolve(null)
      try {
        resolve(JSON.parse(await f.text()) as AppData)
      } catch {
        resolve(null)
      }
    }
    input.click()
  })
}

const DB_NAME = 'wcsim', DB_VER = 1, STORE = 'saves', AUTO_KEY = 'autosave'
let _db = null

async function getDB() {
  if (_db) return _db
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER)
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath:'key' })
    req.onsuccess = e => { _db = e.target.result; res(_db) }
    req.onerror  = () => rej(req.error)
  })
}

async function dbPut(key, data) {
  const db = await getDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ key, data })
    tx.oncomplete = () => res(true)
    tx.onerror = () => rej(tx.error)
  })
}

async function dbGet(key) {
  const db = await getDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => res(req.result?.data || null)
    req.onerror  = () => rej(req.error)
  })
}

async function dbDelete(key) {
  const db = await getDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => res(true)
    tx.onerror = () => rej(tx.error)
  })
}

async function dbAll() {
  const db = await getDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => res(req.result || [])
    req.onerror  = () => rej(req.error)
  })
}

// ── Game state ────────────────────────────────────────────────
export const S = {
  wcNumber: 1,
  phase: 'idle',    // idle | qualified | groups | knockout | done
  hostNation: null,
  teams: [],
  groups: [],
  groupMatches: [],
  knockoutRounds: [],
  champion: null,
  roundReached: {},
  scorers: {},
  teamGoals: {},
  teamGoalsConceded: {},
  allMatchResults: [],
  seasonAwards: {},
  history: [],
  nextId: 1,
}

function buildSave() {
  return {
    ...JSON.parse(JSON.stringify(S)),
    savedAt: Date.now()
  }
}

export async function autoSave() {
  try {
    await dbPut(AUTO_KEY, buildSave())
    const el = document.getElementById('last-saved')
    if (el) el.textContent = 'Saved ' + new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
  } catch (e) { console.warn('autosave failed', e) }
}

export async function loadGame() {
  try {
    const d = await dbGet(AUTO_KEY)
    if (!d) return false
    Object.assign(S, d)
    return true
  } catch (e) { return false }
}

export async function clearGame() {
  await dbDelete(AUTO_KEY).catch(() => {})
}

export function exportSave() {
  const data = buildSave()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `wcsim_wc${S.wcNumber}_${Date.now()}.json`
  a.click()
}

export function importSave(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = e => {
      try {
        const d = JSON.parse(e.target.result)
        if (!d.wcNumber) throw new Error('Invalid save')
        Object.assign(S, d)
        autoSave().then(res).catch(rej)
      } catch (err) { rej(err) }
    }
    r.onerror = rej
    r.readAsText(file)
  })
}

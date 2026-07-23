const DB_NAME = 'wcsim', DB_VER = 1, STORE = 'saves', AUTO_KEY = 'autosave'
let _db = null
let _activeSlot = null  // which slot autosave writes to

export function setActiveSlot(n) { _activeSlot = n }
export function getActiveSlot() { return _activeSlot }

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
  era: null,
  currentYear: 1930,
  tournamentFormat: null,
  recordsView: 'teams',
}

import { ALL_NATIONS } from './data/nations.js'


// Reconnect duplicated objects created by JSON save/load and rebuild group tables.
// JSON serialization preserves values but not shared references, so after loading a
// save S.groups, S.groupMatches and S.knockoutRounds may each contain separate
// copies of the same team. Match results must always update the canonical S.teams
// objects used by the standings UI.
export function normalizeTournamentState() {
  if (!Array.isArray(S.teams)) S.teams = []
  // Repair qualification saves created while duplicate nation definitions were
  // present. Nation name is the stable identity everywhere in the simulator.
  S.teams = Array.from(new Map(S.teams.filter(Boolean).map(t => [t.name, t])).values())
  const teamByName = new Map(S.teams.map(t => [t.name, t]))
  const canonical = ref => {
    if (!ref) return ref
    const name = typeof ref === 'string' ? ref : ref.name
    return teamByName.get(name) || ref
  }

  // Groups should point at canonical team objects.
  ;(S.groups || []).forEach(group => {
    group.teams = Array.from(new Map((group.teams || []).map(canonical).filter(Boolean).map(t => [t.name, t])).values())
  })

  // Rebuild group standings from played matches. This also repairs saves made
  // while the old reference bug was present.
  S.teams.forEach(t => {
    t.w = 0; t.d = 0; t.l = 0; t.gf = 0; t.ga = 0; t.gd = 0; t.pts = 0
  })
  ;(S.groupMatches || []).forEach(match => {
    match.t1 = canonical(match.t1)
    match.t2 = canonical(match.t2)
    if (match.result) {
      match.result.t1 = match.t1
      match.result.t2 = match.t2
      if (match.result.winner) match.result.winner = canonical(match.result.winner)
    }
    if (!match.played || !match.result) return
    const { g1 = 0, g2 = 0 } = match.result
    const t1 = match.t1, t2 = match.t2
    if (!t1 || !t2) return
    t1.gf += g1; t1.ga += g2; t1.gd = t1.gf - t1.ga
    t2.gf += g2; t2.ga += g1; t2.gd = t2.gf - t2.ga
    if (g1 > g2) { t1.w++; t1.pts += 3; t2.l++ }
    else if (g2 > g1) { t2.w++; t2.pts += 3; t1.l++ }
    else { t1.d++; t1.pts++; t2.d++; t2.pts++ }
  })

  // Knockout fixtures/results also need canonical references for later rounds,
  // records and modal navigation.
  ;(S.knockoutRounds || []).forEach(round => {
    ;(round.matches || []).forEach(match => {
      match.t1 = canonical(match.t1)
      match.t2 = canonical(match.t2)
      if (match.result) {
        match.result.t1 = match.t1
        match.result.t2 = match.t2
        if (match.result.winner) match.result.winner = canonical(match.result.winner)
      }
    })
  })
  if (S.champion) S.champion = canonical(S.champion)
  return S
}

function buildSave() {
  return {
    ...JSON.parse(JSON.stringify(S)),
    // Stars/stats live on ALL_NATIONS module state, not in S — snapshot them
    _nationData: ALL_NATIONS.map(n => ({
      name: n.name,
      stars: n.stars || [],
      stats: n.stats || null,
      _lastRating: n._lastRating ?? null,
    })),
    savedAt: Date.now()
  }
}

export function restoreNationData(save) {
  if (!save?._nationData) return false
  save._nationData.forEach(nd => {
    const n = ALL_NATIONS.find(x => x.name === nd.name)
    if (!n) return
    n.stars = nd.stars || []
    if (nd.stats) n.stats = nd.stats
    if (nd._lastRating != null) n._lastRating = nd._lastRating
  })
  return true
}

export async function autoSave() {
  try {
    const data = buildSave()
    if (_activeSlot) {
      data.slotNum = _activeSlot
      await dbPut('slot_' + _activeSlot, data)
    } else {
      await dbPut(AUTO_KEY, data)
    }
    const el = document.getElementById('last-saved')
    if (el) el.textContent = 'Saved' + (_activeSlot ? ` · Slot ${_activeSlot}` : '')
  } catch (e) { console.warn('autosave failed', e) }
}

export async function loadGame() {
  try {
    const d = await dbGet(AUTO_KEY)
    if (!d) return false
    Object.assign(S, d)
    normalizeTournamentState()
    return true
  } catch (e) { return false }
}

export async function clearGame() {
  if (_activeSlot) await dbDelete('slot_' + _activeSlot).catch(() => {})
  await dbDelete(AUTO_KEY).catch(() => {})
}


// ── Named save slots (3-slot home page) ───────────────────────
export async function loadSlot(slotNum) {
  const d = await dbGet('slot_' + slotNum)
  if (!d) throw new Error('Slot empty')
  Object.assign(S, d)
  normalizeTournamentState()
  restoreNationData(d)
  _activeSlot = slotNum
}

export async function getSlotInfo(slotNum) {
  return await dbGet('slot_' + slotNum)
}

export async function deleteSlot(slotNum) {
  await dbDelete('slot_' + slotNum).catch(() => {})
}

export async function allSlotInfo() {
  const out = {}
  for (let i = 1; i <= 3; i++) {
    out[i] = await dbGet('slot_' + i)
  }
  return out
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
        normalizeTournamentState()
        autoSave().then(res).catch(rej)
      } catch (err) { rej(err) }
    }
    r.onerror = rej
    r.readAsText(file)
  })
}

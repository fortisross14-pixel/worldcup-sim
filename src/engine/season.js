import { S, autoSave } from '../store.js'
import { ALL_NATIONS, CONF_SLOTS, flag } from '../data/nations.js'
import { simMatch, rand, clamp, shuffle, ovr, getEffStats, STAR_MULT, STAR_BONUSES } from './match.js'
import { initAllStars, ageAllStars, linkStarsToTeam, syncStarsBack, TIER_ORDER } from './stars.js'

// ── Gaussian helper ───────────────────────────────────────────
function gauss(sig = 3.5, maxAbs = 12) {
  let u = 0, v = 0
  while (!u) u = Math.random()
  while (!v) v = Math.random()
  const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sig
  return Math.round(Math.max(-maxAbs, Math.min(maxAbs, g)))
}

// ── History component (0–20 pts based on last 5 WCs) ─────────
function histPts(nationName) {
  if (!S.history?.length) return 0
  const pts = { Winner:20, Final:15, 'Semi-finals':10, 'Quarter-finals':6, 'Round of 32':3, Group:1 }
  const recent = [...S.history].reverse().slice(0, 5)
  let ws = 0, ss = 0
  recent.forEach((h, i) => {
    const w = recent.length - i; ws += w
    ss += w * (pts[h.roundReached?.[nationName]] || 0)
  })
  return ws ? Math.round((ss / (ws * 20)) * 20) : 0
}

// ── Season rating = base(80%) + hist(20%), then ±7 noise ──────
function seasonRating(nation) {
  const hist = histPts(nation.name)
  const raw = nation.base * 0.80 + hist
  return clamp(Math.round(raw + gauss(3, 7)), 40, 99)
}

// ── Build 5-stat block for a team ────────────────────────────
function rollStats(tier) {
  const base = tier === 'top' ? 75 : tier === 'mid' ? 70 : 65
  const r = () => clamp(base + gauss(3, 5), base - 5, base + 5)
  return { attack:r(), defense:r(), stamina:r(), mental:r(), setPieces:r() }
}

// ── Qualification ─────────────────────────────────────────────
export function runQualification() {
  // Re-roll stats for each nation each WC (form varies)
  ALL_NATIONS.forEach(n => { n.stats = rollStats(n.tier || 'rest') })

  // Pick host
  const hostNation = ALL_NATIONS[Math.floor(Math.random() * ALL_NATIONS.length)]
  S.hostNation = hostNation.name

  // Always-qualified nations
  const always = ALL_NATIONS.filter(n => n.always || n.name === S.hostNation)
  const alwaysSet = new Set(always.map(n => n.name))

  // Fill confederation slots
  const qualified = [...always]
  const qualSet = new Set(qualified.map(n => n.name))

  Object.entries(CONF_SLOTS).forEach(([conf, slots]) => {
    if (conf === 'HOST' || conf === 'PLAYOFF') return
    const pool = ALL_NATIONS.filter(n => n.conf === conf && !qualSet.has(n.name))
    const needed = Math.max(0, slots - qualified.filter(n => n.conf === conf).length)
    // Weight by season rating
    const scored = pool.map(n => ({ n, score: seasonRating(n) + gauss(2, 5) }))
      .sort((a, b) => b.score - a.score)
    scored.slice(0, needed).forEach(({ n }) => { qualified.push(n); qualSet.add(n.name) })
  })

  // Fill to 48
  while (qualified.length < 48) {
    const pool = ALL_NATIONS.filter(n => !qualSet.has(n.name))
    if (!pool.length) break
    const n = pool[Math.floor(Math.random() * pool.length)]
    qualified.push(n); qualSet.add(n.name)
  }

  // Build team objects
  S.teams = shuffle(qualified.slice(0, 48)).map(nation => {
    const rating = seasonRating(nation)
    return {
      name: nation.name, cc: nation.cc, conf: nation.conf,
      tier: nation.tier || 'rest',
      stats: nation.stats || rollStats(nation.tier || 'rest'),
      rating,
      stars: linkStarsToTeam(nation),
      isHost: nation.name === S.hostNation,
      mentalityDelta: 0,
      w:0, d:0, l:0, gf:0, ga:0, pts:0,
    }
  })

  S.roundReached = {}
  S.teamGoals = {}; S.teamGoalsConceded = {}
  S.allMatchResults = []; S.scorers = {}
  S.seasonAwards = {}
}

// ── Draw 12 groups of 4 ───────────────────────────────────────
export function drawGroups() {
  const sorted = [...S.teams].sort((a, b) => b.rating - a.rating)
  const pot1 = sorted.slice(0, 12)  // top 12 seeded
  const rest = shuffle(sorted.slice(12))

  S.groups = Array.from({ length: 12 }, (_, i) => ({
    id: String.fromCharCode(65 + i),
    teams: [pot1[i]]
  }))

  // Distribute rest: max 1 per confederation per group where possible
  for (const team of rest) {
    const eligible = S.groups.filter(g => {
      if (g.teams.length >= 4) return false
      return !g.teams.some(t => t.cc === team.cc)
    })
    const fallback = S.groups.filter(g => g.teams.length < 4)
    const target = eligible.length
      ? eligible[Math.floor(Math.random() * eligible.length)]
      : fallback[Math.floor(Math.random() * fallback.length)]
    if (target) target.teams.push(team)
  }

  // Build match schedule (each team plays other 3 once)
  S.groupMatches = []
  S.groups.forEach((grp, gi) => {
    const t = grp.teams
    ;[[0,1],[2,3],[0,2],[1,3],[0,3],[1,2]].forEach(([a, b]) => {
      if (t[a] && t[b]) S.groupMatches.push({ gi, t1:t[a], t2:t[b], played:false, result:null })
    })
  })
}

// ── Group stats update ────────────────────────────────────────
export function updateGroupStats(result) {
  const { t1, t2, g1, g2 } = result
  t1.gf=(t1.gf||0)+g1; t1.ga=(t1.ga||0)+g2; t1.gd=t1.gf-t1.ga
  t2.gf=(t2.gf||0)+g2; t2.ga=(t2.ga||0)+g1; t2.gd=t2.gf-t2.ga
  if (g1>g2)      { t1.w=(t1.w||0)+1; t1.pts=(t1.pts||0)+3; t2.l=(t2.l||0)+1 }
  else if (g2>g1) { t2.w=(t2.w||0)+1; t2.pts=(t2.pts||0)+3; t1.l=(t1.l||0)+1 }
  else            { t1.d=(t1.d||0)+1; t1.pts=(t1.pts||0)+1; t2.d=(t2.d||0)+1; t2.pts=(t2.pts||0)+1 }
}

export function playGroupMatch(match) {
  if (match.played) return null
  const result = simMatch(match.t1, match.t2, true, false)
  match.played = true; match.result = result
  updateGroupStats(result)
  trackStats(result, 'group', match.gi)
  autoSave(); return result
}

function trackStats(r, phase, gi) {
  S.allMatchResults = S.allMatchResults || []
  S.allMatchResults.push({
    t1id:r.t1.name, t1name:r.t1.name, t1cc:r.t1.cc,
    t2id:r.t2.name, t2name:r.t2.name, t2cc:r.t2.cc,
    g1:r.g1, g2:r.g2, phase, gi,
    shots1:r.shots1, shots2:r.shots2,
    corners1:r.corners1, corners2:r.corners2,
    possession1:r.possession1
  })
  S.teamGoals = S.teamGoals || {}
  S.teamGoalsConceded = S.teamGoalsConceded || {}
  S.teamGoals[r.t1.name] = (S.teamGoals[r.t1.name]||0) + r.g1
  S.teamGoals[r.t2.name] = (S.teamGoals[r.t2.name]||0) + r.g2
  S.teamGoalsConceded[r.t1.name] = (S.teamGoalsConceded[r.t1.name]||0) + r.g2
  S.teamGoalsConceded[r.t2.name] = (S.teamGoalsConceded[r.t2.name]||0) + r.g1
  ;[r.t1, r.t2].forEach(t => (t.stars||[]).forEach(s => { if (s.goals) S.scorers[s.name]=(S.scorers[s.name]||0)+s.goals }))
}

export function groupStandings(grp) {
  return [...grp.teams].sort((a, b) =>
    (b.pts||0)-(a.pts||0) || (b.gd||0)-(a.gd||0) || (b.gf||0)-(a.gf||0))
}

// ── Build knockout (top 2 from each group = 24 teams → R24) ──
export function buildKnockout() {
  const qualifiers = []
  S.groups.forEach(grp => {
    const top2 = groupStandings(grp).slice(0, 2)
    top2.forEach(t => { qualifiers.push(t); S.roundReached[t.name] = 'Round of 32' })
    groupStandings(grp).slice(2).forEach(t => { S.roundReached[t.name] = 'Group' })
  })
  // Pair winners vs runners from different groups
  const winners = S.groups.map(g => groupStandings(g)[0])
  const runners = S.groups.map(g => groupStandings(g)[1])
  const matches = []
  // Cross-pair: A1 vs B2, B1 vs A2, etc.
  for (let i = 0; i < 12; i += 2) {
    matches.push({ t1:winners[i], t2:runners[i+1], played:false, result:null })
    matches.push({ t1:winners[i+1], t2:runners[i], played:false, result:null })
  }
  S.knockoutRounds = [{ name:'Round of 32', matches }]
  autoSave()
}

export function playKnockoutMatch(match) {
  if (match.played) return null
  const result = simMatch(match.t1, match.t2, false, true)
  match.played = true; match.result = result
  trackStats(result, 'knockout')
  autoSave(); return result
}

export function advanceKnockout() {
  const round = S.knockoutRounds[S.knockoutRounds.length - 1]
  const winners = round.matches.map(m => m.result?.winner).filter(Boolean)
  const losers  = round.matches.map(m => {
    if (!m.result?.winner) return null
    return m.result.winner === m.t1 ? m.t2 : m.t1
  }).filter(Boolean)

  losers.forEach(t => { if (!S.roundReached[t.name]) S.roundReached[t.name] = round.name })

  if (winners.length === 1) {
    S.champion = winners[0]
    S.roundReached[winners[0].name] = 'Winner'
    if (losers[0]) S.roundReached[losers[0].name] = 'Final'
    S.phase = 'done'
    finalizeWC()
    return
  }

  const nextName = { 24:'Round of 16', 16:'Quarter-finals', 8:'Semi-finals', 4:'Final' }[winners.length] || 'Next Round'
  const newMatches = []
  for (let i = 0; i < winners.length; i += 2)
    newMatches.push({ t1:winners[i], t2:winners[i+1], played:false, result:null })
  S.knockoutRounds.push({ name:nextName, matches:newMatches })
  autoSave()
}

function finalizeWC() {
  const famePts = { Winner:300, Final:150, 'Semi-finals':75, 'Quarter-finals':30, 'Round of 16':12, 'Round of 32':5, Group:0 }
  let topScorer = null, topGoals = 0
  let offMVP = null, offRating = 0
  let defMVP = null, defRating = 0

  S.teams?.forEach(t => {
    const reached = S.roundReached[t.name] || 'Group'
    const fp = famePts[reached] || 0
    ;(t.stars || []).forEach(s => {
      s.fame = (s.fame || 0) + fp + (s.goals || 0) * 20
      if (reached === 'Winner') s.medals.gold++
      else if (reached === 'Final') s.medals.silver++
      else if (reached === 'Semi-finals') s.medals.bronze++
      else if (reached === 'Quarter-finals') s.medals.sf = (s.medals.sf||0)+1
      if ((s.goals||0) > topGoals) { topGoals=s.goals; topScorer=s }
      const avgR = s.ratings?.length ? s.ratings.reduce((a,b)=>a+b,0)/s.ratings.length : 0
      if (['FWD','MID'].includes(s.pos) && avgR > offRating) { offRating=avgR; offMVP=s }
      if (['DEF','GK'].includes(s.pos) && avgR > defRating) { defRating=avgR; defMVP=s }
    })
    // Sync stars back to nation data
    const nation = ALL_NATIONS.find(n => n.name === t.name)
    if (nation) syncStarsBack(nation, t.stars)
  })

  S.seasonAwards = {
    topScorer: topScorer ? { name:topScorer.name, goals:topGoals, team:topScorer.teamName, tier:topScorer.tier } : null,
    offMVP:    offMVP    ? { name:offMVP.name,    rating:offRating.toFixed(1), team:offMVP.teamName, pos:offMVP.pos, tier:offMVP.tier } : null,
    defMVP:    defMVP    ? { name:defMVP.name,    rating:defRating.toFixed(1), team:defMVP.teamName, pos:defMVP.pos, tier:defMVP.tier } : null,
  }

  S.history = S.history || []
  S.history.push({
    wcNumber: S.wcNumber,
    champion: S.champion.name, cc: S.champion.cc,
    roundReached: { ...S.roundReached },
    topScorers: Object.entries(S.scorers||{}).sort((a,b)=>b[1]-a[1]).slice(0,5),
    totalGoals: Object.values(S.teamGoals||{}).reduce((a,b)=>a+b,0),
    awards: { ...S.seasonAwards }
  })
  autoSave()
}

// ── Start new WC cycle ────────────────────────────────────────
export function startNewWC() {
  S.wcNumber = (S.wcNumber || 1) + 1
  S.phase = 'idle'; S.champion = null
  S.groups = []; S.groupMatches = []; S.knockoutRounds = []
  S.scorers = {}; S.teamGoals = {}; S.teamGoalsConceded = {}
  S.allMatchResults = []; S.roundReached = {}; S.seasonAwards = {}
  S.teams?.forEach(t => { t.pts=0;t.w=0;t.d=0;t.l=0;t.gf=0;t.ga=0;t.gd=0;t.mentalityDelta=0 })
  return ageAllStars(S.wcNumber)  // returns { retiring, debuting }
}

export { initAllStars, ageAllStars }

import { S, autoSave } from '../store.js'
import { ALL_NATIONS, CONF_SLOTS, flag, getSoul } from '../data/nations.js'
import { simMatch, rand, clamp, shuffle, ovr, getEffStats, STAR_MULT, STAR_BONUSES } from './match.js'
import { initAllStars, ageAllStars, linkStarsToTeam, syncStarsBack, TIER_ORDER } from './stars.js'
import { resetNameTracking } from '../data/names.js'
import { addStory, qualifiedStreak, editionsSinceTitle, isLastDance, careerLine } from './storylines.js'

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
  const pts = { Winner:20, Final:15, 'Semi-finals':10, 'Quarter-finals':6, 'Round of 16':3, Group:1 }
  const recent = [...S.history].reverse().slice(0, 5)
  let ws = 0, ss = 0
  recent.forEach((h, i) => {
    const w = recent.length - i; ws += w
    ss += w * (pts[h.roundReached?.[nationName]] || 0)
  })
  return ws ? Math.round((ss / (ws * 20)) * 20) : 0
}

// ── Star quality bonus — best star's tier lifts qualification odds ──
function starQualityBonus(nation) {
  const stars = nation.stars || []
  if (!stars.length) return 0
  const tierPts = { generational:16, legendary:11, epic:7, rare:4, uncommon:2, common:0 }
  // Sum all three stars but weight the best one most
  const vals = stars.map(s => tierPts[s.tier] || 0).sort((a,b) => b-a)
  return (vals[0] || 0) + (vals[1] || 0) * 0.4 + (vals[2] || 0) * 0.2
}

// ── Season rating = base(80%) + hist + star quality, then ±7 noise ──
function seasonRating(nation) {
  const hist = histPts(nation.name)
  const stars = starQualityBonus(nation)
  const raw = nation.base * 0.80 + hist + stars
  return clamp(Math.round(raw + gauss(3, 7)), 40, 120)
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

  // Host already chosen by startNewWC (or pick now for first WC)
  if (!S.hostNation) {
    S.hostNation = ALL_NATIONS[Math.floor(Math.random() * ALL_NATIONS.length)].name
  }

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

  // Fill to 32
  while (qualified.length < 32) {
    const pool = ALL_NATIONS.filter(n => !qualSet.has(n.name))
    if (!pool.length) break
    const n = pool[Math.floor(Math.random() * pool.length)]
    qualified.push(n); qualSet.add(n.name)
  }

  // Host's confederation (for the +4 bonus)
  const hostNation = ALL_NATIONS.find(n => n.name === S.hostNation)
  const hostConf = hostNation?.conf

  // Build team objects (32) with host & confederation stat bonuses
  S.teams = shuffle(qualified.slice(0, 32)).map(nation => {
    const isHost = nation.name === S.hostNation
    const sameConf = !isHost && nation.conf === hostConf
    // Host +8 to all stats, same-confederation +4
    const bonus = isHost ? 8 : sameConf ? 4 : 0
    const baseStats = nation.stats || rollStats(nation.tier || 'rest')
    const stats = bonus ? {
      attack: baseStats.attack + bonus, defense: baseStats.defense + bonus,
      stamina: baseStats.stamina + bonus, mental: baseStats.mental + bonus,
      setPieces: baseStats.setPieces + bonus,
    } : baseStats
    const rating = seasonRating(nation) + bonus
    return {
      name: nation.name, cc: nation.cc, conf: nation.conf,
      tier: nation.tier || 'rest',
      stats, rating,
      stars: linkStarsToTeam(nation),
      soul: getSoul(nation.name),
      isHost, hostConfBonus: sameConf,
      mentalityDelta: 0,
      w:0, d:0, l:0, gf:0, ga:0, pts:0,
    }
  })

  S.roundReached = {}
  S.teamGoals = {}; S.teamGoalsConceded = {}
  S.allMatchResults = []; S.scorers = {}
  S.seasonAwards = {}
  S.storylines = []

  // ── Qualification storylines ──
  const qualSet2 = new Set(S.teams.map(t => t.name))
  ALL_NATIONS.forEach(n => {
    const big = n.tier === 'top' || (n.hist || 0) >= 30
    if (big && !qualSet2.has(n.name)) {
      const streak = qualifiedStreak(n.name)
      const total = S.history?.length || 0
      if (total >= 2 && streak === total) {
        addStory('💥', `SHOCK: ${n.name} fail to qualify for the first time ever!`)
      } else if (streak >= 2) {
        addStory('💥', `${n.name} miss the World Cup after ${streak} straight editions!`)
      } else {
        addStory('❌', `${n.name} fail to qualify for World Cup #${S.wcNumber}.`)
      }
    }
    if (n.tier === 'rest' && qualSet2.has(n.name)) {
      const gem = (n.stars || []).find(st => ['generational','legendary'].includes(st.tier))
      if (gem) addStory('🌟', `${n.name}, powered by ${gem.tier} ${gem.pos} ${gem.name}, reach the World Cup!`)
    }
  })
  addStory('🏟️', `${S.hostNation} host World Cup #${S.wcNumber}.`)
}

// ── Draw 8 groups of 4 ────────────────────────────────────────
export function drawGroups() {
  const sorted = [...S.teams].sort((a, b) => b.rating - a.rating)
  const pot1 = sorted.slice(0, 8)   // top 8 seeded, one per group
  const rest = shuffle(sorted.slice(8))

  S.groups = Array.from({ length: 8 }, (_, i) => ({
    id: String.fromCharCode(65 + i),
    teams: [pot1[i]]
  }))

  // Distribute rest: max 1 per confederation per group where possible
  for (const team of rest) {
    const eligible = S.groups.filter(g => {
      if (g.teams.length >= 4) return false
      return !g.teams.some(t => t.conf === team.conf)
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
  // Count goals scored THIS match only (timeline holds per-match goal events).
  // Using s.goals here would double-count since it's a cumulative total.
  ;(r.timeline || []).forEach(ev => {
    if (ev.isStar && ev.scorerName) S.scorers[ev.scorerName] = (S.scorers[ev.scorerName]||0) + 1
  })
  // Track shots and possession per team for Tournament stats
  const m1 = S.teams?.find(t=>t.name===r.t1.name), m2 = S.teams?.find(t=>t.name===r.t2.name)
  if (m1) { m1.totalShots=(m1.totalShots||0)+(r.shots1||0); m1.avgPoss=((m1.avgPoss||0)+r.possession1)/((m1.matchCount||0)+1); m1.matchCount=(m1.matchCount||0)+1 }
  if (m2) { m2.totalShots=(m2.totalShots||0)+(r.shots2||0); m2.avgPoss=((m2.avgPoss||0)+r.possession2)/((m2.matchCount||0)+1); m2.matchCount=(m2.matchCount||0)+1 }
  // Biggest win record (all-time)
  const margin = Math.abs(r.g1 - r.g2)
  S.records = S.records || {}
  if (margin >= 3 && (!S.records.biggestWin || margin > S.records.biggestWin.margin)) {
    const w = r.g1 > r.g2
    S.records.biggestWin = { winner: w?r.t1.name:r.t2.name, loser: w?r.t2.name:r.t1.name, g1: Math.max(r.g1,r.g2), g2: Math.min(r.g1,r.g2), margin, wc: S.wcNumber }
  }
}

export function groupStandings(grp) {
  return [...grp.teams].sort((a, b) =>
    (b.pts||0)-(a.pts||0) || (b.gd||0)-(a.gd||0) || (b.gf||0)-(a.gf||0))
}

// ── Build knockout (top 2 from each of 8 groups = 16 → R16) ──
export function buildKnockout() {
  const winners = [], runners = []
  S.groups.forEach(grp => {
    const standings = groupStandings(grp)
    if (standings[0]) { winners.push({ team: standings[0], gi: grp.id }); S.roundReached[standings[0].name] = 'Round of 16' }
    if (standings[1]) { runners.push({ team: standings[1], gi: grp.id }); S.roundReached[standings[1].name] = 'Round of 16' }
    standings.slice(2).forEach(t => { S.roundReached[t.name] = 'Group' })
  })

  // ── Group-exit storylines ──
  S.teams.forEach(t => {
    if (S.roundReached[t.name] !== 'Group') return
    if (t.tier === 'top') addStory('💥', `SHOCK: ${t.name} are eliminated in the group stage!`)
    if (t.isHost) addStory('😢', `Hosts ${t.name} crash out in the groups.`)
    ;(t.stars || []).forEach(st => {
      if (isLastDance(st)) addStory('👋', `That was the last dance for ${st.name} (${t.name}) — ${careerLine(st)}. A group-stage farewell.`)
    })
  })

  // Draw: each group winner gets a random runner-up from a DIFFERENT group.
  const shuffledWinners = shuffle([...winners])
  const availableRunners = shuffle([...runners])
  const matches = []
  for (const w of shuffledWinners) {
    // pick a runner-up not from the same group, if possible
    let idx = availableRunners.findIndex(r => r.gi !== w.gi)
    if (idx === -1) idx = 0
    const r = availableRunners.splice(idx, 1)[0]
    matches.push({ t1: w.team, t2: r.team, played:false, result:null })
  }
  S.knockoutRounds = [{ name:'Round of 16', matches }]
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

  // ── Knockout-exit storylines ──
  losers.forEach(t => {
    if (t.isHost) addStory('😢', `Hosts ${t.name} are knocked out in the ${round.name}.`)
    ;(t.stars || []).forEach(st => {
      if (isLastDance(st)) addStory('👋', `That was the last dance for ${st.name} (${t.name}) — ${careerLine(st)}. Out in the ${round.name}.`)
    })
  })

  if (winners.length === 1) {
    S.champion = winners[0]
    S.roundReached[winners[0].name] = 'Winner'
    if (losers[0]) S.roundReached[losers[0].name] = 'Final'
    S.phase = 'done'
    finalizeWC()
    return
  }

  const nextName = { 16:'Round of 16', 8:'Quarter-finals', 4:'Semi-finals', 2:'Final' }[winners.length] || 'Next Round'
  const newMatches = []
  for (let i = 0; i < winners.length; i += 2)
    newMatches.push({ t1:winners[i], t2:winners[i+1], played:false, result:null })
  S.knockoutRounds.push({ name:nextName, matches:newMatches })
  autoSave()
}

function finalizeWC() {
  const famePts = { Winner:300, Final:150, 'Semi-finals':75, 'Quarter-finals':30, 'Round of 16':12, Group:0 }
  // Determine final standings: champion, runner-up (Final loser), 3rd/4th (SF losers)
  const finishOrder = { Winner:6, Final:5, 'Semi-finals':4, 'Quarter-finals':3, 'Round of 16':2, Group:1 }
  const rankByFinish = (S.teams || [])
    .map(t => ({ name:t.name, cc:t.cc, reached:S.roundReached[t.name]||'Group',
                 gd:(t.gf||0)-(t.ga||0), gf:t.gf||0 }))
    .sort((a,b) => (finishOrder[b.reached]-finishOrder[a.reached]) || (b.gd-a.gd) || (b.gf-a.gf))
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

  // ── Champion storylines (computed against PRIOR history) ──
  const champName = S.champion.name
  const prevTitles = (S.history || []).filter(h => h.champion === champName).length
  const lastChamp = S.history?.[S.history.length - 1]?.champion
  if (prevTitles === 0) {
    addStory('🏆', `${champName} are World Champions for the FIRST TIME in their history!`)
  } else if (lastChamp === champName) {
    addStory('🏆', `BACK-TO-BACK! ${champName} defend their crown — title #${prevTitles + 1}!`)
  } else {
    const since = editionsSinceTitle(champName)
    if (since && since >= 4) addStory('🏆', `${champName} end the drought — first title in ${since} editions! (#${prevTitles + 1} overall)`)
    else addStory('🏆', `${champName} win World Cup #${S.wcNumber} — title #${prevTitles + 1}!`)
  }
  ;(S.champion.stars || []).forEach(st => {
    if (isLastDance(st)) addStory('✨', `Fairytale ending: ${st.name} retires on top of the world — ${careerLine(st)}.`)
  })

  // ── Records ──
  S.records = S.records || {}
  if (topScorer && (!S.records.mostGoalsOneWC || topGoals > S.records.mostGoalsOneWC.goals)) {
    S.records.mostGoalsOneWC = { name:topScorer.name, team:topScorer.teamName, goals:topGoals, wc:S.wcNumber }
  }

  // ── Per-team season records (for modals & team records page) ──
  const teamSeasons = (S.teams || []).map(t => {
    // games played this edition
    const ko = (t.w||0)+(t.d||0)+(t.l||0) // group games tracked in w/d/l; add KO games below
    let koGames = 0, koGf = 0, koGa = 0
    ;(S.allMatchResults || []).forEach(m => {
      if (m.phase !== 'knockout') return
      if (m.t1name === t.name) { koGames++; koGf += m.g1; koGa += m.g2 }
      else if (m.t2name === t.name) { koGames++; koGf += m.g2; koGa += m.g1 }
    })
    return {
      name: t.name, cc: t.cc,
      reached: S.roundReached[t.name] || 'Group',
      games: ko + koGames,
      gf: (t.gf||0) + koGf,
      ga: (t.ga||0) + koGa,
      w: t.w||0, d: t.d||0, l: t.l||0,
    }
  })

  // ── Per-player season records (goals + games this edition) ──
  const playerSeasons = []
  ;(S.teams || []).forEach(t => (t.stars || []).forEach(s => {
    const games = (s.ratings?.length) || 0
    if (games > 0 || (S.scorers[s.name]||0) > 0) {
      playerSeasons.push({
        name: s.name, cc: t.cc, team: t.name, pos: s.pos, tier: s.tier,
        goals: S.scorers[s.name] || 0, games,
        reached: S.roundReached[t.name] || 'Group',
      })
    }
  }))

  S.history = S.history || []
  S.history.push({
    wcNumber: S.wcNumber,
    champion: S.champion.name, cc: S.champion.cc,
    runnerUp: rankByFinish[1] || null,
    third: rankByFinish[2] || null,
    fourth: rankByFinish[3] || null,
    host: S.hostNation,
    roundReached: { ...S.roundReached },
    topScorers: Object.entries(S.scorers||{}).sort((a,b)=>b[1]-a[1]).slice(0,5),
    totalGoals: Object.values(S.teamGoals||{}).reduce((a,b)=>a+b,0),
    awards: { ...S.seasonAwards },
    teamSeasons,
    playerSeasons,
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
  resetNameTracking()

  // Pick the host for the upcoming WC
  S.hostNation = ALL_NATIONS[Math.floor(Math.random() * ALL_NATIONS.length)].name

  // Capture rating shifts: compare each top/mid nation's new season rating
  // vs their previous one (form swings between cycles)
  const ratingChanges = []
  ALL_NATIONS.forEach(n => {
    const prev = n._lastRating ?? n.base
    const next = seasonRating(n)
    n._lastRating = next
    if (Math.abs(next - prev) >= 4 && (n.tier === 'top' || n.tier === 'mid')) {
      ratingChanges.push({ name:n.name, cc:n.cc, prev, next, delta: next - prev })
    }
  })
  ratingChanges.sort((a,b) => Math.abs(b.delta) - Math.abs(a.delta))

  const { retiring, debuting } = ageAllStars(S.wcNumber)

  // ── Legends archive (for GOAT & records pages) ──
  S.legends = S.legends || []
  retiring.forEach(st => {
    const notable = ['epic','legendary','generational'].includes(st.tier)
      || (st.medals?.gold || 0) > 0 || (st.careerGoals || 0) >= 10
    if (notable) {
      S.legends.push({
        name: st.name, cc: st.cc, teamName: st.teamName, pos: st.pos, tier: st.tier,
        careerGoals: st.careerGoals || 0, fame: st.fame || 0,
        medals: { ...(st.medals || {}) }, wcsPlayed: st.wcsPlayed || 0,
        retiredWC: S.wcNumber,
      })
    }
  })

  return { retiring, debuting, host: S.hostNation, ratingChanges: ratingChanges.slice(0, 8) }
}

export { initAllStars, ageAllStars }

// ── World Cup Match Engine ────────────────────────────────────
// Pipeline: Stats → match stats (shots/corners/possession)
//         → raw goals → normalize → star effects → mentality

export const rand   = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a
export const clamp  = (v, a, b) => Math.max(a, Math.min(b, v))
export const pick   = arr => arr[Math.floor(Math.random() * arr.length)]
export const shuffle = a => { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]} return b }
export const gaussRand = (sig = 1) => {
  let u = 0, v = 0
  while (!u) u = Math.random()
  while (!v) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sig
}
export const ovr = s => s ? Math.round((s.attack+s.defense+s.stamina+s.mental+s.setPieces)/5) : 0

// Star tier multipliers for stat bonuses
export const STAR_MULT = { generational:2.2, legendary:1.8, epic:1.5, rare:1.25, uncommon:1.1, common:1.0 }

// ── Per-tier stat bonuses (CL-style) ─────────────────────────
// Higher tiers unlock more stats AND bigger numbers.
// Raw values — multiplied by STAR_MULT in getEffStats.
export const STAR_BONUSES = {
  FWD: {
    common:       { attack:3, stamina:2 },
    uncommon:     { attack:5, stamina:5, mental:2 },
    rare:         { attack:7, stamina:6, mental:6, setPieces:5 },
    epic:         { attack:8, stamina:7, mental:7, setPieces:6 },
    legendary:    { attack:11, stamina:10, mental:11, setPieces:9 },
    generational: { attack:14, stamina:13, mental:14, setPieces:11 },
  },
  MID: {
    common:       { mental:2, attack:2, defense:2 },
    uncommon:     { mental:5, attack:5, defense:3, stamina:2 },
    rare:         { mental:7, attack:6, defense:5, stamina:5, setPieces:4 },
    epic:         { mental:8, attack:7, defense:6, stamina:6, setPieces:5 },
    legendary:    { mental:11, attack:10, defense:9, stamina:9, setPieces:8 },
    generational: { mental:14, attack:13, defense:11, stamina:11, setPieces:10 },
  },
  DEF: {
    common:       { defense:3, stamina:2 },
    uncommon:     { defense:5, stamina:5, mental:2 },
    rare:         { defense:7, stamina:6, mental:6, setPieces:5, attack:2 },
    epic:         { defense:8, stamina:7, mental:7, setPieces:6, attack:3 },
    legendary:    { defense:11, stamina:10, mental:11, setPieces:8, attack:4 },
    generational: { defense:14, stamina:13, mental:14, setPieces:10, attack:5 },
  },
  GK: {
    common:       { defense:3 },
    uncommon:     { defense:5, mental:2 },
    rare:         { defense:7, mental:5 },
    epic:         { defense:8, mental:7 },
    legendary:    { defense:11, mental:11 },
    generational: { defense:14, mental:14 },
  },
}

// Goal distribution per position × tier — [P(0g),P(1g),P(2g),P(3g),P(4g)]
export const GOAL_DIST = {
  FWD: {
    common:       [0.74, 0.22, 0.04, 0.00, 0.00],
    uncommon:     [0.68, 0.26, 0.06, 0.00, 0.00],
    rare:         [0.60, 0.30, 0.09, 0.01, 0.00],
    epic:         [0.52, 0.34, 0.12, 0.02, 0.00],
    legendary:    [0.42, 0.38, 0.16, 0.04, 0.00],
    generational: [0.34, 0.40, 0.20, 0.05, 0.01],
  },
  MID: {
    common:       [0.88, 0.11, 0.01, 0.00, 0.00],
    uncommon:     [0.84, 0.14, 0.02, 0.00, 0.00],
    rare:         [0.78, 0.19, 0.03, 0.00, 0.00],
    epic:         [0.70, 0.25, 0.05, 0.00, 0.00],
    legendary:    [0.62, 0.30, 0.07, 0.01, 0.00],
    generational: [0.54, 0.35, 0.10, 0.01, 0.00],
  },
  DEF: {
    common:       [0.96, 0.04, 0.00, 0.00, 0.00],
    uncommon:     [0.94, 0.06, 0.00, 0.00, 0.00],
    rare:         [0.90, 0.09, 0.01, 0.00, 0.00],
    epic:         [0.86, 0.13, 0.01, 0.00, 0.00],
    legendary:    [0.80, 0.17, 0.03, 0.00, 0.00],
    generational: [0.74, 0.22, 0.04, 0.00, 0.00],
  },
  GK: {
    common:       [1.00, 0.00, 0.00, 0.00, 0.00],
    uncommon:     [1.00, 0.00, 0.00, 0.00, 0.00],
    rare:         [1.00, 0.00, 0.00, 0.00, 0.00],
    epic:         [0.99, 0.01, 0.00, 0.00, 0.00],
    legendary:    [0.98, 0.02, 0.00, 0.00, 0.00],
    generational: [0.97, 0.03, 0.00, 0.00, 0.00],
  },
}

// Save probability per opposing goal for DEF/GK
export const SAVE_PROB = {
  GK:  { common:0.12, uncommon:0.20, rare:0.32, epic:0.50, legendary:0.70, generational:0.85 },
  DEF: { common:0.06, uncommon:0.12, rare:0.22, epic:0.35, legendary:0.50, generational:0.65 },
}

// ── Effective stats (base stats + all 3 star bonuses + morale) ──
export function getEffStats(team, isKO = false) {
  const base = team.stats || { attack:75, defense:75, stamina:75, mental:75, setPieces:75 }
  let s = { ...base }

  // Star bonuses (3 stars per team, per-tier stat tables)
  for (const star of (team.stars || [])) {
    if (!star) continue
    // Get the tier-specific bonus table for this position
    const bonusTable = STAR_BONUSES[star.pos] || STAR_BONUSES.MID
    const fx = bonusTable[star.tier] || bonusTable.common || {}
    const mult = (STAR_MULT[star.tier] || 1.0) * (star.careerMult ?? 1.0)
    s.attack    = clamp(s.attack    + Math.round((fx.attack    || 0) * mult), 10, 130)
    s.defense   = clamp(s.defense   + Math.round((fx.defense   || 0) * mult), 10, 130)
    s.stamina   = clamp(s.stamina   + Math.round((fx.stamina   || 0) * mult), 10, 130)
    s.mental    = clamp(s.mental    + Math.round((fx.mental    || 0) * mult), 10, 130)
    s.setPieces = clamp(s.setPieces + Math.round((fx.setPieces || 0) * mult), 10, 130)
  }

  // Morale (mentalityDelta) — capped tight so it nudges, never dominates
  const md = team.mentalityDelta || 0
  if (md !== 0) {
    s.mental  = clamp(s.mental  + md * 0.5, 10, 130)
    s.attack  = clamp(s.attack  + md * 0.25, 10, 130)
    s.defense = clamp(s.defense + md * 0.25, 10, 130)
  }

  // Soul bonuses (nation's playing style)
  if (team.soul?.fx) {
    const fx = team.soul.fx
    s.attack    = clamp(s.attack    + (fx.attack    || 0), 10, 130)
    s.defense   = clamp(s.defense   + (fx.defense   || 0), 10, 130)
    s.stamina   = clamp(s.stamina   + (fx.stamina   || 0), 10, 130)
    s.mental    = clamp(s.mental    + (fx.mental    || 0), 10, 130)
    s.setPieces = clamp(s.setPieces + (fx.setPieces || 0), 10, 130)
  }
  // Tactical-role fit: coherent combinations become more than the sum of their parts.
  const roles=(team.stars||[]).map(x=>x?.role).filter(Boolean)
  const style=(team.soul?.name||'').toLowerCase()
  const has=r=>roles.includes(r)
  if(style.includes('tiki')){
    if(has('False Nine')) { s.attack+=3; s.mental+=3 }
    if(roles.filter(r=>r==='Deep-Lying Playmaker').length>=1) { s.mental+=4; s.defense+=2 }
    if(has('Ball-Playing Centre-Back')) { s.mental+=2; s.defense+=2 }
    if(has('Striker')&&has('Box-to-Box')&&has('Physical Centre-Back')) { s.mental-=3; s.attack-=2 }
  } else {
    if(has('Winger')&&has('Striker')) { s.attack+=5; s.setPieces+=2 }
    if(has('Box-to-Box')) { s.stamina+=3; s.mental+=1 }
    if(has('Physical Centre-Back')) s.defense+=3
  }
  if(has('Sweeper Keeper')) { s.mental+=2; s.defense+=1 }
  return Object.fromEntries(Object.entries(s).map(([k,v])=>[k,clamp(v,10,130)]))
}

// ── Match statistics (shots / possession / corners) ───────────
// Damping: softens stat differences. Tuned so a 10pt gap is a clear
// favorite (~70%) but upsets still happen, and a 24pt gap is near-decisive.
function dampDiff(gap) {
  const a = Math.abs(gap)
  const damped = a <= 12 ? a * 0.58 : 12 * 0.58 + (a - 12) * 0.42
  return Math.sign(gap) * damped
}

function computeMatchStats(myE, oppE) {
  // First 60 minutes
  let shots60  = 9 + dampDiff(myE.attack - oppE.defense) + (myE.mental - oppE.mental) * 0.04 + gaussRand(2.5)
  shots60 = clamp(shots60, 2, 20)
  let poss60   = 0.5 + dampDiff(myE.attack - oppE.attack) * 0.012 + dampDiff(myE.mental - oppE.mental) * 0.012 + gaussRand(0.04)
  poss60 = clamp(poss60, 0.30, 0.70)
  let corners60 = 4 + dampDiff(myE.attack - oppE.defense) * 0.55 + (myE.setPieces - 70) * 0.04 + gaussRand(1)
  corners60 = clamp(corners60, 0, 14)

  // Last 30 minutes — stamina shapes both teams
  const stamDiff = myE.stamina - oppE.stamina
  let shots30  = (shots60 / 2) + dampDiff(stamDiff) * 0.7 + gaussRand(1)
  shots30 = clamp(shots30, 1, 12)
  let poss30   = clamp(0.5 + (poss60 - 0.5) * 0.6 + clamp(stamDiff / 100, -0.20, 0.20), 0.30, 0.70)
  let corners30 = (corners60 / 2) + dampDiff(stamDiff) * 0.18 + gaussRand(0.7)
  corners30 = clamp(corners30, 0, 10)

  const shots=Math.round(shots60+shots30)
  const accuracy=clamp(.27+(myE.attack-70)*.003+(myE.mental-70)*.0015, .20, .58)
  const shotsOnTarget=clamp(Math.round(shots*accuracy+gaussRand(1)),0,shots)
  const xg=Math.max(.05, shotsOnTarget*.22 + Math.max(0,shots-shotsOnTarget)*.035 + Math.max(0,myE.attack-oppE.defense)*.018)
  return { shots, shotsOnTarget, xg:+xg.toFixed(2), corners:Math.round(corners60+corners30), possShare:clamp(poss60*.67+poss30*.33,.25,.75) }
}

// ── Stats → raw goals ─────────────────────────────────────────
function statsToGoals(matchStats, myE, possessionPct, oppE) {
  const spGap = myE.setPieces - 85
  // Skill gap vs opponent's defense raises conversion — dominant sides rout.
  const skillGap = oppE ? (myE.attack - oppE.defense) : 0
  const gapBonus = clamp(skillGap * 0.005, -0.05, 0.13)
  const convMax = clamp(0.13 + spGap / 1400 + gapBonus, 0.09, 0.36)
  const conv = Math.random() * convMax
  let shotGoals   = matchStats.xg * (0.62 + Math.random()*0.78) + matchStats.shotsOnTarget * conv * 0.35
  let possGoals   = possessionPct >= 72 ? 1 : 0
  let cornerConv  = clamp(0.025 + spGap * 0.0008, 0.01, 0.07)
  let cornerGoals = matchStats.corners * cornerConv
  return Math.max(0, shotGoals + possGoals + cornerGoals)
}

// ── Normalize raw float goals to realistic integer score ──────
function normalize(raw) {
  if (raw <= 1) return Math.round(raw)
  if (raw >= 12) return Math.min(7, Math.round(0.55 * (raw - 1)))
  return Math.min(Math.round(0.62 * (raw - 1)), 7)
}
function preserveWinner(rA, rB, nA, nB) {
  if (rA > rB) { if (nA <= nB) nA = Math.min(7, nB + 1) }
  else if (rB > rA) { if (nB <= nA) nB = Math.min(7, nA + 1) }
  else { if (nA !== nB) nB = nA }
  return [nA, nB]
}

// ── Star in-match effects (GOAL_DIST + SAVE_PROB) ────────────
function rollGoalDist(star) {
  const dist = (GOAL_DIST[star.pos] || GOAL_DIST.MID)[star.tier] || GOAL_DIST.MID.common
  const r = Math.random()
  let acc = 0
  for (let i = 0; i < dist.length; i++) {
    acc += dist[i]
    if (r < acc) return i
  }
  return 0
}

function applyStarEffects(stars, myG, oppG, myName, effects) {
  // Only ONE attacking star can add a goal per match (the best one).
  // The rest contribute through their stat bonuses (already in getEffStats),
  // so we don't double-count by stacking everyone's goal rolls.
  const attackers = (stars || []).filter(s => s && ['FWD','MID'].includes(s.pos))
  const tierRank = { generational:6, legendary:5, epic:4, rare:3, uncommon:2, common:1 }
  attackers.sort((a,b) => (tierRank[b.tier]||0) - (tierRank[a.tier]||0))
  const topAttacker = attackers[0]

  if (topAttacker) {
    const goals = rollGoalDist(topAttacker)
    if (goals > 0) {
      // Track intended match goals for timeline attribution priority.
      // Cumulative s.goals is set later from the actual (capped) timeline.
      topAttacker._matchGoals = (topAttacker._matchGoals || 0) + goals
      myG += goals
      const labels = ['','scores','scores a brace','hat-trick!','4 goals!!']
      effects.push(`⭐ ${topAttacker.name} ${labels[goals] || `scores ${goals}`} for ${myName}!`)
    }
  }

  // GK and DEF still provide saves/blocks (defensive — reduces oppG)
  for (const star of (stars || [])) {
    if (!star) continue
    if (star.pos === 'GK') {
      const saveProb = (SAVE_PROB.GK)[star.tier] || 0.12
      let saved = 0
      for (let i = 0; i < oppG; i++) if (Math.random() < saveProb) { saved++; }
      if (saved > 0) { oppG -= saved; effects.push(`⭐ ${star.name} makes ${saved>1?saved+' incredible saves':'an incredible save'}!`) }
    } else if (star.pos === 'DEF') {
      const blockProb = (SAVE_PROB.DEF)[star.tier] || 0.06
      let blocked = 0
      for (let i = 0; i < oppG; i++) if (Math.random() < blockProb) { blocked++; }
      if (blocked > 0) { oppG -= blocked; effects.push(`⭐ ${star.name} clears ${blocked>1?blocked+' off the line':'off the line'}!`) }
    }
  }
  return [myG, oppG]
}

// ── Mentality change after result ─────────────────────────────
export function calcMentalityChange(myRating, oppRating, myG, oppG) {
  const gap = oppRating - myRating
  const diff = myG - oppG
  let delta = 0
  if (diff > 0) {
    delta += 5
    if (gap > 0) delta += gap * 0.4   // bonus for beating a better team
    if (diff >= 3) delta += 3
    if (diff >= 5) delta += 2
  } else if (diff < 0) {
    const surprise = -gap / 6 - diff
    if (gap >= 8 && diff >= -1) delta += 2  // respectable against giant
    else if (surprise < -1) { delta -= 4; if (diff <= -3) delta -= 2 }
    else delta -= 3
  } else {
    if (gap >= 5) delta += 1   // drew with a giant
    else if (gap <= -5) delta -= 1
  }
  return Math.round(delta)
}

// ── Star per-match rating ─────────────────────────────────────
function calcStarRating(pos, tier, gf, ga, myShots, oppShots, poss, starGoals, myOvr, oppOvr) {
  const won = gf > ga, cs = ga === 0
  let r = 6.0
  r += won ? 0.4 : gf === ga ? 0 : -0.3
  if (pos === 'FWD') {
    r += starGoals * 1.6
    if (starGoals >= 2) r += 0.8
    if (starGoals === 0 && !won) r -= 0.4
    r += (poss - 50) * 0.012
  } else if (pos === 'MID') {
    r += (poss - 50) * 0.035
    if (poss >= 60) r += 0.5
    r += starGoals * 0.8
    r += gf * 0.2 - ga * 0.15
  } else if (pos === 'DEF') {
    if (cs) r += 1.2
    if (cs && oppShots >= 8) r += 0.4
    r -= ga * 0.6
    if (ga >= 3) r -= 0.5
  } else if (pos === 'GK') {
    if (cs) r += 1.6
    if (cs && oppOvr >= 78) r += 0.5
    if (cs && oppShots >= 10) r += 0.4
    r -= ga * 0.85
    if (ga >= 3) r -= 0.6
  }
  r += { generational:0.7, legendary:0.5, epic:0.3, rare:0.18, uncommon:0.08, common:0 }[tier] || 0
  r += gaussRand(0.3)
  return Math.round(clamp(r, 4.0, 10.0) * 10) / 10
}

// ── Main match simulation ─────────────────────────────────────
// Pick a plausible scorer for an extra-time goal (prefer attacking stars)
function pickScorer(stars, team) {
  const attackers = (stars || []).filter(s => s && ['FWD','MID'].includes(s.pos))
  if (attackers.length && Math.random() < 0.7) {
    const s = attackers[Math.floor(Math.random()*attackers.length)]
    s._matchGoals = (s._matchGoals||0) + 1
    return s.name
  }
  return team.name + ' (sub)'
}

export function simMatch(t1, t2, allowDraw = true, isKO = false, roundName = '') {
  const e1 = getEffStats(t1, isKO)
  const e2 = getEffStats(t2, isKO)
  const effects = []

  // Reset per-match goal counters (used for accurate timeline attribution)
  ;[...(t1.stars||[]), ...(t2.stars||[])].forEach(s => { if (s) s._matchGoals = 0 })

  // Stage 1: match stats
  const m1 = computeMatchStats(e1, e2)
  const m2 = computeMatchStats(e2, e1)
  const ts = m1.possShare + m2.possShare
  const possession1 = clamp(Math.round(m1.possShare / ts * 100), 25, 75)
  const possession2 = 100 - possession1
  const shots1 = m1.shots, shots2 = m2.shots
  const corners1 = m1.corners, corners2 = m2.corners
  const shotsOnTarget1=m1.shotsOnTarget, shotsOnTarget2=m2.shotsOnTarget
  const xg1=m1.xg, xg2=m2.xg
  const yellow1=clamp(Math.round(2+gaussRand(1.2)+(e2.attack-e1.defense)*.025),0,7)
  const yellow2=clamp(Math.round(2+gaussRand(1.2)+(e1.attack-e2.defense)*.025),0,7)
  const red1=Math.random()<.035+yellow1*.006?1:0, red2=Math.random()<.035+yellow2*.006?1:0
  const offsides1=clamp(Math.round(shots1*.16+gaussRand(1)),0,7), offsides2=clamp(Math.round(shots2*.16+gaussRand(1)),0,7)

  // Stage 2: raw goals
  let raw1 = statsToGoals(m1, e1, possession1, e2)
  let raw2 = statsToGoals(m2, e2, possession2, e1)

  // Stage 3: normalize
  let g1 = normalize(raw1), g2 = normalize(raw2)
  ;[g1, g2] = preserveWinner(raw1, raw2, g1, g2)

  // Stage 4: star effects (star goals fold into the base, capped)
  const stars1 = t1.stars || [], stars2 = t2.stars || []
  const base1 = g1, base2 = g2
  ;[g1, g2] = applyStarEffects(stars1, g1, g2, t1.name, effects)
  ;[g2, g1] = applyStarEffects(stars2, g2, g1, t2.name, effects)
  // Cap how much one star inflates the score: at most +1 over base, ceiling 6.
  g1 = Math.min(g1, base1 + 1, 6)
  g2 = Math.min(g2, base2 + 1, 6)
  g1 = Math.max(0, g1); g2 = Math.max(0, g2)

  // Soul: catenaccio KO goal cap
  if (isKO && t1.soul?.koGaCap != null) g2 = Math.min(g2, t1.soul.koGaCap)
  if (isKO && t2.soul?.koGaCap != null) g1 = Math.min(g1, t2.soul.koGaCap)
  // Soul: jogo bonito extra goal bonus
  if (t1.soul?.goalBonus && Math.random() < t1.soul.goalBonus) { g1++; effects.push(`✨ ${t1.name} — Jogo Bonito!`) }
  if (t2.soul?.goalBonus && Math.random() < t2.soul.goalBonus) { g2++; effects.push(`✨ ${t2.name} — Jogo Bonito!`) }

  // Stage 5: mentality
  const r1 = ovr(e1), r2 = ovr(e2)
  const d1 = calcMentalityChange(r1, r2, g1, g2)
  const d2 = calcMentalityChange(r2, r1, g2, g1)
  const t1Bef = t1.mentalityDelta || 0, t2Bef = t2.mentalityDelta || 0
  t1.mentalityDelta = clamp(t1Bef + d1, -12, 12)
  t2.mentalityDelta = clamp(t2Bef + d2, -12, 12)

  // Stage 6: extra time / penalties (knockout only)
  let winner = null, penalties = false, extraTime = false
  let etGoals1 = 0, etGoals2 = 0
  if (!allowDraw && g1 === g2) {
    extraTime = true
    // Two 15-min extra periods. Each team has a goal chance per period that
    // scales with their attacking edge. Higher quality = more likely to score.
    const edge = (e1.attack - e2.defense) - (e2.attack - e1.defense)
    const p1 = clamp(0.18 + edge * 0.004, 0.08, 0.34)
    const p2 = clamp(0.18 - edge * 0.004, 0.08, 0.34)
    for (let period = 0; period < 2; period++) {
      if (Math.random() < p1) { g1++; etGoals1++ }
      if (Math.random() < p2) { g2++; etGoals2++ }
    }
    if (g1 !== g2) { winner = g1 > g2 ? t1 : t2; effects.push(`⏱️ Settled in extra time`) }
    else {
      // Penalty shootout
      winner = (e1.mental + rand(-12,12)) >= (e2.mental + rand(-12,12)) ? t1 : t2
      penalties = true; effects.push(`🥅 Penalty shootout — ${winner.name} win!`)
    }
  } else { winner = g1 > g2 ? t1 : g2 > g1 ? t2 : null }

  // Build goal timeline with star attribution (uses this match's intended goals).
  // Extra-time goals are appended at 91-120'.
  const timeline = buildTimeline(t1, g1 - etGoals1, t2, g2 - etGoals2, e1.stamina, e2.stamina, stars1, stars2)
  for (let i = 0; i < etGoals1; i++) timeline.push({ minute: 91 + Math.floor(Math.random()*29), team:1, scorerName: pickScorer(stars1, t1), isStar: (stars1||[]).some(s=>s.pos==='FWD'||s.pos==='MID') })
  for (let i = 0; i < etGoals2; i++) timeline.push({ minute: 91 + Math.floor(Math.random()*29), team:2, scorerName: pickScorer(stars2, t2), isStar: (stars2||[]).some(s=>s.pos==='FWD'||s.pos==='MID') })
  timeline.sort((a,b)=>a.minute-b.minute)

  // Tally each star's ACTUAL goals this match from the (post-cap) timeline,
  // then fold into cumulative totals. Player stats and Golden Boot stay in sync.
  const matchGoalsByName = {}
  timeline.forEach(ev => { if (ev.isStar) matchGoalsByName[ev.scorerName] = (matchGoalsByName[ev.scorerName]||0)+1 })
  ;[...stars1, ...stars2].forEach(s => {
    if (!s) return
    const mg = matchGoalsByName[s.name] || 0
    s._matchGoals = mg
    s.goals = (s.goals || 0) + mg
  })

  // Stage 7: star match ratings (uses this match's goals)
  const starRatings = { team1:[], team2:[] }
  ;[t1, t2].forEach((t, ti) => {
    const myG = ti===0?g1:g2, oppG = ti===0?g2:g1
    const myShots = ti===0?shots1:shots2, oppShots = ti===0?shots2:shots1
    const poss = ti===0?possession1:possession2
    const myEff = ti===0?e1:e2, oppEff = ti===0?e2:e1
    ;(t.stars || []).forEach(s => {
      if (!s) return
      const r = calcStarRating(s.pos, s.tier, myG, oppG, myShots, oppShots, poss, s._matchGoals||0, ovr(myEff), ovr(oppEff))
      if (!s.ratings) s.ratings = []
      s.ratings.push(r)
      starRatings[`team${ti+1}`].push({ name:s.name, pos:s.pos, tier:s.tier, rating:r, goals:s._matchGoals||0 })
    })
  })

  // Build 6 × 15-min tranches
  const MINUTES = [15, 30, 45, 60, 75, 90]
  const tranches = MINUTES.map(minute => {
    const score1  = timeline.filter(ev => ev.team===1 && ev.minute<=minute).length
    const score2  = timeline.filter(ev => ev.team===2 && ev.minute<=minute).length
    const newGoals = timeline.filter(ev => ev.minute>minute-15 && ev.minute<=minute)
    return { minute, score1, score2, newGoals }
  })

  const allRatings=[...starRatings.team1.map(x=>({...x,team:t1.name})),...starRatings.team2.map(x=>({...x,team:t2.name}))]
  const mvp=allRatings.sort((a,b)=>b.rating-a.rating)[0]||null
  const roundWeight=roundName.includes('Final')?1.8:roundName.includes('Semi')?1.3:roundName.includes('Quarter')?1:roundName.includes('16')?0.6:roundName.includes('32')?0.35:0
  const starHeat=[...stars1,...stars2].reduce((a,x)=>a+({generational:.45,legendary:.28,epic:.14,rare:.07}[x?.tier]||0),0)
  const comebackBonus=timeline.some((ev,i)=>{const before=timeline.slice(0,i);let a=before.filter(x=>x.team===1).length,b=before.filter(x=>x.team===2).length;return (ev.team===1&&b-a>=2)||(ev.team===2&&a-b>=2)})?1.2:0
  const action=(g1+g2)*.55+(shots1+shots2)*.035+(shotsOnTarget1+shotsOnTarget2)*.06
  const closeness=Math.max(0,1.2-Math.abs(g1-g2)*.25)
  const quality=+clamp(1+roundWeight+starHeat+comebackBonus+action+closeness+(penalties?.35:0),1,10).toFixed(1)

  return {
    t1, t2, g1, g2, winner, penalties, extraTime, effects,
    shots1, shots2, shotsOnTarget1, shotsOnTarget2, xg1, xg2, corners1, corners2, possession1, possession2,
    yellow1,yellow2,red1,red2,offsides1,offsides2,quality,mvp,
    starRatings, timeline, tranches,
    mentalityChanges: {
      team1: { before:t1Bef, change:d1, after:t1.mentalityDelta },
      team2: { before:t2Bef, change:d2, after:t2.mentalityDelta }
    }
  }
}

function buildTimeline(t1, g1, t2, g2, stam1, stam2, stars1 = [], stars2 = []) {
  const events = []
  const pickMinute = (stam) => {
    const shift = ((clamp(stam,40,110) - 75) / 35) * 12
    return clamp(Math.round(45 + shift + gaussRand(20)), 1, 90)
  }
  // Attribute goals using THIS match's goals (not cumulative career totals)
  const starGoalCounts1 = new Map(), starGoalCounts2 = new Map()
  ;[...stars1].forEach(s => { if ((s._matchGoals||0) > 0) starGoalCounts1.set(s, s._matchGoals) })
  ;[...stars2].forEach(s => { if ((s._matchGoals||0) > 0) starGoalCounts2.set(s, s._matchGoals) })

  for (let i = 0; i < g1; i++) {
    // Find a star with remaining goal credit
    const scorer = [...starGoalCounts1.entries()].find(([,n]) => n > 0)
    if (scorer) { starGoalCounts1.set(scorer[0], scorer[1]-1); events.push({ minute:pickMinute(stam1), team:1, scorerName:scorer[0].name, isStar:true }) }
    else events.push({ minute:pickMinute(stam1), team:1, scorerName:t1.name, isStar:false })
  }
  for (let i = 0; i < g2; i++) {
    const scorer = [...starGoalCounts2.entries()].find(([,n]) => n > 0)
    if (scorer) { starGoalCounts2.set(scorer[0], scorer[1]-1); events.push({ minute:pickMinute(stam2), team:2, scorerName:scorer[0].name, isStar:true }) }
    else events.push({ minute:pickMinute(stam2), team:2, scorerName:t2.name, isStar:false })
  }
  return events.sort((a, b) => a.minute - b.minute)
}

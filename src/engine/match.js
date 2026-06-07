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
export const STAR_MULT = { generational:3.5, legendary:2.5, epic:2.0, rare:1.5, uncommon:1.2, common:1.0 }

// Stat bonuses per position (raw, before tier multiplier)
export const STAR_BONUSES = {
  FWD: { attack:5, setPieces:2 },
  MID: { attack:3, defense:2, mental:4 },
  DEF: { defense:5, stamina:2, setPieces:1 },
  GK:  { defense:5, mental:3 },
}

// ── Effective stats (base stats + all 3 star bonuses + morale) ──
export function getEffStats(team, isKO = false) {
  const base = team.stats || { attack:75, defense:75, stamina:75, mental:75, setPieces:75 }
  let s = { ...base }

  // Star bonuses (3 stars per team)
  for (const star of (team.stars || [])) {
    if (!star?.statBonus) continue
    const mult = (STAR_MULT[star.tier] || 1.0) * (star.careerMult ?? 1.0)
    const fx = star.statBonus
    s.attack    = clamp(s.attack    + Math.round((fx.attack    || 0) * mult), 10, 130)
    s.defense   = clamp(s.defense   + Math.round((fx.defense   || 0) * mult), 10, 130)
    s.stamina   = clamp(s.stamina   + Math.round((fx.stamina   || 0) * mult), 10, 130)
    s.mental    = clamp(s.mental    + Math.round((fx.mental    || 0) * mult), 10, 130)
    s.setPieces = clamp(s.setPieces + Math.round((fx.setPieces || 0) * mult), 10, 130)
  }

  // Morale (mentalityDelta)
  const md = team.mentalityDelta || 0
  if (md !== 0) {
    s.mental  = clamp(s.mental  + md,       10, 130)
    s.attack  = clamp(s.attack  + md * 0.4, 10, 130)
    s.defense = clamp(s.defense + md * 0.4, 10, 130)
  }

  return s
}

// ── Match statistics (shots / possession / corners) ───────────
function dampDiff(gap) { return Math.sign(gap) * Math.sqrt(Math.abs(gap)) * 1.1 }

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

  return {
    shots:   Math.round(shots60 + shots30),
    corners: Math.round(corners60 + corners30),
    possShare: clamp(poss60 * 0.67 + poss30 * 0.33, 0.25, 0.75)
  }
}

// ── Stats → raw goals ─────────────────────────────────────────
function statsToGoals(matchStats, myE, possessionPct) {
  const spGap = myE.setPieces - 70
  const convMax = clamp(0.25 + spGap / 800, 0.18, 0.32)
  const conv = Math.random() * convMax
  let shotGoals   = matchStats.shots * conv
  let possGoals   = possessionPct >= 65 ? 2 : possessionPct >= 55 ? 1 : 0
  let cornerConv  = clamp(0.05 + spGap * 0.0015, 0.01, 0.12)
  let cornerGoals = matchStats.corners * cornerConv
  return Math.max(0, shotGoals + possGoals + cornerGoals)
}

// ── Normalize raw float goals to realistic integer score ──────
function normalize(raw) {
  if (raw <= 1) return Math.round(raw)
  if (raw >= 11) return Math.min(7, Math.round(0.55 * (raw - 1)))
  return Math.min(Math.round(0.65 * (raw - 1)), 7)
}
function preserveWinner(rA, rB, nA, nB) {
  if (rA > rB) { if (nA <= nB) nA = Math.min(7, nB + 1) }
  else if (rB > rA) { if (nB <= nA) nB = Math.min(7, nA + 1) }
  else { if (nA !== nB) nB = nA }
  return [nA, nB]
}

// ── Star in-match effects ─────────────────────────────────────
function applyStarEffects(stars, myG, oppG, myName, effects) {
  for (const star of (stars || [])) {
    if (!star) continue
    const t = star.tier
    if (star.pos === 'FWD') {
      const gc = { generational:0.92, legendary:0.75, epic:0.55, rare:0.35, uncommon:0.20, common:0.10 }[t] || 0.10
      if (Math.random() < gc) {
        myG++; star.goals = (star.goals || 0) + 1
        effects.push(`⭐ ${star.name} scores for ${myName}!`)
        if (['generational','legendary'].includes(t) && Math.random() < 0.40) {
          myG++; star.goals++
          effects.push(`⭐ ${star.name} scores again — brace!`)
        }
      }
    } else if (star.pos === 'MID') {
      const gc = { generational:0.55, legendary:0.38, epic:0.24, rare:0.13, uncommon:0.07, common:0.02 }[t] || 0.02
      if (Math.random() < gc) { myG++; star.goals = (star.goals || 0) + 1; effects.push(`⭐ ${star.name} drives forward and scores!`) }
    } else if (star.pos === 'GK') {
      const sc = { generational:0.88, legendary:0.68, epic:0.50, rare:0.32, uncommon:0.17, common:0.08 }[t] || 0.08
      if (oppG > 0 && Math.random() < sc) { oppG--; effects.push(`⭐ ${star.name} makes an incredible save!`) }
    } else if (star.pos === 'DEF') {
      const cc = { generational:0.78, legendary:0.58, epic:0.40, rare:0.25, uncommon:0.13, common:0.06 }[t] || 0.06
      if (oppG > 0 && Math.random() < cc) { oppG--; effects.push(`⭐ ${star.name} clears off the line!`) }
      const sp = { generational:0.40, legendary:0.25, epic:0.14, rare:0.07, uncommon:0.03, common:0.01 }[t] || 0.01
      if (Math.random() < sp) { myG++; star.goals = (star.goals || 0) + 1; effects.push(`⭐ ${star.name} heads in from a corner!`) }
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
export function simMatch(t1, t2, allowDraw = true, isKO = false) {
  const e1 = getEffStats(t1, isKO)
  const e2 = getEffStats(t2, isKO)
  const effects = []

  // Stage 1: match stats
  const m1 = computeMatchStats(e1, e2)
  const m2 = computeMatchStats(e2, e1)
  const ts = m1.possShare + m2.possShare
  const possession1 = clamp(Math.round(m1.possShare / ts * 100), 25, 75)
  const possession2 = 100 - possession1
  const shots1 = m1.shots, shots2 = m2.shots
  const corners1 = m1.corners, corners2 = m2.corners

  // Stage 2: raw goals
  let raw1 = statsToGoals(m1, e1, possession1)
  let raw2 = statsToGoals(m2, e2, possession2)

  // Stage 3: normalize
  let g1 = normalize(raw1), g2 = normalize(raw2)
  ;[g1, g2] = preserveWinner(raw1, raw2, g1, g2)

  // Stage 4: star effects
  const stars1 = t1.stars || [], stars2 = t2.stars || []
  ;[g1, g2] = applyStarEffects(stars1, g1, g2, t1.name, effects)
  ;[g2, g1] = applyStarEffects(stars2, g2, g1, t2.name, effects)
  g1 = Math.max(0, g1); g2 = Math.max(0, g2)

  // Stage 5: mentality
  const r1 = ovr(e1), r2 = ovr(e2)
  const d1 = calcMentalityChange(r1, r2, g1, g2)
  const d2 = calcMentalityChange(r2, r1, g2, g1)
  const t1Bef = t1.mentalityDelta || 0, t2Bef = t2.mentalityDelta || 0
  t1.mentalityDelta = clamp(t1Bef + d1, -20, 20)
  t2.mentalityDelta = clamp(t2Bef + d2, -20, 20)

  // Stage 6: extra time / penalties
  let winner = null, penalties = false
  if (!allowDraw && g1 === g2) {
    g1 += Math.random() < 0.22 ? 1 : 0
    g2 += Math.random() < 0.22 ? 1 : 0
    if (g1 !== g2) { winner = g1 > g2 ? t1 : t2 }
    else {
      winner = (e1.mental + rand(-10,10)) >= (e2.mental + rand(-10,10)) ? t1 : t2
      penalties = true; effects.push(`🥅 Penalties — ${winner.name} win!`)
    }
  } else { winner = g1 > g2 ? t1 : g2 > g1 ? t2 : null }

  // Stage 7: star match ratings
  const starRatings = { team1:[], team2:[] }
  ;[t1, t2].forEach((t, ti) => {
    const myG = ti===0?g1:g2, oppG = ti===0?g2:g1
    const myShots = ti===0?shots1:shots2, oppShots = ti===0?shots2:shots1
    const poss = ti===0?possession1:possession2
    const myEff = ti===0?e1:e2, oppEff = ti===0?e2:e1
    ;(t.stars || []).forEach(s => {
      if (!s) return
      const r = calcStarRating(s.pos, s.tier, myG, oppG, myShots, oppShots, poss, s.goals||0, ovr(myEff), ovr(oppEff))
      if (!s.ratings) s.ratings = []
      s.ratings.push(r)
      starRatings[`team${ti+1}`].push({ name:s.name, pos:s.pos, tier:s.tier, rating:r, goals:s.goals||0 })
    })
  })

  // Build goal timeline
  const timeline = buildTimeline(t1, g1, t2, g2, e1.stamina, e2.stamina)

  return {
    t1, t2, g1, g2, winner, penalties, effects,
    shots1, shots2, corners1, corners2, possession1, possession2,
    starRatings, timeline,
    mentalityChanges: {
      team1: { before:t1Bef, change:d1, after:t1.mentalityDelta },
      team2: { before:t2Bef, change:d2, after:t2.mentalityDelta }
    }
  }
}

function buildTimeline(t1, g1, t2, g2, stam1, stam2) {
  const events = []
  const pickMinute = (stam) => {
    const shift = ((clamp(stam,40,110) - 75) / 35) * 12
    return clamp(Math.round(45 + shift + gaussRand(20)), 1, 90)
  }
  for (let i = 0; i < g1; i++) events.push({ minute: pickMinute(stam1), team: 1, name: t1.name })
  for (let i = 0; i < g2; i++) events.push({ minute: pickMinute(stam2), team: 2, name: t2.name })
  return events.sort((a, b) => a.minute - b.minute)
}

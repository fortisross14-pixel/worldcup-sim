import { ALL_NATIONS, rollStarTier, getSoul } from '../data/nations.js'
import { STAR_BONUSES, GOAL_DIST, SAVE_PROB, rand } from './match.js'
import { getPlayerName, resetNameTracking } from '../data/names.js'
import { S } from '../store.js'
import { eraStarMultiplier, wcYear } from './era.js'

export const TIER_LABELS = {
  generational:'Generational', legendary:'Legendary', epic:'Epic',
  rare:'Rare', uncommon:'Uncommon', common:'Common'
}
export const TIER_COLORS = {
  generational:'#ff3b6b', legendary:'#ffcb2b', epic:'#7b5cff',
  rare:'#21e6c1', uncommon:'#3ad17e', common:'#8a85a3'
}
export const TIER_ORDER = ['generational','legendary','epic','rare','uncommon','common']

// Career length is independent from rarity; position affects longevity instead.
const POSITION_LIFESPANS = { GK:[3,7], DEF:[2,6], MID:[2,5], FWD:[2,5] }

// Career phase multiplier
export function careerMult(wcsPlayed, wcsTotal) {
  if (wcsPlayed === 0) return 0.80               // rookie
  if (wcsPlayed === 1) return 0.90               // sophomore
  if (wcsPlayed >= wcsTotal - 1) return 0.88     // last WC
  return 1.00                                    // prime
}

const POSITIONS = ['FWD','FWD','FWD','MID','MID','MID','DEF','DEF','GK']

function pickRole(pos,nation){
  const style=(getSoul(nation.name)?.name||'').toLowerCase()
  const choose=a=>a[Math.floor(Math.random()*a.length)]
  if(pos==='FWD') return style.includes('tiki')?choose(['False Nine','Winger','False Nine']):choose(['Striker','Winger','Striker'])
  if(pos==='MID') return style.includes('tiki')?choose(['Deep-Lying Playmaker','Advanced Playmaker','Deep-Lying Playmaker']):choose(['Box-to-Box','Advanced Playmaker','Ball Winner'])
  if(pos==='DEF') return style.includes('tiki')?choose(['Ball-Playing Centre-Back','Full-Back']):choose(['Physical Centre-Back','Full-Back','Ball-Playing Centre-Back'])
  return choose(['Sweeper Keeper','Shot Stopper','Shot Stopper'])
}

export function genStar(nation, wcNumber, overrideWcsPlayed = null) {
  let tier = rollStarTier(nation.tier || 'rest')
  const year = wcYear(wcNumber||1)
  // Elite rarity is scarce in early football and era powers get extra lottery chances.
  const attempts = Math.random() < Math.min(.72, .18 * (eraStarMultiplier(S,nation.name)-1)) ? 2 : 1
  for (let i=1;i<attempts;i++) { const alt=rollStarTier(nation.tier||'rest'); if (TIER_ORDER.indexOf(alt)<TIER_ORDER.indexOf(tier)) tier=alt }
  if (year < 1954 && ['generational','legendary'].includes(tier)) tier = Math.random()<.2?'epic':'rare'
  else if (year < 1966 && tier==='generational') tier='legendary'
  const pos  = POSITIONS[Math.floor(Math.random() * POSITIONS.length)]
  const [minL, maxL] = POSITION_LIFESPANS[pos] || [2,5]
  const wcsTotal  = rand(minL, maxL)
  // Everyone starts fresh: no fictional prior World Cups. wcsTotal just sets
  // how many editions their career will span from their debut.
  const wcsPlayed = overrideWcsPlayed !== null ? overrideWcsPlayed : 0
  const wcsRemaining = wcsTotal - wcsPlayed

  // Career-phase multiplier: debut stars in the very first WC are already
  // established players (prime), not weak rookies — they just have no WC history.
  const initialMult = (wcNumber || 1) === 1 ? 1.00 : careerMult(wcsPlayed, wcsTotal)

  return {
    id: `${nation.name}_${tier}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    name: getPlayerName(nation.cc),
    pos, role: pickRole(pos, nation), tier,
    statBonus: { ...(STAR_BONUSES[pos]?.[tier] || STAR_BONUSES[pos]?.common || {}) },
    careerMult: initialMult,
    teamName: nation.name, cc: nation.cc,
    wcsTotal, wcsPlayed, wcsRemaining,
    wcsActuallyPlayed: 0,
    wcStart: wcNumber || 1,
    goals: 0, goalsConceded: 0,
    ratings: [], allTimeRatings: [],
    fame: 0,
    medals: { gold:0, silver:0, bronze:0, sf:0 },
    awards: { offMVP:0, defMVP:0, goldenBoot:0 },
    retired: false, retiredWC: null,
  }
}

// Initialize 3 stars per nation (called once on world creation)
export function initAllStars(wcNumber) {
  ALL_NATIONS.forEach(nation => {
    if (nation.stars && nation.stars.length === 3) return
    nation.stars = [
      genStar(nation, wcNumber),
      genStar(nation, wcNumber),
      genStar(nation, wcNumber),
    ]
  })
}

// Age all stars at start of new WC — returns { retiring, debuting }
export function ageAllStars(wcNumber) {
  const retiring = [], debuting = []
  const NOTABLE = new Set(['generational','legendary','epic','rare'])

  ALL_NATIONS.forEach(nation => {
    if (!nation.stars) nation.stars = []

    // Age existing
    nation.stars.forEach(s => {
      s.wcsPlayed = (s.wcsPlayed || 0) + 1
      s.wcsRemaining = Math.max(0, s.wcsTotal - s.wcsPlayed)
      s.careerMult = careerMult(s.wcsPlayed, s.wcsTotal)
      // Save ratings history
      if (s.ratings?.length) {
        s.allTimeRatings = [...(s.allTimeRatings || []), ...s.ratings].slice(-60)
        s.ratings = []
      }
      s.goals = 0  // reset per-WC goals
    })

    // Retire stars that have used up their WCs
    const toRetire = nation.stars.filter(s => s.wcsRemaining <= 0)
    toRetire.forEach(s => {
      s.retired = true; s.retiredWC = wcNumber
      if (NOTABLE.has(s.tier)) retiring.push({ ...s })
    })
    nation.stars = nation.stars.filter(s => !s.retired)

    // Spawn new stars to maintain 3 per nation
    while (nation.stars.length < 3) {
      const newStar = genStar(nation, wcNumber, 0) // always start as rookie
      nation.stars.push(newStar)
      if (NOTABLE.has(newStar.tier)) debuting.push({ ...newStar })
    }
  })

  return { retiring, debuting }
}

// After qualifying, link nation stars to team objects
export function linkStarsToTeam(nation) {
  return (nation.stars || []).map(s => ({
    ...s,
    // Deep-copy medals so the team copy never mutates the nation's record,
    // and zero out per-tournament counters (these get synced back after).
    medals: { ...(s.medals || {}) },
    ratings: [],
    goals: 0,
    _careerFame: s.fame || 0,   // remember career fame for display during the WC
    _tourneyFame: 0,
    _tourneyMedals: { gold:0, silver:0, bronze:0, sf:0 },
    _offMVP: 0,
    _defMVP: 0,
    _goldenBoot: 0,
  }))
}

// Update nation's star records from team's star copies after tournament.
// Only the per-tournament deltas (_tourney*) are added back.
export function syncStarsBack(nation, teamStars) {
  if (!nation.stars || !teamStars) return
  teamStars.forEach(ts => {
    const ns = nation.stars.find(s => s.id === ts.id)
    if (!ns) return
    ns.goals = (ns.goals || 0) + (ts.goals || 0)
    ns.careerGoals = (ns.careerGoals || 0) + (ts.goals || 0)
    ns.goalsConceded = (ns.goalsConceded || 0) + (ts.goalsConceded || 0)
    ns.fame = (ns.fame || 0) + (ts._tourneyFame || 0)
    const tm = ts._tourneyMedals || {}
    ns.medals = ns.medals || { gold:0, silver:0, bronze:0, sf:0 }
    ns.medals.gold   = (ns.medals.gold   || 0) + (tm.gold   || 0)
    ns.medals.silver = (ns.medals.silver || 0) + (tm.silver || 0)
    ns.medals.bronze = (ns.medals.bronze || 0) + (tm.bronze || 0)
    ns.medals.sf     = (ns.medals.sf     || 0) + (tm.sf     || 0)
    ns.awards = ns.awards || { offMVP:0, defMVP:0, goldenBoot:0 }
    ns.awards.offMVP    = (ns.awards.offMVP    || 0) + (ts._offMVP || 0)
    ns.awards.defMVP    = (ns.awards.defMVP    || 0) + (ts._defMVP || 0)
    ns.awards.goldenBoot= (ns.awards.goldenBoot|| 0) + (ts._goldenBoot || 0)
    ns.playedThisWC = (ts.ratings?.length || 0) > 0
    if (ns.playedThisWC) ns.wcsActuallyPlayed = (ns.wcsActuallyPlayed || 0) + 1
    if (ts.ratings?.length) {
      ns.allTimeRatings = [...(ns.allTimeRatings || []), ...ts.ratings].slice(-60)
    }
  })
}

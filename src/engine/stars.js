import { ALL_NATIONS, rollStarTier, getPlayerName } from '../data/nations.js'
import { STAR_BONUSES, rand } from './match.js'

export const TIER_LABELS = {
  generational:'Generational', legendary:'Legendary', epic:'Epic',
  rare:'Rare', uncommon:'Uncommon', common:'Common'
}
export const TIER_COLORS = {
  generational:'#ff6b35', legendary:'#f0c040', epic:'#9c27b0',
  rare:'#2196f3', uncommon:'#4caf50', common:'#6a7a9a'
}
export const TIER_ORDER = ['generational','legendary','epic','rare','uncommon','common']

// Career lifespan ranges by tier (in WCs)
const LIFESPANS = {
  generational:[4,7], legendary:[3,6], epic:[2,5],
  rare:[2,4], uncommon:[2,3], common:[1,3]
}

// Career phase multiplier
export function careerMult(wcsPlayed, wcsTotal) {
  if (wcsPlayed === 0) return 0.80               // rookie
  if (wcsPlayed === 1) return 0.90               // sophomore
  if (wcsPlayed >= wcsTotal - 1) return 0.88     // last WC
  return 1.00                                    // prime
}

const POSITIONS = ['FWD','FWD','FWD','MID','MID','MID','DEF','DEF','GK']

export function genStar(nation, wcNumber, overrideWcsPlayed = null) {
  const tier = rollStarTier(nation.tier || 'rest')
  const pos  = POSITIONS[Math.floor(Math.random() * POSITIONS.length)]
  const [minL, maxL] = LIFESPANS[tier] || [1, 3]
  const wcsTotal  = rand(minL, maxL)
  // On first WC: spawn at random career point so we have mix of rookies/veterans
  const wcsPlayed = overrideWcsPlayed !== null ? overrideWcsPlayed : rand(0, Math.max(0, wcsTotal - 1))
  const wcsRemaining = wcsTotal - wcsPlayed

  return {
    id: `${nation.name}_${tier}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    name: getPlayerName(nation.cc),
    pos, tier,
    statBonus: { ...(STAR_BONUSES[pos]?.[tier] || STAR_BONUSES[pos]?.common || {}) },
    careerMult: careerMult(wcsPlayed, wcsTotal),
    teamName: nation.name, cc: nation.cc,
    wcsTotal, wcsPlayed, wcsRemaining,
    wcStart: wcNumber || 1,
    goals: 0, goalsConceded: 0,
    ratings: [], allTimeRatings: [],
    fame: 0,
    medals: { gold:0, silver:0, bronze:0, sf:0 },
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
        s.allTimeRatings = [...(s.allTimeRatings || []), ...s.ratings]
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
    // Don't mutate the nation's star — work on a copy
    ratings: [],
    goals: 0,
  }))
}

// Update nation's star records from team's star copies after tournament
export function syncStarsBack(nation, teamStars) {
  if (!nation.stars || !teamStars) return
  teamStars.forEach(ts => {
    const ns = nation.stars.find(s => s.id === ts.id)
    if (!ns) return
    ns.goals = (ns.goals || 0) + (ts.goals || 0)
    ns.goalsConceded = (ns.goalsConceded || 0) + (ts.goalsConceded || 0)
    ns.fame = (ns.fame || 0) + (ts.fame || 0)
    if (ts.medals) {
      ns.medals = ns.medals || {}
      ns.medals.gold   = (ns.medals.gold   || 0) + (ts.medals.gold   || 0)
      ns.medals.silver = (ns.medals.silver || 0) + (ts.medals.silver || 0)
      ns.medals.bronze = (ns.medals.bronze || 0) + (ts.medals.bronze || 0)
      ns.medals.sf     = (ns.medals.sf     || 0) + (ts.medals.sf     || 0)
    }
    if (ts.ratings?.length) {
      ns.allTimeRatings = [...(ns.allTimeRatings || []), ...ts.ratings]
    }
  })
}

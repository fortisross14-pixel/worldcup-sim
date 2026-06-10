// ── Storylines engine ─────────────────────────────────────────
// Generates narrative events from game state. Important players
// and teams only — no spam for minor nations or common stars.
import { S } from '../store.js'

export function addStory(icon, text) {
  S.storylines = S.storylines || []
  S.storylines.push({ icon, text, wc: S.wcNumber })
}

// Consecutive most-recent editions a nation qualified for
export function qualifiedStreak(name) {
  let streak = 0
  for (let i = (S.history?.length || 0) - 1; i >= 0; i--) {
    if (S.history[i].roundReached?.[name]) streak++
    else break
  }
  return streak
}

// Editions since a nation last won (null = never won)
export function editionsSinceTitle(name) {
  const h = S.history || []
  for (let i = h.length - 1, n = 1; i >= 0; i--, n++) {
    if (h[i].champion === name) return n
  }
  return null
}

// "Last dance" check: star playing their final WC
export function isLastDance(star) {
  return (star?.wcsRemaining || 0) === 1 && ['generational', 'legendary'].includes(star?.tier)
}

// Career summary line for a star
export function careerLine(star) {
  const wcs = (star.wcsPlayed || 0) + 1
  const gold = star.medals?.gold || 0
  const goals = (star.careerGoals || 0) + (star.goals || 0)
  const bits = [`${wcs} World Cup${wcs !== 1 ? 's' : ''}`]
  if (gold) bits.push(`${gold} title${gold !== 1 ? 's' : ''}`)
  bits.push(`${goals} goal${goals !== 1 ? 's' : ''}`)
  return bits.join(', ')
}

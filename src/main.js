import { S, autoSave, loadGame, clearGame, exportSave, importSave, loadSlot, allSlotInfo, deleteSlot, setActiveSlot, getActiveSlot } from './store.js'
import { ALL_NATIONS, flag, getSoul, natColors } from './data/nations.js'
import { initAllStars, ageAllStars, TIER_LABELS, TIER_COLORS, TIER_ORDER } from './engine/stars.js'
import {
  runQualification, drawGroups, groupStandings, playGroupMatch, buildKnockout,
  playKnockoutMatch, advanceKnockout, startNewWC
} from './engine/season.js'
import { getEffStats, ovr } from './engine/match.js'
import { resetNameTracking } from './data/names.js'
import { previewStory, resultStory } from './engine/drama.js'
import { wcYear, formatForYear } from './engine/era.js'

// ── Playback state ────────────────────────────────────────────
let _playbackTimer = null
let _playbackSkip = false

// ── Helpers ───────────────────────────────────────────────────
const $ = id => document.getElementById(id)
const tierBadge = t => `<span class="badge badge-${t}">${TIER_LABELS[t]||t}</span>`
const tierColor  = t => TIER_COLORS[t] || '#6a7a9a'
const ratingClass = r => r>=8.5?'rating-gold':r>=7.5?'rating-green':r>=6.0?'rating-white':'rating-red'

function toast(msg, duration = 3000) {
  let el = $('toast')
  if (!el) { el = document.createElement('div'); el.id='toast'; el.style.cssText='position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:var(--bg3);border:1px solid var(--gold3);color:var(--gold);font-family:var(--font-head);font-size:12px;letter-spacing:.06em;padding:7px 16px;border-radius:20px;z-index:999;opacity:0;transition:opacity .3s;pointer-events:none'; document.body.appendChild(el) }
  el.textContent = msg; el.style.opacity='1'
  clearTimeout(el._t); el._t = setTimeout(() => el.style.opacity='0', duration)
}

// ── Tab switching ─────────────────────────────────────────────
window.switchTab = function(tab) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'))
  $(`tab-${tab}`)?.classList.add('active')
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active')
  if (tab==='groups')  renderGroups()
  if (tab==='bracket') renderBracket()
  if (tab==='stars')   renderStars()
  if (tab==='nations') renderNations()
  if (tab==='history')    renderHistory()
  if (tab==='tournament') renderTournament()
  if (tab==='play')       renderPlay()
}

// ── Phase button ──────────────────────────────────────────────
function updatePhaseUI() {
  $('wc-number').textContent = `${S.currentYear||wcYear(S.wcNumber||1)} · WC ${S.wcNumber||1}`
  const btn = $('btn-main')
  const labels = {
    idle:      `▶ Begin WC ${S.wcNumber}`,
    qualified: '▶ Draw Groups',
    groups:    '▶ Play Next Match',
    knockout:  '▶ Play Next Match',
    done:      '▶ Next World Cup',
  }
  btn.textContent = labels[S.phase] || '▶ Start'
  btn.disabled = false
  renderPlay()
}

window.handleMain = async function() {
  const p = S.phase || 'idle'
  if (p === 'idle') {
    runQualification()
    S.phase = 'qualified'
    await autoSave()
    updatePhaseUI()
    switchTab('nations')
    toast(`${S.teams?.length||0} nations qualified for WC #${S.wcNumber}`)
  } else if (p === 'qualified') {
    drawGroups()
    S.phase = 'groups'
    await autoSave()
    updatePhaseUI()
    switchTab('groups')
    toast('12 groups drawn!')
  } else if (p === 'groups') {
    playNextGroup()
  } else if (p === 'knockout') {
    playNextKO()
  } else if (p === 'done') {
    showInterWC()
  }
}

// ── Pre-match preview then play ───────────────────────────────
function playNextGroup() {
  const unplayed = S.groupMatches.filter(m => !m.played)
  if (!unplayed.length) {
    buildKnockout(); S.phase = 'knockout'
    autoSave(); updatePhaseUI(); switchTab('bracket')
    toast('Group stage done — Round of 16!'); return
  }
  const match = unplayed[0]
  showMatchPreview(match.t1, match.t2, 'Group Stage', () => {
    const result = playGroupMatch(match)
    showMatchPopup(result, 'Group Stage', () => {
      renderGroups(); updatePhaseUI()
      const left = S.groupMatches.filter(m => !m.played).length
      $('btn-main').textContent = left > 0 ? `▶ Play Next (${left} left)` : '▶ Complete Groups'
    })
  })
}

function getCurrentKORound() {
  return (S.knockoutRounds || []).find(r => (r.matches || []).some(m => !m.played)) || null
}

function playNextKO() {
  // Find the earliest round that still has unplayed matches. This matters after
  // the semi-finals because Third Place is queued before the Final.
  const round = getCurrentKORound()
  if (!round) {
    advanceKnockout(); autoSave()
    if (S.phase === 'done') { updatePhaseUI(); renderBracket(); renderPlay(); toast(`🏆 ${S.champion?.name} are World Champions!`) }
    else { updatePhaseUI(); renderBracket() }
    return
  }
  const unplayed = round.matches.filter(m => !m.played)
  const match = unplayed[0]
  const isLastInRound = unplayed.length === 1
  showMatchPreview(match.t1, match.t2, round.name, () => {
    const result = playKnockoutMatch(match)
    showMatchPopup(result, round.name, () => {
      if (isLastInRound) {
        advanceKnockout(); autoSave()
        if (S.phase === 'done') {
          updatePhaseUI(); renderBracket(); switchTab('play'); renderPlay()
          toast(`🏆 ${S.champion?.name} are World Champions!`)
        } else {
          updatePhaseUI(); renderBracket()
          const nextRound = S.knockoutRounds.find(r => r.matches.some(m => !m.played))
          if (nextRound) toast(`${nextRound.name} begins!`)
        }
      } else {
        renderBracket(); updatePhaseUI()
        const left = round.matches.filter(m => !m.played).length
        $('btn-main').textContent = `▶ Play Next (${left} left)`
      }
    })
  })
}

// ── Pre-match preview screen ──────────────────────────────────
function showMatchPreview(t1, t2, roundName, onStart) {
  const popup = $('match-popup'), inner = $('match-popup-inner')
  popup.classList.add('match-popup-modal')
  popup.style.display = 'flex'
  const [h1,h2] = natColors(t1.cc), [a1,a2] = natColors(t2.cc)

  const teamDetail = (team, side) => {
    const stars = team.stars || []
    const e = getEffStats(team, false)
    const soul = team.soul || getSoul(team.name)
    return `
      <div>
        <div class="pv-block-head">Form</div>
        <div class="pv-statgrid">
          <div class="pv-stat"><span class="pl">ATT</span><span class="pv">${e.attack}</span></div>
          <div class="pv-stat"><span class="pl">DEF</span><span class="pv">${e.defense}</span></div>
          <div class="pv-stat"><span class="pl">STA</span><span class="pv">${e.stamina}</span></div>
          <div class="pv-stat"><span class="pl">MEN</span><span class="pv">${e.mental}</span></div>
          <div class="pv-stat"><span class="pl">SET</span><span class="pv">${e.setPieces}</span></div>
        </div>
        ${(team.w||team.d||team.l)?`<div style="font-family:var(--font-body);font-size:11px;color:var(--dim);margin-bottom:8px">${team.w||0}W ${team.d||0}D ${team.l||0}L · GF ${team.gf||0} · GA ${team.ga||0}</div>`:''}
        ${soul?`<div class="pv-soul"><span class="pv-soul-nm">🎭 ${soul.name}</span><span class="pv-soul-desc">${soul.desc}</span></div>`:''}
        <div class="pv-block-head">Stars</div>
        ${stars.length?stars.map(s=>`<div class="scard ${side}" style="margin-bottom:6px">
          <span class="badge badge-${s.tier}">${s.pos}</span>
          <span class="sinfo"><span class="snm">${s.name}</span><span class="smeta">${s.role||s.pos} · ${TIER_LABELS[s.tier]||s.tier}</span></span>
        </div>`).join(''):'<div style="font-size:11px;color:var(--dim)">No stars</div>'}
      </div>`
  }

  const e1=getEffStats(t1), e2=getEffStats(t2)
  const o1=Math.round((e1.attack+e1.defense+e1.stamina+e1.mental+e1.setPieces)/5)
  const o2=Math.round((e2.attack+e2.defense+e2.stamina+e2.mental+e2.setPieces)/5)

  const isGroup = S.phase === 'groups'
  const nextMatch = isGroup ? S.groupMatches.find(m => !m.played) : null
  const groupLeft = nextMatch ? S.groupMatches.filter(m => !m.played && m.gi === nextMatch.gi).length : 0
  const drama = previewStory(S,t1,t2,roundName)
  const skipButtons = isGroup
    ? `<button class="btn btn-secondary" onclick="window.skipPreviewedMatch()">Skip ⏭</button>
       <button class="btn btn-secondary" onclick="window.skipPreviewedGroup()">Group ⏭⏭(${groupLeft})</button>`
    : `<button class="btn btn-secondary" onclick="window.skipPreviewedMatch()">Skip ⏭</button>`

  inner.innerHTML = `
    <div class="pb-card">
      <div class="pb-top">
        <div class="pb-round">${roundName} — Preview</div>
        <button class="pb-close" onclick="window.cancelPreview()">✕</button>
      </div>
      <div class="versus compact">
        <div class="vhalf home" style="--c1:${h1};--c2:${h2}">
          <span class="vflag">${flag(t1.cc,30)}</span>
          <span class="vname">${t1.name}</span>
          <span class="vsub">OVR ${o1} · ${t1.conf||''}</span>
        </div>
        <div class="vhalf away" style="--c1:${a1};--c2:${a2}">
          <span class="vflag">${flag(t2.cc,30)}</span>
          <span class="vname">${t2.name}</span>
          <span class="vsub">OVR ${o2} · ${t2.conf||''}</span>
        </div>
        <div class="score-coin"><div class="sc" style="font-size:20px">VS</div></div>
      </div>
      <div class="press-box"><div class="press-kicker">THE WORLD FOOTBALL DAILY</div><div class="press-head">${drama.headline}</div><div class="press-body">${drama.body}</div></div>
      <div class="pv-body">
        <div class="pv-teams">
          ${teamDetail(t1,'h')}
          ${teamDetail(t2,'a')}
        </div>
      </div>
      <div class="pb-acts" style="flex-wrap:wrap">
        ${skipButtons}
        <button class="btn btn-primary" onclick="window.startPreviewedMatch()">▶ Play</button>
      </div>
    </div>`

  window._previewOnStart = onStart
}

window.startPreviewedMatch = function() {
  const cb = window._previewOnStart
  window._previewOnStart = null
  if (cb) cb()
}

window.cancelPreview = function() {
  window._previewOnStart = null
  const popup = $('match-popup')
  popup.style.display = 'none'
  popup.classList.remove('match-popup-modal')
}

window.skipPreviewedMatch = function() {
  window._previewOnStart = null
  $('match-popup').style.display = 'none'
  if (S.phase === 'groups') {
    const match = S.groupMatches.find(m => !m.played)
    if (!match) return
    const result = playGroupMatch(match)
    showGroupResultsPopup([result], 'Group Stage', () => { renderGroups(); updatePhaseUI() })
  } else if (S.phase === 'knockout') {
    const round = getCurrentKORound()
    const match = round?.matches.find(m => !m.played)
    if (!match) return
    const result = playKnockoutMatch(match)
    const roundComplete = round.matches.every(m => m.played)
    if (roundComplete) advanceKnockout()
    autoSave()
    showGroupResultsPopup([result], round.name, () => {
      renderBracket(); updatePhaseUI()
      if (S.phase === 'done') renderPlay()
    })
  }
}

window.skipPreviewedGroup = function() {
  window._previewOnStart = null
  $('match-popup').style.display = 'none'
  if (S.phase !== 'groups') return
  const nextMatch = S.groupMatches.find(m => !m.played)
  if (!nextMatch) return
  const gi = nextMatch.gi
  const results = S.groupMatches.filter(m => !m.played && m.gi === gi).map(m => playGroupMatch(m))
  showGroupResultsPopup(results, `Group ${S.groups[gi]?.id || ''}`, () => { renderGroups(); updatePhaseUI() })
}

// ── Skip All Groups (from home tab) ──────────────────────────
window.skipAllGroups = function() {
  const unplayed = S.groupMatches.filter(m => !m.played)
  const results = unplayed.map(m => playGroupMatch(m))
  if (!S.groupMatches.filter(m=>!m.played).length) {
    buildKnockout(); S.phase='knockout'; autoSave()
  }
  updatePhaseUI(); renderGroups()
  showGroupResultsPopup(results, 'All Group Results', () => {})
}

window.skipGroup = function(gi) {
  const results = S.groupMatches.filter(m => !m.played && m.gi === gi).map(m => playGroupMatch(m))
  renderGroups()
  showGroupResultsPopup(results, `Group ${S.groups[gi]?.id || gi} Results`, () => {})
}

window.skipKORound = function() {
  const round = getCurrentKORound()
  if (!round) return
  const results = round.matches.filter(m=>!m.played).map(m => playKnockoutMatch(m))
  if (round.matches.every(m => m.played)) advanceKnockout()
  autoSave()
  updatePhaseUI(); renderBracket()
  showGroupResultsPopup(results, `${round.name} Results`, () => {
    if (S.phase === 'done') renderPlay()
  })
}

// ── Multi-match results popup (tabbed) ───────────────────────
function showGroupResultsPopup(results, roundName, onClose) {
  const popup = $('match-popup'), inner = $('match-popup-inner')
  popup.classList.add('match-popup-modal')
  popup.style.display = 'flex'
  let selected = 0

  const render = () => {
    const r = results[selected]
    const [h1,h2] = natColors(r.t1.cc), [a1,a2] = natColors(r.t2.cc)
    const tabs = results.length > 1 ? results.map((res, i) => `
      <div class="gr-tab ${i===selected?'active':''}" onclick="window._selectGroupResult(${i})">
        <div class="gr-tab-sc">${res.g1}–${res.g2}</div>
        <div class="gr-tab-w">${(res.g1>res.g2?res.t1:res.g2>res.g1?res.t2:null)?.name?.slice(0,10)||'Draw'}</div>
      </div>`).join('') : ''

    const events = (r.timeline||[])
    const drama=resultStory(r,roundName)
    inner.innerHTML = `
      <div class="gr-wrap">
        ${results.length>1?`<div class="gr-tabs">${tabs}</div>`:''}
        <div class="gr-detail">
          <div class="pb-card">
            <div class="pb-top">
              <div class="pb-round">${roundName}${results.length>1?` · ${selected+1}/${results.length}`:''}</div>
              <div class="pb-clock final">FT</div>
            </div>
            <div class="versus compact">
              <div class="vhalf home" style="--c1:${h1};--c2:${h2}">
                <span class="vflag">${flag(r.t1.cc,30)}</span>
                <span class="vname">${r.t1.name}</span>
                <span class="vsub">${r.t1.conf||''}</span>
              </div>
              <div class="vhalf away" style="--c1:${a1};--c2:${a2}">
                <span class="vflag">${flag(r.t2.cc,30)}</span>
                <span class="vname">${r.t2.name}</span>
                <span class="vsub">${r.t2.conf||''}</span>
              </div>
              <div class="score-coin ${r.penalties?'pens':''}">
                <div class="sc"><b>${r.g1}</b><span class="dash">–</span>${r.g2}</div>
                <div class="ft">${r.penalties?'PENS':'FT'}</div>
              </div>
            </div>
            <div class="gticker">
              <div class="gt-head">Goals</div>
              ${events.length===0?'<div class="goal muted">No goals</div>':
                events.map(ev=>`<div class="goal ${ev.team===1?'home':'away'}" style="--gline-h:${h1};--gline-a:${a1}">
                  <span class="gmin">${ev.minute}</span>
                  <span class="gscorer ${ev.isStar?'star':''}">${ev.scorerName}</span>
                  <span class="gteam">${ev.team===1?r.t1.name.slice(0,3).toUpperCase():r.t2.name.slice(0,3).toUpperCase()}</span>
                </div>`).join('')}
            </div>
            <div class="press-box result"><div class="press-kicker">FULL-TIME EDITION</div><div class="press-head">${drama.headline}</div><div class="press-body">${drama.body} · Match quality ${r.quality||'—'}/10${r.mvp?` · MVP ${r.mvp.name}`:''}</div></div>
            ${renderFinalSummary(r)}
            <div class="pb-acts">
              <button class="btn btn-primary" onclick="window._closeGroupResults()">Continue ▶</button>
            </div>
          </div>
        </div>
      </div>`
  }

  window._selectGroupResult = i => { selected=i; render() }
  window._closeGroupResults = () => {
    popup.style.display='none'
    popup.classList.remove('match-popup-modal')
    window._selectGroupResult = null
    window._closeGroupResults = null
    if (onClose) onClose()
  }
  render()
}

// ── Match playback (CL-style) ─────────────────────────────────
function showMatchPopup(r, roundName, onClose) {
  if (!r) return
  const popup = $('match-popup'), inner = $('match-popup-inner')
  popup.classList.add('match-popup-modal')
  popup.style.display = 'flex'
  _playbackSkip = false
  if (_playbackTimer) { clearTimeout(_playbackTimer); _playbackTimer = null }

  const t1 = r.t1, t2 = r.t2
  const [h1,h2] = natColors(t1.cc), [a1,a2] = natColors(t2.cc)
  const isFinal = roundName === 'Final'

  function renderFrame(minute, score1, score2, events, finished) {
    const skipBtn  = finished ? '' : `<button class="btn btn-secondary" onclick="window.skipPlayback()">Skip ⏭</button>`
    const closeBtn = finished ? `<button class="btn btn-primary" onclick="window.closePlayback()">Continue ▶</button>` : ''
    const drama=finished?resultStory(r,roundName):null
    inner.innerHTML = `
      <div class="pb-card">
        <div class="pb-top">
          <div class="pb-round">${isFinal?`🏆 World Cup #${S.wcNumber} Final`:roundName}</div>
          <div class="pb-clock ${finished?'final':''}">${finished?'FT':minute+"'"}</div>
        </div>
        <div class="versus compact">
          <div class="vhalf home" style="--c1:${h1};--c2:${h2}">
            <span class="vflag">${flag(t1.cc,30)}</span>
            <span class="vname">${t1.name}</span>
            <span class="vsub">${t1.soul?'🎭 '+t1.soul.name:t1.conf||''}</span>
          </div>
          <div class="vhalf away" style="--c1:${a1};--c2:${a2}">
            <span class="vflag">${flag(t2.cc,30)}</span>
            <span class="vname">${t2.name}</span>
            <span class="vsub">${t2.soul?'🎭 '+t2.soul.name:t2.conf||''}</span>
          </div>
          <div class="score-coin ${finished?(r.penalties?'pens':''):'live'}">
            <div class="sc"><b>${score1}</b><span class="dash">–</span>${score2}</div>
            <div class="ft">${finished?(r.penalties?'PENS':'FULL TIME'):minute+"'"}</div>
          </div>
        </div>
        <div class="pb-prog"><div class="pb-prog-fill" style="width:${Math.min(100,(minute/90)*100)}%"></div></div>
        <div class="gticker">
          <div class="gt-head">Goals</div>
          ${events.length===0
            ? `<div class="goal muted">${finished?'No goals':'Kick off…'}</div>`
            : events.map(ev=>`<div class="goal ${ev.team===1?'home':'away'}" style="--gline-h:${h1};--gline-a:${a1}">
                <span class="gmin">${ev.minute}</span>
                <span class="gscorer ${ev.isStar?'star':''}">${ev.scorerName}</span>
                <span class="gteam">${ev.team===1?t1.name.slice(0,3).toUpperCase():t2.name.slice(0,3).toUpperCase()}</span>
              </div>`).join('')}
        </div>
        ${finished?`<div class="press-box result"><div class="press-kicker">FULL-TIME EDITION</div><div class="press-head">${drama.headline}</div><div class="press-body">${drama.body} · Match quality ${r.quality||'—'}/10${r.mvp?` · MVP ${r.mvp.name}`:''}</div></div>`:''}
        ${finished ? renderFinalSummary(r) : ''}
        <div class="pb-acts">${skipBtn}${closeBtn}</div>
      </div>`
  }

  renderFrame(0, 0, 0, [], false)

  const tranches = r.tranches || []
  const events = []
  let i = 0

  function nextStep() {
    if (_playbackSkip) { finishPlayback(); return }
    if (i >= tranches.length) { finishPlayback(); return }
    const tr = tranches[i]
    ;(tr.newGoals || []).forEach(g => events.push(g))
    renderFrame(tr.minute, tr.score1, tr.score2, events, false)
    i++
    _playbackTimer = setTimeout(nextStep, 900)
  }

  function finishPlayback() {
    if (_playbackTimer) { clearTimeout(_playbackTimer); _playbackTimer = null }
    renderFrame(90, r.g1, r.g2, r.timeline || [], true)
    window._matchOnClose = onClose
  }

  _playbackTimer = setTimeout(nextStep, 600)
}

function renderFinalSummary(r) {
  const sr1 = r.starRatings?.team1 || [], sr2 = r.starRatings?.team2 || []
  const [h1] = natColors(r.t1.cc), [a1] = natColors(r.t2.cc)
  const starGoals1 = {}, starGoals2 = {}
  ;(r.timeline||[]).forEach(g => { if (!g.isStar) return; const m=g.team===1?starGoals1:starGoals2; m[g.scorerName]=(m[g.scorerName]||0)+1 })
  const rc = v => !v?'r-cream':v>=8.5?'r-gold':v>=7.5?'r-green':v>=6.0?'r-cream':'r-red'

  const statBar = (label, v1, v2, suffix='') => {
    const t = (v1+v2)||1
    return `<div class="pb-stat">
      <div class="pb-stat-row"><span class="v h">${v1}${suffix}</span><span class="lab">${label}</span><span class="v a">${v2}${suffix}</span></div>
      <div class="pb-bar" style="--bar-h:${h1};--bar-a:${a1}"><div class="bh" style="width:${v1/t*100}%"></div><div class="ba" style="width:${v2/t*100}%"></div></div>
    </div>`
  }
  const starCard = (s, side, goalsMap) => `<div class="scard ${side}">
    <span class="spos">${s.pos}</span>
    <span class="sinfo"><span class="snm">${s.name}</span><span class="smeta">${(goalsMap[s.name]||0)>0?goalsMap[s.name]+'⚽ · ':''}${s.role||s.pos} · ${TIER_LABELS[s.tier]||s.tier}</span></span>
    <span class="srate ${rc(s.rating)}">${s.rating?.toFixed(1)||'—'}</span>
  </div>`

  return `
    <div class="pb-stats">
      ${statBar('Shots', r.shots1, r.shots2)}
      ${statBar('On Target', r.shotsOnTarget1||0, r.shotsOnTarget2||0)}
      ${statBar('xG', r.xg1||0, r.xg2||0)}
      ${statBar('Corners', r.corners1, r.corners2)}
      ${statBar('Possession', r.possession1, r.possession2, '%')}
    </div>
    <div class="pb-stars">
      <div class="scols">
        <div>
          <div class="scol-head">${flag(r.t1.cc,16)} ${r.t1.name}</div>
          ${sr1.map(s=>starCard(s,'h',starGoals1)).join('')}
        </div>
        <div>
          <div class="scol-head">${flag(r.t2.cc,16)} ${r.t2.name}</div>
          ${sr2.map(s=>starCard(s,'a',starGoals2)).join('')}
        </div>
      </div>
    </div>
    ${r.effects?.length?`<div class="pb-effects">${r.effects.map(e=>`<div class="effect-line ${e.includes('⭐')?'star':''}">${e}</div>`).join('')}</div>`:''}
  `
}

window.skipPlayback  = () => { _playbackSkip = true }
window.closePlayback = () => {
  const popup = $('match-popup')
  popup.style.display='none'; popup.classList.remove('match-popup-modal')
  if (_playbackTimer) { clearTimeout(_playbackTimer); _playbackTimer=null }
  if (window._matchOnClose) { const cb=window._matchOnClose; window._matchOnClose=null; cb() }
}

// ── TOURNAMENT tab ────────────────────────────────────────────
let tourneySubTab = 'qualifying'

function renderTournament() {
  const el = $('tab-tournament'); if (!el) return
  const sub = tourneySubTab

  const subTabs = [
    { id:'qualifying', label:'🌍 Qualifying' },
    { id:'team-stats', label:'📊 Team Stats' },
    { id:'player-stats', label:'⭐ Player Stats' },
    { id:'transfers', label:'🔄 Stars In/Out' },
  ]

  let html = `<div class="sub-tab-row">
    ${subTabs.map(t=>`<button class="sub-tab ${sub===t.id?'active':''}" onclick="setTourneyTab('${t.id}')">${t.label}</button>`).join('')}
  </div>`

  if (sub === 'qualifying') html += renderQualifying()
  else if (sub === 'team-stats') html += renderTeamStats()
  else if (sub === 'player-stats') html += renderPlayerStats()
  else if (sub === 'transfers') html += renderTransfers()

  el.innerHTML = html
}
window.setTourneyTab = t => { tourneySubTab=t; renderTournament() }

function renderTransfers() {
  const lt = S.lastTransition
  const tierRank = { generational:6, legendary:5, epic:4, rare:3, uncommon:2, common:1 }
  if (!lt || (!lt.retiring?.length && !lt.debuting?.length)) {
    return `<div class="empty">No star transitions yet.<br><br>After you finish a World Cup and start the next one, retiring legends and debuting talents will show up here.</div>`
  }
  const retiring = [...(lt.retiring||[])].sort((a,b)=>(tierRank[b.tier]||0)-(tierRank[a.tier]||0))
  const debuting = [...(lt.debuting||[])].sort((a,b)=>(tierRank[b.tier]||0)-(tierRank[a.tier]||0))

  let html = `<div style="font-size:12px;color:var(--dim);margin-bottom:4px">Changes heading into World Cup #${S.wcNumber}</div>`

  html += `<div class="sec s-hot">👋 RETIRED STARS</div>`
  if (retiring.length) {
    html += retiring.map(s => `
      <div class="interwc-card retire">
        <div style="font-size:18px">${flag(s.cc,22)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px">${s.name} <span class="badge badge-${s.tier}">${s.tier}</span></div>
          <div style="font-size:11px;color:var(--dim)">${s.pos} · ${s.teamName} · ${s.wcsActuallyPlayed||0} WCs played</div>
        </div>
        <div style="text-align:right;font-size:11px;color:var(--dim)">
          ${s.careerGoals?`⚽ ${s.careerGoals}<br>`:''}${s.medals?.gold?`🥇 ${s.medals.gold}`:''}
        </div>
      </div>`).join('')
  } else {
    html += `<div style="font-size:12px;color:var(--dim);padding:6px 2px">No notable retirements.</div>`
  }

  html += `<div class="sec s-grape">✨ NEW STARS</div>`
  if (debuting.length) {
    html += debuting.map(s => `
      <div class="interwc-card debut">
        <div style="font-size:18px">${flag(s.cc,22)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px">${s.name} <span class="badge badge-${s.tier}">${s.tier}</span></div>
          <div style="font-size:11px;color:var(--dim)">${s.pos} · ${s.teamName} · debut</div>
        </div>
        <div style="font-size:18px">🌟</div>
      </div>`).join('')
  } else {
    html += `<div style="font-size:12px;color:var(--dim);padding:6px 2px">No notable debuts.</div>`
  }

  return html
}

function renderQualifying() {
  if (!S.teams?.length) return '<div class="empty">No teams qualified yet</div>'
  const qualified = new Set(S.teams.map(t=>t.name))
  const byConf = {}
  ALL_NATIONS.forEach(n => {
    if (!byConf[n.conf]) byConf[n.conf] = { qualified:[], notQualified:[] }
    if (qualified.has(n.name)) byConf[n.conf].qualified.push(n)
    else byConf[n.conf].notQualified.push(n)
  })
  return `<div class="qualify-grid">
    ${Object.entries(byConf).map(([conf,{qualified:q,notQualified:nq}])=>`
      <div class="qualify-card">
        <div class="qualify-card-head">
          <div class="qualify-league">${conf}</div>
          <div class="qualify-slots">${q.length} qualified</div>
        </div>
        <div class="qualify-body">
          ${q.map(n=>{
            const t=S.teams.find(t=>t.name===n.name)
            const soul=getSoul(n.name)
            return`<div class="qualify-row qualifies" onclick="openTeamModal('${n.name}')" style="cursor:pointer">
              <div class="qualify-rank">✓</div>
              <div class="qualify-name">${flag(n.cc)} ${n.name}${n.name===S.hostNation?' 🏠':''}</div>
              <div class="qualify-score" style="color:var(--txt3);font-size:10px">${soul.name}</div>
            </div>`}).join('')}
          ${nq.map(n=>`<div class="qualify-row">
            <div class="qualify-rank">✗</div>
            <div class="qualify-name" style="opacity:.45">${flag(n.cc)} ${n.name}</div>
            <div class="qualify-score"></div>
          </div>`).join('')}
        </div>
      </div>`).join('')}
  </div>`
}

function renderTeamStats() {
  if (!S.teams?.length) return '<div class="empty">Tournament not started</div>'
  const teams = [...S.teams]
  const goals    = (t) => S.teamGoals?.[t.name] || 0
  const conceded = (t) => S.teamGoalsConceded?.[t.name] || 0
  const matches  = (t) => (t.w||0)+(t.d||0)+(t.l||0)

  const makeTable = (sorted, statFn, label, color='var(--gold)', asc=false) => `
    <div class="cl-stat-card card">
      <div class="cl-stat-title">${label}</div>
      <table class="data-table compact"><tbody>
        ${sorted.map((t,i)=>`<tr>
          <td style="color:var(--txt3);width:20px">${i+1}</td>
          <td class="c-name" onclick="openTeamModal('${t.name}')">${flag(t.cc)} <strong>${t.name}</strong></td>
          <td style="color:${color};font-family:var(--font-head);font-weight:700;text-align:right">${statFn(t)}</td>
        </tr>`).join('')}
      </tbody></table>
    </div>`

  const byGoals      = [...teams].sort((a,b)=>goals(b)-goals(a)).slice(0,8)
  const byConceded   = [...teams].sort((a,b)=>conceded(a)-conceded(b)).slice(0,8)
  const byGD         = [...teams].sort((a,b)=>((goals(b)-conceded(b))-(goals(a)-conceded(a)))).slice(0,8)
  const byShots      = [...teams].sort((a,b)=>(b.totalShots||0)-(a.totalShots||0)).slice(0,8)
  const byPoss       = [...teams].sort((a,b)=>(b.avgPoss||0)-(a.avgPoss||0)).slice(0,8)
  const byWin        = [...teams].sort((a,b)=>(b.w||0)-(a.w||0)).slice(0,8)

  return `<div class="cl-stats-grid">
    ${makeTable(byGoals, t=>`${goals(t)} ⚽`, 'Most Goals Scored')}
    ${makeTable(byConceded, t=>`${conceded(t)} 🥅`, 'Fewest Goals Conceded', 'var(--green)')}
    ${makeTable(byGD, t=>`${goals(t)-conceded(t)>0?'+':''}${goals(t)-conceded(t)}`, 'Best Goal Difference')}
    ${makeTable(byWin, t=>`${t.w||0}W ${t.d||0}D ${t.l||0}L`, 'Most Wins')}
  </div>`
}

function renderPlayerStats() {
  // Collect all active stars
  const allStars = []
  ;(S.teams||[]).forEach(t => (t.stars||[]).forEach(s => allStars.push({...s, teamName:t.name, cc:t.cc})))
  if (!allStars.length) return '<div class="empty">No stars in this tournament</div>'

  const topScorers = [...allStars].filter(s=>s.goals>0).sort((a,b)=>(b.goals||0)-(a.goals||0)).slice(0,10)
  const avgRating = s => s.ratings?.length ? s.ratings.reduce((a,b)=>a+b,0)/s.ratings.length : 0
  const offMVPs = [...allStars].filter(s=>['FWD','MID'].includes(s.pos)&&s.ratings?.length).sort((a,b)=>avgRating(b)-avgRating(a)).slice(0,8)
  const defMVPs = [...allStars].filter(s=>['DEF','GK'].includes(s.pos)&&s.ratings?.length).sort((a,b)=>avgRating(b)-avgRating(a)).slice(0,8)

  const playerRow = (s, stat, color='var(--gold)') => `<tr>
    <td class="c-name" onclick="openStarModal('${s.id}','${s.teamName}')">${flag(s.cc||'')} <strong>${s.name}</strong> <span style="font-size:10px;color:var(--txt3)">(${s.teamName})</span></td>
    <td style="color:var(--txt3);font-size:10px">${s.pos}</td>
    <td style="color:${color};font-family:var(--font-head);font-weight:700;text-align:right">${stat}</td>
  </tr>`

  return `<div class="cl-stats-grid">
    <div class="cl-stat-card card">
      <div class="cl-stat-title">⚽ Top Scorers</div>
      <table class="data-table compact"><tbody>
        ${topScorers.map(s=>playerRow(s, `${s.goals} ⚽`)).join('')}
      </tbody></table>
    </div>
    <div class="cl-stat-card card">
      <div class="cl-stat-title">🌟 Offensive MVP (FWD/MID)</div>
      <table class="data-table compact"><tbody>
        ${offMVPs.map(s=>playerRow(s, avgRating(s).toFixed(1)+' ★', 'var(--gold2)')).join('')}
      </tbody></table>
    </div>
    <div class="cl-stat-card card">
      <div class="cl-stat-title">🛡️ Defensive MVP (DEF/GK)</div>
      <table class="data-table compact"><tbody>
        ${defMVPs.map(s=>playerRow(s, avgRating(s).toFixed(1)+' ★', 'var(--blue)')).join('')}
      </tbody></table>
    </div>
  </div>`
}


// ── LIVE WIDGETS (Golden Boot + MVP race + Storylines) ────────
function findStarByName(name) {
  for (const t of (S.teams || [])) {
    const s = (t.stars || []).find(x => x.name === name)
    if (s) return { ...s, teamName: t.name, cc: t.cc }
  }
  return null
}

function renderLiveWidgets() {
  const scorers = Object.entries(S.scorers || {}).sort((a,b) => b[1]-a[1]).slice(0, 5)
  const allStars = []
  ;(S.teams || []).forEach(t => (t.stars || []).forEach(s => allStars.push({ ...s, teamName: t.name, cc: t.cc })))
  const avgR = s => s.ratings?.length ? s.ratings.reduce((a,b)=>a+b,0)/s.ratings.length : 0
  const offs = allStars.filter(s => ['FWD','MID'].includes(s.pos) && s.ratings?.length >= 2).sort((a,b)=>avgR(b)-avgR(a)).slice(0,3)
  const defs = allStars.filter(s => ['DEF','GK'].includes(s.pos) && s.ratings?.length >= 2).sort((a,b)=>avgR(b)-avgR(a)).slice(0,3)

  let html = '<div class="widgets-row">'
  if (scorers.length) {
    html += `<div class="widget-card">
      <div class="widget-title">🥇 GOLDEN BOOT</div>
      ${scorers.map(([name, g], i) => {
        const st = findStarByName(name)
        return `<div class="widget-row ${i===0?'leader':''}" ${st?`onclick="openStarModal('${st.id}','${st.teamName}')" style="cursor:pointer"`:''}>
          <span class="widget-rank">${i+1}</span>
          <span class="widget-name">${st?flag(st.cc,16)+' ':''}${name}</span>
          <span class="widget-val">${g} ⚽</span>
        </div>`
      }).join('')}
    </div>`
  }
  if (offs.length || defs.length) {
    html += `<div class="widget-card">
      <div class="widget-title">⭐ MVP RACE</div>
      ${offs.map((s,i) => `<div class="widget-row ${i===0?'leader':''}" onclick="openStarModal('${s.id}','${s.teamName}')" style="cursor:pointer">
        <span class="widget-rank">${s.pos}</span>
        <span class="widget-name">${flag(s.cc,16)} ${s.name}</span>
        <span class="widget-val">${avgR(s).toFixed(1)} ★</span>
      </div>`).join('')}
      ${defs.length ? '<div class="widget-divider"></div>' : ''}
      ${defs.map((s,i) => `<div class="widget-row" onclick="openStarModal('${s.id}','${s.teamName}')" style="cursor:pointer">
        <span class="widget-rank">${s.pos}</span>
        <span class="widget-name">${flag(s.cc,16)} ${s.name}</span>
        <span class="widget-val" style="color:var(--blue)">${avgR(s).toFixed(1)} ★</span>
      </div>`).join('')}
    </div>`
  }
  html += '</div>'
  return html
}

function renderStorylineFeed(limit = 8) {
  const st = (S.storylines || []).slice().reverse().slice(0, limit)
  if (!st.length) return ''
  return `<div class="sec">📰 STORYLINES</div>
    <div class="story-feed">${st.map(s => `<div class="story-card">${s.icon} ${s.text}</div>`).join('')}</div>`
}


function renderTournamentEpilogue() {
  const aw=S.seasonAwards||{}
  const hist=S.history||[]
  const current=hist[hist.length-1]
  const topGame=[...(S.allMatchResults||[])].filter(m=>m.quality).sort((a,b)=>b.quality-a.quality)[0]
  const top3=[...(S.teams||[])].sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,3)
  const disappointment=top3.find(t=>(S.roundReached?.[t.name]||'Group')==='Group') || top3.find(t=>['Group','Round of 32','Round of 16'].includes(S.roundReached?.[t.name]))
  const stories=[]
  if(aw.topScorer){
    const reached=S.roundReached?.[aw.topScorer.team]||'Group'
    const finishText={Winner:'the title',Final:'the final',Third:'third place',Fourth:'fourth place','Semi-finals':'the semi-finals','Quarter-finals':'the quarter-finals'}[reached]||'the tournament'
    stories.push(`<b>${aw.topScorer.name}</b> finished as top scorer with ${aw.topScorer.goals} goals and carried ${aw.topScorer.team} to ${finishText}.`)
  }
  const mvp=aw.mvp||aw.offMVP||aw.defMVP
  if(mvp){
    const previous=hist.slice(0,-1).filter(h=>(h.awards?.mvp?.name||h.awards?.offMVP?.name||h.awards?.defMVP?.name)===mvp.name).length
    stories.push(`<b>${mvp.name}</b> was named Player of the Tournament${previous?` for the ${previous+1}${previous===1?'nd':previous===2?'rd':'th'} time. ${previous===1?'No player before had won it twice.':''}`:'.'}`)
  }
  if(disappointment) stories.push(`<b>${disappointment.name}</b> were the great disappointment: ranked among the three pre-tournament favorites, they exited in the ${S.roundReached?.[disappointment.name]||'group stage'}.`)
  if(topGame){
    const comeback=(topGame.comeback||false)?' with a major comeback':''
    stories.push(`The best game was <b>${topGame.t1name} ${topGame.g1}–${topGame.g2} ${topGame.t2name}</b>, a ${topGame.quality.toFixed(1)}/10 ${topGame.round||'World Cup'} classic${comeback}.`)
  }
  if(!stories.length)return ''
  return `<div class="sec">🗞️ WORLD CUP REVIEW</div><div class="wc-review"><div class="wc-review-kicker">THE FINAL EDITION</div><div class="wc-review-head">THE STORY OF WORLD CUP ${S.currentYear||''}</div>${stories.map((x,i)=>`<div class="wc-review-story"><span>${i+1}</span><p>${x}</p></div>`).join('')}</div>`
}

// ── PLAY tab ──────────────────────────────────────────────────
function renderPlay() {
  const el = $('tab-play'); if (!el) return
  const p = S.phase || 'idle'

  if (!S.teams?.length) {
    el.innerHTML = `<div style="text-align:center;padding:48px 16px">
      <div style="font-size:64px;margin-bottom:12px">⚽</div>
      <div class="hero-title"><span class="l1">WORLD</span> <span class="l2">CUP</span></div>
      <div style="color:var(--txt2);margin:8px 0 24px">48 nations. 3 stars each. One champion.</div>
      <button class="btn btn-primary" onclick="handleMain()" style="padding:12px 32px;font-size:15px">▶ Begin World Cup ${S.wcNumber||1}</button>
    </div>`
    return
  }

  let html = ''
  if (p === 'done') {
    const aw = S.seasonAwards || {}
    const champStars = S.champion?.stars || []
    html = `
      <div class="champion-banner grand" style="--c1:${natColors(S.champion?.cc)[0]};--c2:${natColors(S.champion?.cc)[1]}">
        <div class="champ-trophy">🏆</div>
        <div class="champ-title">WORLD CUP #${S.wcNumber} CHAMPIONS</div>
        <div class="champ-name">${flag(S.champion?.cc||'',28)} ${S.champion?.name}</div>
        ${champStars.length?`<div class="champ-stars">${champStars.map(s=>`<span class="champ-star" style="color:${tierColor(s.tier)}">⭐ ${s.name}${(s.goals||0)>0?` (${s.goals}⚽)`:''}</span>`).join('')}</div>`:''}
      </div>
      ${aw.topScorer||aw.offMVP||aw.defMVP?`
      <div class="sec">TOURNAMENT AWARDS</div>
      <div class="awards-grid">
        ${aw.topScorer?`<div class="award-card"><div class="award-icon">⚽</div><div class="award-label">Top Scorer</div><div class="award-name">${aw.topScorer.name}</div><div class="award-sub">${aw.topScorer.goals} goals · ${aw.topScorer.team}</div></div>`:''}
        ${aw.offMVP?`<div class="award-card"><div class="award-icon">🌟</div><div class="award-label">Offensive MVP</div><div class="award-name">${aw.offMVP.name}</div><div class="award-sub">${aw.offMVP.rating} avg · ${aw.offMVP.pos}</div></div>`:''}
        ${aw.defMVP?`<div class="award-card"><div class="award-icon">🛡️</div><div class="award-label">Defensive MVP</div><div class="award-name">${aw.defMVP.name}</div><div class="award-sub">${aw.defMVP.rating} avg · ${aw.defMVP.pos}</div></div>`:''}
      </div>`:''}
      ${renderTournamentEpilogue()}
      ${renderTopScorers()}
      ${renderStorylineFeed(12)}`
  } else if (p === 'groups') {
    const played = S.groupMatches.filter(m=>m.played).length, total=S.groupMatches.length
    html = `<div class="sec">GROUP STAGE — ${played}/${total}</div>
      <div class="prog-wrap"><div class="prog-bar" style="width:${total?played/total*100:0}%"></div></div>
      <div class="row" style="gap:6px;margin-bottom:10px">
        <button class="btn btn-sm" onclick="skipAllGroups()">⏭⏭ Skip All Groups</button>
      </div>
      ${renderLiveWidgets()}
      ${renderStorylineFeed(5)}
      ${renderRecentResults()}`
  } else if (p === 'knockout') {
    const round = getCurrentKORound()
    html = `<div class="sec">${round?.name?.toUpperCase()||'KNOCKOUT'}</div>
      <div class="row" style="gap:6px;margin-bottom:10px">
        <button class="btn btn-sm" onclick="skipKORound()">⏭ Skip This Round</button>
      </div>
      ${renderLiveWidgets()}
      ${renderStorylineFeed(5)}
      ${renderRecentResults()}`
  } else if (p === 'qualified') {
    html = `${renderStorylineFeed(6)}
      <div class="sec">QUALIFIED NATIONS (${S.teams?.length||0})</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px">
        ${[...(S.teams||[])].sort((a,b)=>b.rating-a.rating).map(t=>`
          <div class="card card-click" style="padding:7px 10px" onclick="openTeamModal('${t.name}')">
            <div class="row"><span>${flag(t.cc)}</span><span style="font-weight:600;font-size:12px">${t.name}</span><span class="spacer"></span><span style="font-family:var(--font-head);color:var(--gold2)">${t.rating}</span></div>
            <div style="font-size:10px;color:var(--txt3);margin-top:2px">${t.tier?.toUpperCase()} · ${(t.stars||[]).map(s=>`<span style="color:${tierColor(s.tier)}">⭐</span>`).join('')}</div>
          </div>`).join('')}
      </div>`
  }
  el.innerHTML = html
}

function renderTopScorers() {
  const sc = Object.entries(S.scorers||{}).sort((a,b)=>b[1]-a[1]).slice(0,5)
  if (!sc.length) return ''
  return `<div class="sec">TOP SCORERS</div><div class="card"><table class="data-table"><tbody>
    ${sc.map(([name,g],i)=>`<tr><td style="color:var(--txt3);width:20px">${i+1}</td><td style="font-weight:600">${name}</td><td style="color:var(--gold);font-family:var(--font-head)">${g} ⚽</td></tr>`).join('')}
  </tbody></table></div>`
}

function renderRecentResults() {
  const recent = [...(S.allMatchResults||[])].reverse().slice(0,4)
  if (!recent.length) return ''
  return `<div class="sec">RECENT RESULTS</div>` + recent.map(r=>`
    <div class="match-result-card">
      <div class="match-teams">
        <div class="match-team" onclick="openTeamModal('${r.t1name}')">${flag(r.t1cc)} ${r.t1name}</div>
        <div class="match-score" style="font-size:20px">${r.g1}–${r.g2}</div>
        <div class="match-team right" onclick="openTeamModal('${r.t2name}')">${r.t2name} ${flag(r.t2cc)}</div>
      </div>
    </div>`).join('')
}

// ── GROUPS tab ────────────────────────────────────────────────
function renderGroups() {
  const el = $('tab-groups'); if (!el||!S.groups?.length){if(el)el.innerHTML='<div class="empty">Groups not drawn yet</div>';return}
  let html = '<div class="groups-grid">'
  S.groups.forEach((grp, gi) => {
    const sorted = groupStandings(grp)
    html += `<div class="group-card">
      <div class="group-title">Group ${grp.id}
        <button class="btn btn-sm" style="font-size:9px;margin-left:auto" onclick="skipGroup(${gi})">⏭ Skip</button>
      </div>
      <div class="gtable">
        <div class="gtable-head">
          <span class="gt-team"></span>
          <span>OVR</span><span>W</span><span>D</span><span>L</span><span>GF</span><span>GA</span><span>GD</span><span class="gt-pts">Pts</span>
        </div>
        ${sorted.map((t,i)=>{
          const eff = getEffStats(t)
          const o = Math.round((eff.attack+eff.defense+eff.stamina+eff.mental+eff.setPieces)/5)
          const [c1,c2] = natColors(t.cc)
          const gd = (t.gf||0)-(t.ga||0)
          const topStar = (t.stars||[]).find(s=>['generational','legendary'].includes(s.tier))
          return `<div class="gtable-row ${i<2?'qualifies':''}" onclick="openTeamModal('${t.name}')" style="--c1:${c1};--c2:${c2}">
            <span class="gt-team">
              <span class="gt-stripe"></span>
              ${flag(t.cc,18)}
              <span class="gt-name">${t.name}</span>
              ${topStar?`<span style="color:${tierColor(topStar.tier)};font-size:9px">⭐</span>`:''}
            </span>
            <span class="gt-ovr">${o}</span>
            <span>${t.w||0}</span><span>${t.d||0}</span><span>${t.l||0}</span>
            <span>${t.gf||0}</span><span>${t.ga||0}</span>
            <span class="${gd>0?'gt-pos':gd<0?'gt-neg':''}">${gd>0?'+':''}${gd}</span>
            <span class="gt-pts">${t.pts||0}</span>
          </div>`
        }).join('')}
      </div>
    </div>`
  })
  html += '</div>'
  const played = S.groupMatches?.filter(m=>m.played)||[]
  if (played.length) {
    html += '<div class="sec">RECENT RESULTS</div>'
    html += played.slice(-6).reverse().map(m=>`<div class="match-result-card" style="padding:8px 10px">
      <div style="font-size:9px;color:var(--txt3);font-family:var(--font-head)">GROUP ${S.groups[m.gi]?.id}</div>
      <div class="match-teams" style="margin-top:2px">
        <div class="match-team" onclick="event.stopPropagation();openTeamModal('${m.t1.name}')">${flag(m.t1.cc)} ${m.t1.name}</div>
        <div class="match-score" style="font-size:18px">${m.result.g1}–${m.result.g2}</div>
        <div class="match-team right" onclick="event.stopPropagation();openTeamModal('${m.t2.name}')">${m.t2.name} ${flag(m.t2.cc)}</div>
      </div>
    </div>`).join('')
  }
  el.innerHTML = html
}

// ── BRACKET tab ───────────────────────────────────────────────
function renderBracket() {
  const el = $('tab-bracket'); if(!el||!S.knockoutRounds?.length){if(el)el.innerHTML='<div class="empty">Knockout not started</div>';return}
  const initialRound = S.knockoutRounds?.[0]?.name || 'Round of 16'
  const roundOrder = [initialRound, 'Round of 16','Quarter-finals','Semi-finals','Third Place','Final'].filter((n,i,a)=>a.indexOf(n)===i)
  const roundMap = {}
  S.knockoutRounds.forEach(r => { roundMap[r.name]=r })
  let html='<div class="bracket-scroll"><div class="bracket-rounds">'
  roundOrder.forEach(name => {
    const round=roundMap[name]
    html+=`<div class="bracket-col"><div class="bracket-round-name">${name}</div>`
    if (round) {
      round.matches.forEach(m=>{
        const w=m.result?.winner
        const c1 = m.t1?natColors(m.t1.cc):['#444','#222'], c2 = m.t2?natColors(m.t2.cc):['#444','#222']
        const click1 = m.t1?`onclick="openTeamModal('${m.t1.name.replace(/'/g,"\\'")}')" style="--c1:${c1[0]};--c2:${c1[1]};cursor:pointer"`:`style="--c1:${c1[0]};--c2:${c1[1]}"`
        const click2 = m.t2?`onclick="openTeamModal('${m.t2.name.replace(/'/g,"\\'")}')" style="--c1:${c2[0]};--c2:${c2[1]};cursor:pointer"`:`style="--c1:${c2[0]};--c2:${c2[1]}"`
        html+=`<div class="bracket-match">
          <div class="bracket-team ${w?w===m.t1?'winner':'loser':''} ${!m.t1?'tbd':''}" ${click1}>${m.t1?`<span class="bt-stripe"></span>${flag(m.t1.cc,16)}<span class="bt-name">${m.t1.name}</span>`:'<span class="bt-name">-</span>'}${m.result?`<span class="bracket-score">${m.result.g1}</span>`:''}</div>
          <div class="bracket-team ${w?w===m.t2?'winner':'loser':''} ${!m.t2?'tbd':''}" ${click2}>${m.t2?`<span class="bt-stripe"></span>${flag(m.t2.cc,16)}<span class="bt-name">${m.t2.name}</span>`:'<span class="bt-name">-</span>'}${m.result?`<span class="bracket-score">${m.result.g2}</span>`:''}</div>
        </div>`
      })
    } else {
      const slots = { 'Round of 32':16, 'Round of 16':8, 'Quarter-finals':4, 'Semi-finals':2, 'Third Place':1, 'Final':1 }[name] || 1
      for(let i=0;i<slots;i++) html+=`<div class="bracket-match"><div class="bracket-team tbd"><span class="bt-name">TBD</span></div><div class="bracket-team tbd"><span class="bt-name">TBD</span></div></div>`
    }
    html+='</div>'
  })
  if (S.champion) html+=`<div class="bracket-col"><div class="bracket-round-name">CHAMPION</div><div class="bracket-match bracket-champ"><div class="bracket-team">🏆 ${flag(S.champion.cc,18)} ${S.champion.name}</div></div></div>`
  html+='</div></div>'
  el.innerHTML=html
}

// ── STARS tab ─────────────────────────────────────────────────
let starSortKey = 'tier', starFilter = 'all', starStatus = 'active'

function renderStars() {
  const el = $('tab-stars'); if (!el) return
  const activeStars = []
  ALL_NATIONS.forEach(n => (n.stars||[]).forEach(s => activeStars.push({...s,teamName:n.name,cc:n.cc,_active:true})))
  const retiredStars = (S.legends||[]).map(l => ({...l,teamName:l.teamName,cc:l.cc,_active:false,_retired:true}))

  let pool = starStatus==='active' ? activeStars : starStatus==='retired' ? retiredStars : [...activeStars,...retiredStars]
  const filtered = starFilter==='all' ? pool : pool.filter(s=>s.pos===starFilter)
  const sortFns = {
    tier:  (a,b)=>TIER_ORDER.indexOf(a.tier)-TIER_ORDER.indexOf(b.tier),
    goals: (a,b)=>((b.goals||b.careerGoals||0))-((a.goals||a.careerGoals||0)),
    fame:  (a,b)=>(b.fame||0)-(a.fame||0),
    name:  (a,b)=>a.name.localeCompare(b.name),
  }
  const sorted = [...filtered].sort(sortFns[starSortKey]||sortFns.tier)

  el.innerHTML = `
    <div class="filter-row">
      Status: ${[['active','Active'],['retired','Retired'],['all','All']].map(([f,lbl])=>`<button class="filter-btn ${starStatus===f?'active':''}" onclick="setStarStatus('${f}')">${lbl}</button>`).join('')}
    </div>
    <div class="filter-row">
      Sort: ${['tier','goals','fame','name'].map(k=>`<button class="filter-btn ${starSortKey===k?'active':''}" onclick="setStarSort('${k}')">${k}</button>`).join('')}
    </div>
    <div class="filter-row">
      Filter: ${['all','FWD','MID','DEF','GK'].map(f=>`<button class="filter-btn ${starFilter===f?'active':''}" onclick="setStarFilter('${f}')">${f}</button>`).join('')}
    </div>
    <div style="font-size:11px;color:var(--dim);margin-bottom:8px">${sorted.length} ${starStatus==='retired'?'retired legends':starStatus==='all'?'stars (active + retired)':'active stars'} shown</div>
    <div class="star-grid">
      ${sorted.length===0?'<div class="empty">None yet — retired stars appear here after players hang up their boots.</div>':sorted.map(s=>{
        const avgR = s.allTimeRatings?.length ? (s.allTimeRatings.reduce((a,b)=>a+b,0)/s.allTimeRatings.length).toFixed(1) : null
        const bonus = Object.entries(s.statBonus||{}).filter(([,v])=>v>0).map(([k,v])=>`+${v} ${k.slice(0,3).toUpperCase()}`).join(' ')
        const goals = s.goals||s.careerGoals||0
        const clickHandler = s._retired ? `onclick="openStarByName('${s.name.replace(/'/g,"\\'")}','${(s.teamName||'').replace(/'/g,"\\'")}')"` : `onclick="openStarModal('${s.id}','${s.teamName}')"`
        return `<div class="star-card ${s.tier}" ${clickHandler} style="${s._retired?'opacity:.85':''}">
          <div class="row" style="margin-bottom:3px">${tierBadge(s.tier)}<span class="star-pos">${s.pos}</span><span class="spacer"></span>${s._retired?'<span style="font-size:9px;color:var(--dim)">RETIRED</span>':`<span style="font-size:10px;color:var(--dim)">⚡${s.fame||0}</span>`}</div>
          <div class="star-name">${s.name}</div>
          <div class="star-team">${flag(s.cc)} ${s.teamName}</div>
          <div style="font-size:10px;color:${tierColor(s.tier)};margin-top:3px">${bonus}</div>
          <div class="star-stats">
            <span class="star-stat">⚽ <span>${goals}</span></span>
            ${avgR?`<span class="star-stat">★ <span>${avgR}</span></span>`:''}
            ${s._retired?`<span class="star-stat">${s.wcsPlayed||s.wcsActuallyPlayed||0} WCs</span>`:`<span class="star-stat">WC <span>${s.wcsRemaining||0} left</span></span>`}
            ${s.medals?.gold?`<span class="star-stat">🥇<span>${s.medals.gold}</span></span>`:''}
          </div>
        </div>`
      }).join('')}
    </div>`
}
window.setStarSort   = k => { starSortKey=k; renderStars() }
window.setStarFilter = f => { starFilter=f; renderStars() }
window.setStarStatus = s => { starStatus=s; renderStars() }

// Resolve a player by name → open their modal (records aggregate by name)
window.openStarByName = function(name, teamName) {
  // Try the named team first, then search all nations
  let nation = teamName ? ALL_NATIONS.find(n=>n.name===teamName) : null
  let star = nation ? (nation.stars||[]).find(s=>s.name===name) : null
  if (!star) {
    for (const n of ALL_NATIONS) {
      const s = (n.stars||[]).find(x=>x.name===name)
      if (s) { star = s; nation = n; break }
    }
  }
  if (star && nation) { window.openStarModal(star.id, nation.name); return }
  // Player has retired — show a lightweight legend card from the archive
  const legend = (S.legends||[]).find(l=>l.name===name)
  if (legend) openLegendModal(legend)
}

function openLegendModal(l) {
  const [c1,c2] = natColors(l.cc)
  $('team-modal-content').innerHTML = `
    <div class="team-modal-hero" style="--c1:${c1};--c2:${c2}">
      <div style="font-size:36px">${flag(l.cc,30)}</div>
      <div style="flex:1;min-width:0">
        <div class="tmh-name" style="font-size:20px">${l.name} <span style="font-size:11px;opacity:.8">(retired)</span></div>
        <div class="tmh-sub">${l.pos} · ${l.teamName} · ${TIER_LABELS[l.tier]||l.tier}</div>
      </div>
      <button class="pb-close" onclick="closeTeamModal()" style="color:#fff">✕</button>
    </div>
    <div class="modal-pad">
      <div class="sec">CAREER (RETIRED)</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">
        <div class="pv-stat"><span class="pl">GOALS</span><span class="pv" style="color:var(--hot)">${l.careerGoals||0}</span></div>
        <div class="pv-stat"><span class="pl">WCS</span><span class="pv">${l.wcsPlayed||l.wcsActuallyPlayed||0}</span></div>
        <div class="pv-stat"><span class="pl">FAME</span><span class="pv" style="color:var(--cyan)">${l.fame||0}</span></div>
      </div>
      <div class="sec">MEDALS</div>
      <div class="card" style="display:flex;gap:18px;justify-content:space-around">
        <div style="text-align:center"><div style="font-size:22px">🥇</div><div style="font-family:var(--font-pop);font-size:16px;color:var(--yolk)">${l.medals?.gold||0}</div></div>
        <div style="text-align:center"><div style="font-size:22px">🥈</div><div style="font-family:var(--font-pop);font-size:16px">${l.medals?.silver||0}</div></div>
        <div style="text-align:center"><div style="font-size:22px">🥉</div><div style="font-family:var(--font-pop);font-size:16px">${l.medals?.bronze||0}</div></div>
      </div>
      <div style="font-size:11px;color:var(--dim);margin-top:10px">Retired after World Cup #${l.retiredWC||'—'}</div>
    </div>`
  $('team-modal-overlay').style.display='flex'
}

window.openStarModal = function(starId, teamName) {
  const nation = ALL_NATIONS.find(n=>n.name===teamName)
  const star = (nation?.stars||[]).find(s=>s.id===starId)
  if (!star) return
  const [c1,c2] = natColors(star.cc)

  // Per-edition history from playerSeasons (include DNQ rows where the player
  // existed in that edition's world but their nation didn't field them / DNQ)
  const hist = S.history || []
  const seasons = []
  let totEd=0, totGames=0, totGoals=0
  let totOffMVP=0, totDefMVP=0, totBoot=0
  let ratingSum=0, ratedGames=0
  hist.forEach(h => {
    const ps = (h.playerSeasons||[]).find(x=>x.name===star.name && x.team===teamName)
    if (ps) {
      totEd++; totGames+=ps.games||0; totGoals+=ps.goals||0
      totOffMVP+=ps.offMVP||0; totDefMVP+=ps.defMVP||0; totBoot+=ps.goldenBoot||0
      if (ps.avgRating && ps.games) { ratingSum += ps.avgRating * ps.games; ratedGames += ps.games }
      seasons.push({ wc:h.wcNumber, reached:ps.reached, games:ps.games||0, goals:ps.goals||0,
                     avg:ps.avgRating||0, offMVP:ps.offMVP||0, defMVP:ps.defMVP||0, boot:ps.goldenBoot||0 })
    } else if (h.wcNumber >= (star.wcStart||1)) {
      // Player was around but their team didn't qualify
      seasons.push({ wc:h.wcNumber, reached:'DNQ', games:0, goals:0, avg:0, offMVP:0, defMVP:0, boot:0, dnq:true })
    }
  })
  // Include current (in-progress) WC ratings not yet in history
  if (star.ratings?.length) {
    const cur = star.ratings.reduce((a,b)=>a+b,0)
    ratingSum += cur; ratedGames += star.ratings.length
  }
  const avgR = ratedGames ? (ratingSum / ratedGames).toFixed(2) : '—'
  // Career award totals = historical + nation's stored awards (covers current)
  const awOff = star.awards?.offMVP || totOffMVP
  const awDef = star.awards?.defMVP || totDefMVP
  const awBoot = star.awards?.goldenBoot || totBoot

  const finishLabel = r => ({Winner:'🏆 Champion',Final:'🥈 Final',Third:'🥉 Third',Fourth:'4th','Semi-finals':'SF','Quarter-finals':'QF','Round of 16':'R16',Group:'Groups',DNQ:'DNQ'})[r]||r
  const finishColor = r => r==='Winner'?'var(--yolk)':r==='Final'?'#c0c0c0':r==='Third'?'#cd7f32':r==='DNQ'?'var(--red)':'var(--chalk)'
  const awTags = s => [s.boot?'⚽':'', s.offMVP?'🌟':'', s.defMVP?'🛡️':''].filter(Boolean).join(' ')

  $('team-modal-content').innerHTML = `
    <div class="team-modal-hero" style="--c1:${c1};--c2:${c2}">
      <div style="font-size:36px">${flag(star.cc,30)}</div>
      <div style="flex:1;min-width:0">
        <div class="tmh-name" style="font-size:20px">${star.name}</div>
        <div class="tmh-sub">${star.pos} · ${teamName} · ${TIER_LABELS[star.tier]||star.tier}</div>
      </div>
      <button class="pb-close" onclick="closeTeamModal()" style="color:#fff">✕</button>
    </div>
    <div class="modal-pad">

    <div class="sec">CAREER</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:10px">
      <div class="pv-stat"><span class="pl">GOALS</span><span class="pv" style="color:var(--hot)">${star.careerGoals||star.goals||0}</span></div>
      <div class="pv-stat"><span class="pl">GAMES</span><span class="pv">${totGames+(star.ratings?.length||0)}</span></div>
      <div class="pv-stat"><span class="pl">WCS</span><span class="pv">${star.wcsActuallyPlayed||0}</span></div>
      <div class="pv-stat"><span class="pl">LEFT</span><span class="pv">${star.wcsRemaining||0}</span></div>
      <div class="pv-stat"><span class="pl">AVG</span><span class="pv" style="color:var(--cyan)">${avgR}</span></div>
    </div>

    <div class="sec">AWARDS</div>
    <div class="awards-grid">
      <div class="award-card"><div class="award-icon">⚽</div><div class="award-label">Golden Boots</div><div class="award-name" style="color:var(--yolk)">${awBoot}</div></div>
      <div class="award-card"><div class="award-icon">🌟</div><div class="award-label">Off. MVP</div><div class="award-name" style="color:var(--hot)">${awOff}</div></div>
      <div class="award-card"><div class="award-icon">🛡️</div><div class="award-label">Def. MVP</div><div class="award-name" style="color:var(--cyan)">${awDef}</div></div>
    </div>

    <div class="sec">MEDALS</div>
    <div class="card" style="display:flex;gap:18px;justify-content:space-around">
      <div style="text-align:center"><div style="font-size:22px">🥇</div><div style="font-family:var(--font-pop);font-size:16px;color:var(--yolk)">${star.medals?.gold||0}</div></div>
      <div style="text-align:center"><div style="font-size:22px">🥈</div><div style="font-family:var(--font-pop);font-size:16px">${star.medals?.silver||0}</div></div>
      <div style="text-align:center"><div style="font-size:22px">🥉</div><div style="font-family:var(--font-pop);font-size:16px">${star.medals?.bronze||0}</div></div>
      <div style="text-align:center"><div style="font-size:22px">⚡</div><div style="font-family:var(--font-pop);font-size:16px;color:var(--cyan)">${star.fame||0}</div></div>
    </div>

    ${seasons.length?`
    <div class="sec">YEAR BY YEAR</div>
    <div class="table-wrap"><table class="data-table compact">
      <thead><tr><th>WC</th><th>Finish</th><th class="num">P</th><th class="num">⚽</th><th class="num">Score</th><th>Awards</th></tr></thead>
      <tbody>${seasons.map(s=>`<tr>
        <td style="color:var(--dim)">#${s.wc}</td>
        <td style="color:${finishColor(s.reached)};font-weight:700;font-size:11px">${finishLabel(s.reached)}</td>
        <td class="num">${s.dnq?'—':s.games||'—'}</td>
        <td class="num" style="color:var(--hot)">${s.dnq?'—':(s.goals||'—')}</td>
        <td class="num">${s.dnq||!s.avg?'—':s.avg.toFixed(1)}</td>
        <td style="font-size:11px">${awTags(s)||'—'}</td>
      </tr>`).join('')}</tbody>
    </table></div>`:'<div style="font-size:12px;color:var(--dim);margin-top:8px">No completed editions yet</div>'}

    <div class="sec">STAT BONUSES</div>
    ${Object.entries(star.statBonus||{}).filter(([,v])=>v>0).map(([k,v])=>`
      <div class="stat-row">
        <span class="stat-lbl">${k}</span>
        <div class="stat-bar-wrap"><div class="stat-bar" style="width:${Math.round(v/0.5)}%"></div></div>
        <span class="stat-val">+${v}</span>
      </div>`).join('')}
    </div>
  `
  $('team-modal-overlay').style.display='flex'
}

// ── NATIONS tab ───────────────────────────────────────────────
let nationsSortKey = 'ovr', nationsSortDir = 'desc'

function renderNations() {
  const el = $('tab-nations'); if (!el||!S.teams?.length){if(el)el.innerHTML='<div class="empty">No nations qualified yet</div>';return}
  // Compute effective stats for each team once
  const rows = S.teams.map(t => {
    const eff = getEffStats(t)
    const o = Math.round((eff.attack+eff.defense+eff.stamina+eff.mental+eff.setPieces)/5)
    return { t, eff, o }
  })
  const sortVal = r => {
    switch(nationsSortKey) {
      case 'name': return r.t.name
      case 'tier': return ({top:3,mid:2,rest:1})[r.t.tier]||0
      case 'atk': return r.eff.attack
      case 'def': return r.eff.defense
      case 'sta': return r.eff.stamina
      case 'men': return r.eff.mental
      case 'set': return r.eff.setPieces
      case 'ovr': default: return r.o
    }
  }
  rows.sort((a,b) => {
    const va = sortVal(a), vb = sortVal(b)
    const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb
    return nationsSortDir === 'desc' ? -cmp : cmp
  })
  const arrow = k => nationsSortKey===k ? (nationsSortDir==='desc'?' ▼':' ▲') : ''
  const th = (k, label, cls='') => `<th class="${cls} sortable" onclick="sortNations('${k}')">${label}${arrow(k)}</th>`

  el.innerHTML = `<div class="table-wrap"><table class="data-table">
    <thead><tr>
      <th>#</th>
      ${th('name','Nation')}
      ${th('tier','Tier')}
      ${th('atk','ATK','num')}${th('def','DEF','num')}${th('sta','STA','num')}
      ${th('men','MEN','num')}${th('set','SET','num')}${th('ovr','OVR','num')}
      <th>Stars</th>
    </tr></thead>
    <tbody>${rows.map((r,i)=>{
      const {t,eff,o}=r, stars=t.stars||[]
      const [c1,c2]=natColors(t.cc)
      return`<tr>
        <td style="color:var(--dim)">${i+1}</td>
        <td class="c-name" onclick="openTeamModal('${t.name}')" style="--c1:${c1};--c2:${c2}"><span class="nstripe"></span>${flag(t.cc,16)} <strong>${t.name}</strong>${t.isHost?' 🏠':''}</td>
        <td><span style="font-size:10px;color:${t.tier==='top'?'var(--yolk)':t.tier==='mid'?'var(--green)':'var(--dim)'}">${t.tier?.toUpperCase()}</span></td>
        <td class="num" style="color:var(--cyan)">${eff.attack}</td>
        <td class="num" style="color:var(--cyan)">${eff.defense}</td>
        <td class="num" style="color:var(--cyan)">${eff.stamina}</td>
        <td class="num" style="color:var(--cyan)">${eff.mental}</td>
        <td class="num" style="color:var(--cyan)">${eff.setPieces}</td>
        <td class="num" style="color:var(--yolk);font-family:var(--font-pop)">${o}</td>
        <td>${stars.map(s=>`<span style="color:${tierColor(s.tier)};font-size:14px" title="${s.name} (${s.pos}·${TIER_LABELS[s.tier]})">⭐</span>`).join('')}</td>
      </tr>`}).join('')}
    </tbody></table></div>`
}
window.sortNations = function(key) {
  if (nationsSortKey === key) nationsSortDir = nationsSortDir === 'desc' ? 'asc' : 'desc'
  else { nationsSortKey = key; nationsSortDir = key === 'name' ? 'asc' : 'desc' }
  renderNations()
}

// ── TEAM MODAL ────────────────────────────────────────────────
window.openTeamModal = function(teamName) {
  const team = S.teams?.find(t=>t.name===teamName)
  const nation = ALL_NATIONS.find(n=>n.name===teamName)
  if (!team && !nation) return
  const t = team || { name:teamName, cc:nation.cc, tier:nation.tier, stats:nation.stats, stars:nation.stars, mentalityDelta:0, rating:0 }
  const stars = (team?.stars || nation?.stars || [])
  const eff = getEffStats(t)
  const o = Math.round((eff.attack+eff.defense+eff.stamina+eff.mental+eff.setPieces)/5)
  const base = t.stats || {}
  // History
  const hist = S.history || []
  const titles  = hist.filter(h=>h.champion===teamName).length
  const finals  = hist.filter(h=>h.roundReached?.[teamName]==='Final').length
  const semis   = hist.filter(h=>['Semi-finals','Third','Fourth'].includes(h.roundReached?.[teamName])).length
  const statNames = {attack:'Attack',defense:'Defense',stamina:'Stamina',mental:'Mental',setPieces:'Set Pieces'}

  // Lifetime aggregates + per-edition rows from teamSeasons
  const seasons = []
  let totQual=0, totGames=0, totW=0, totGF=0, totGA=0
  hist.forEach(h => {
    const ts = (h.teamSeasons||[]).find(x=>x.name===teamName)
    if (ts) {
      totQual++; totGames+=ts.games||0; totW+=ts.w||0; totGF+=ts.gf||0; totGA+=ts.ga||0
      seasons.push({ wc:h.wcNumber, reached:ts.reached, games:ts.games||0, gf:ts.gf||0, ga:ts.ga||0 })
    } else {
      seasons.push({ wc:h.wcNumber, reached:'DNQ', games:0, gf:0, ga:0 })
    }
  })
  const finishLabel = r => ({Winner:'🏆 Champion',Final:'🥈 Final',Third:'🥉 Third',Fourth:'4th','Semi-finals':'SF','Quarter-finals':'QF','Round of 16':'R16',Group:'Groups',DNQ:'DNQ'})[r]||r
  const finishColor = r => r==='Winner'?'var(--yolk)':r==='Final'?'#c0c0c0':r==='Third'?'#cd7f32':r==='DNQ'?'var(--red)':'var(--chalk)'

  $('team-modal-content').innerHTML = `
    <div class="team-modal-hero" style="--c1:${natColors(t.cc)[0]};--c2:${natColors(t.cc)[1]}">
      <div style="font-size:40px">${flag(t.cc,32)}</div>
      <div style="flex:1;min-width:0">
        <div class="tmh-name">${t.name}</div>
        <div class="tmh-sub">${t.tier?.toUpperCase()||''} · OVR ${o}${t.rating?` · Rating ${t.rating}`:''}</div>
      </div>
      <button class="pb-close" onclick="closeTeamModal()" style="color:#fff">✕</button>
    </div>
    <div class="modal-pad">

    ${titles||finals||semis?`
    <div class="sec">HONOURS</div>
    <div class="row" style="gap:20px;margin-bottom:10px">
      ${titles?`<div style="text-align:center"><div style="font-size:26px">🏆</div><div style="font-family:var(--font-pop);font-size:22px;color:var(--yolk)">${titles}</div><div style="font-size:10px;color:var(--dim)">TITLES</div></div>`:''}
      ${finals?`<div style="text-align:center"><div style="font-size:26px">🥈</div><div style="font-family:var(--font-pop);font-size:22px">${finals}</div><div style="font-size:10px;color:var(--dim)">FINALS</div></div>`:''}
      ${semis?`<div style="text-align:center"><div style="font-size:26px">🥉</div><div style="font-family:var(--font-pop);font-size:22px">${semis}</div><div style="font-size:10px;color:var(--dim)">SEMIS</div></div>`:''}
    </div>`:''}

    ${totQual?`
    <div class="sec">ALL-TIME RECORD</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:10px">
      <div class="pv-stat"><span class="pl">QUALIF</span><span class="pv">${totQual}</span></div>
      <div class="pv-stat"><span class="pl">GAMES</span><span class="pv">${totGames}</span></div>
      <div class="pv-stat"><span class="pl">WINS</span><span class="pv">${totW}</span></div>
      <div class="pv-stat"><span class="pl">GF</span><span class="pv">${totGF}</span></div>
      <div class="pv-stat"><span class="pl">GA</span><span class="pv">${totGA}</span></div>
    </div>`:'<div style="font-size:12px;color:var(--dim);margin-bottom:10px">No World Cup history yet</div>'}

    ${t.soul || getSoul(t.name) ? `
    <div class="sec">NATIONAL SOUL</div>
    <div class="card" style="border-left:4px solid var(--grape)">
      <div style="font-family:var(--font-pop);font-size:13px;color:var(--grape)">${(t.soul || getSoul(t.name)).name}</div>
      <div style="font-size:12px;color:var(--chalk);margin-top:3px">${(t.soul || getSoul(t.name)).desc}</div>
    </div>`:''}

    <div class="sec">STATS</div>
    ${Object.entries(statNames).map(([k,label])=>{
      const bv=base[k]||75, ev=eff[k]||75, bonus=ev-bv
      return`<div class="stat-row">
        <span class="stat-lbl">${label}</span>
        <div class="stat-bar-wrap"><div class="stat-bar" style="width:${Math.round(ev/1.3)}%"></div></div>
        <span class="stat-val">${ev}</span>
        <span class="stat-bonus">${bonus>0?`+${bonus}`:''}</span>
      </div>`}).join('')}

    <div class="sec">STARS (${stars.length})</div>
    ${stars.map(s=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--line)">
      <div style="width:4px;height:36px;background:${tierColor(s.tier)};flex-shrink:0"></div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:13px">${s.name}</div>
        <div style="font-size:11px;color:var(--chalk)">${s.pos} · ${tierBadge(s.tier)} · ${s.wcsRemaining||0} WC${(s.wcsRemaining||0)!==1?'s':''} left</div>
        <div style="font-size:10px;color:var(--dim);margin-top:2px">⚽ ${s.goals||0} goals · ⚡ ${s.fame||0} fame</div>
      </div>
      <div style="text-align:right;font-size:11px;color:var(--dim)">
        ${s.medals?.gold?`🥇${s.medals.gold} `:''}${s.medals?.silver?`🥈${s.medals.silver}`:''}
      </div>
    </div>`).join('')}

    ${seasons.length?`
    <div class="sec">EDITION BY EDITION</div>
    <div class="table-wrap"><table class="data-table compact">
      <thead><tr><th>WC</th><th>Result</th><th class="num">P</th><th class="num">GF</th><th class="num">GA</th></tr></thead>
      <tbody>${seasons.map(s=>`<tr>
        <td style="color:var(--dim)">#${s.wc}</td>
        <td style="color:${finishColor(s.reached)};font-weight:700;font-size:11px">${finishLabel(s.reached)}</td>
        <td class="num">${s.games||'—'}</td>
        <td class="num">${s.reached==='DNQ'?'—':s.gf}</td>
        <td class="num">${s.reached==='DNQ'?'—':s.ga}</td>
      </tr>`).join('')}</tbody>
    </table></div>`:''}
    </div>
  `
  $('team-modal-overlay').style.display = 'flex'
}
window.closeTeamModal = () => { $('team-modal-overlay').style.display='none' }

// ── HISTORY tab ───────────────────────────────────────────────
let historySubTab = 'tournaments'
window.setHistoryTab = t => { historySubTab = t; renderHistory() }

function renderHistory() {
  const el = $('tab-history'); if (!el) return
  const tabs = `<div class="sub-tab-row">
    <button class="sub-tab ${historySubTab==='tournaments'?'active':''}" onclick="setHistoryTab('tournaments')">📜 Tournaments</button>
    <button class="sub-tab ${historySubTab==='records'?'active':''}" onclick="setHistoryTab('records')">📊 Records</button>
    <button class="sub-tab ${historySubTab==='goat'?'active':''}" onclick="setHistoryTab('goat')">🐐 GOAT</button>
  </div>`
  if (historySubTab === 'records') { el.innerHTML = tabs + renderRecords(); return }
  if (historySubTab === 'goat')    { el.innerHTML = tabs + renderGOAT(); return }
  if (!S.history?.length) { el.innerHTML = tabs + '<div class="empty">No history yet</div>'; return }
  el.innerHTML = tabs + renderTournamentsHistory()
}

// ── GOAT scoring: career body of work ──
function goatCandidates() {
  const map = new Map()
  const ensure = p => {
    if (!p?.name) return null
    if (!map.has(p.name)) map.set(p.name, {
      name:p.name, cc:p.cc||'', teamName:p.teamName||p.team||'', pos:p.pos||'', role:p.role||'', tier:p.tier||'common',
      careerGoals:p.careerGoals||0, fame:p.fame||0, medals:{...(p.medals||{})}, wcsPlayed:p.wcsActuallyPlayed||p.wcsPlayed||0,
      awards:{...(p.awards||{})}, games:0, matchMVPs:0, ratingSum:0, ratingGames:0, active:!!p.active
    })
    return map.get(p.name)
  }
  ;(S.legends||[]).forEach(p=>ensure(p))
  ALL_NATIONS.forEach(n => (n.stars || []).forEach(st => {
    const p=ensure({ ...st, cc:n.cc, teamName:n.name, active:true })
    if (!p) return
    p.careerGoals=Math.max(p.careerGoals||0,st.careerGoals||0)
    p.fame=Math.max(p.fame||0,st.fame||0)
    p.medals={...(st.medals||p.medals||{})}; p.awards={...(st.awards||p.awards||{})}
    p.wcsPlayed=st.wcsActuallyPlayed||st.wcsPlayed||p.wcsPlayed||0
  }))
  ;(S.history||[]).forEach(h=>{
    ;(h.playerSeasons||[]).forEach(ps=>{
      const p=ensure(ps); if(!p)return
      p.games += ps.games||0
      p.ratingSum += (ps.avgRating||0)*(ps.games||0)
      p.ratingGames += ps.games||0
    })
    ;(h.matches||[]).forEach(m=>{ if(m.mvp?.name){ const p=ensure(m.mvp); if(p)p.matchMVPs++ } })
  })
  map.forEach(p=>{
    const m=p.medals||{}, a=p.awards||{}
    p.avgRating=p.ratingGames? p.ratingSum/p.ratingGames : 0
    const titles=m.gold||0, runner=m.silver||0, bronze=m.bronze||0
    const tournamentMVPs=(a.offMVP||0)+(a.defMVP||0)
    const achievement = titles*115 + runner*35 + bronze*14
    const individual = (p.careerGoals||0)*5 + p.matchMVPs*7 + tournamentMVPs*70 + (a.goldenBoot||0)*38
    const consistency = p.games*1.4 + Math.max(0,p.avgRating-6.5)*p.games*2.2
    const winnerLeaderBonus = titles>0 ? titles*(18 + tournamentMVPs*18 + Math.min(35,(p.careerGoals||0)*1.2)) : 0
    const noTeamSuccessPenalty = titles===0 && runner===0 ? .72 : titles===0 ? .88 : 1
    p.goatScore=Math.round((achievement+individual+consistency+winnerLeaderBonus)*noTeamSuccessPenalty)
  })
  return [...map.values()].filter(p=>p.goatScore>0).sort((a,b)=>b.goatScore-a.goatScore)
}

function renderGOAT() {
  const list = goatCandidates().slice(0, 20)
  if (!list.length) return '<div class="empty">No careers yet — play some World Cups!</div>'
  return `<div class="sec">🐐 GREATEST OF ALL TIME</div>
    <div class="goat-list">
    ${list.map((p,i)=>`<div class="goat-row ${i===0?'goat-first':''}" onclick="openStarByName('${(p.name||'').replace(/'/g,"\\'")}','${(p.teamName||'').replace(/'/g,"\\'")}')" style="cursor:pointer">
      <div class="goat-rank">${i+1}</div>
      <div class="goat-main">
        <div class="goat-name">${flag(p.cc,18)} ${p.name} ${p.active?'<span class="goat-active">ACTIVE</span>':''}</div>
        <div class="goat-sub" style="color:${tierColor(p.tier)}">${TIER_LABELS[p.tier]||p.tier} ${p.role||p.pos} · ${p.teamName} · ${p.wcsPlayed||0} WCs</div>
        <div class="goat-stats">🎮 ${p.games||0} · ⚽ ${p.careerGoals||0} · ⭐ ${p.matchMVPs||0} · Avg ${p.avgRating?p.avgRating.toFixed(2):'—'} · 🥇${p.medals?.gold||0} 🥈${p.medals?.silver||0}</div>
      </div>
      <div class="goat-score">${p.goatScore}</div>
    </div>`).join('')}
    </div>`
}

// Aggregate all-time team stats across every edition's teamSeasons
function aggregateTeamRecords() {
  const teams = {}
  ;(S.history||[]).forEach(h => {
    // titles/finishes
    const bump = (name, cc, key) => {
      if (!name) return
      if (!teams[name]) teams[name] = { name, cc, titles:0, finals:0, seconds:0, thirds:0, fourths:0, qf:0, semis:0, qualified:0, games:0, gf:0, ga:0, wins:0 }
      teams[name][key]++
    }
    bump(h.champion, h.cc, 'titles')
    if (h.runnerUp) { bump(h.runnerUp.name, h.runnerUp.cc, 'finals'); bump(h.runnerUp.name,h.runnerUp.cc,'seconds') }
    // Semifinal appearances = 3rd + 4th place finishers
    if (h.third) { bump(h.third.name, h.third.cc, 'semis'); bump(h.third.name,h.third.cc,'thirds') }
    if (h.fourth) { bump(h.fourth.name, h.fourth.cc, 'semis'); bump(h.fourth.name,h.fourth.cc,'fourths') }
    ;(h.teamSeasons||[]).forEach(ts => {
      if (!teams[ts.name]) teams[ts.name] = { name:ts.name, cc:ts.cc, titles:0, finals:0, seconds:0, thirds:0, fourths:0, qf:0, semis:0, qualified:0, games:0, gf:0, ga:0, wins:0 }
      const t = teams[ts.name]
      if(ts.reached==='Quarter-finals')t.qf++; t.qualified++; t.games += ts.games||0; t.gf += ts.gf||0; t.ga += ts.ga||0; t.wins += ts.w||0
    })
  })
  return Object.values(teams)
}

// Aggregate all-time player stats across every edition's playerSeasons
function aggregatePlayerRecords() {
  const players = {}
  ;(S.history||[]).forEach(h => (h.playerSeasons||[]).forEach(ps => {
    if (!players[ps.name]) players[ps.name] = { name:ps.name, cc:ps.cc, team:ps.team, pos:ps.pos, tier:ps.tier, goals:0, games:0, editions:0, titles:0, finals:0, mvps:0, ratingSum:0, ratedGames:0 }
    const p = players[ps.name]
    p.goals += ps.goals||0; p.games += ps.games||0; p.editions++; p.titles += ps.reached==='Winner'?1:0; p.finals += ['Winner','Final'].includes(ps.reached)?1:0; p.mvps += (ps.offMVP||0)+(ps.defMVP||0)
    // Weighted rating: sum(avg × games) / total games
    if (ps.avgRating && ps.games) { p.ratingSum += ps.avgRating * ps.games; p.ratedGames += ps.games }
  }))
  Object.values(players).forEach(p => {
    p.avgRating = p.ratedGames ? +(p.ratingSum / p.ratedGames).toFixed(2) : 0
  })
  return Object.values(players)
}

function recordTopList(title, icon, rows, type) {
  if (!rows.length) return ''
  const clickFor = r => {
    if (type === 'team') return `onclick="openTeamModal('${(r.name||'').replace(/'/g,"\\'")}')" style="cursor:pointer"`
    if (type === 'player') return `onclick="openStarByName('${(r.name||'').replace(/'/g,"\\'")}','${(r.team||'').replace(/'/g,"\\'")}')" style="cursor:pointer"`
    return ''
  }
  return `<div class="cl-stat-card card">
    <div class="cl-stat-title">${icon} ${title}</div>
    <table class="data-table compact"><tbody>
    ${rows.map((r,i)=>`<tr ${clickFor(r)}>
      <td style="color:var(--dim);width:18px">${i+1}</td>
      <td>${r.cc?flag(r.cc,14)+' ':''}<strong>${r.name}</strong>${r.sub?` <span style="font-size:10px;color:var(--dim)">${r.sub}</span>`:''}</td>
      <td style="color:var(--yolk);font-family:var(--font-pop);font-weight:700;text-align:right">${r.val}</td>
    </tr>`).join('')}
    </tbody></table>
  </div>`
}

let recordSub='teams', recordSort='titles'
window.setRecordSub=t=>{recordSub=t;recordSort=t==='players'?'goals':t==='games'?'quality':'titles';renderHistory()}
window.setRecordSort=k=>{recordSort=k;renderHistory()}
function renderRecords(){
 const teams=aggregateTeamRecords(), players=aggregatePlayerRecords()
 const games=(S.history||[]).flatMap(h=>(h.matches||h.topGames||[]).map(m=>({...m,wc:h.wcNumber,year:h.year||wcYear(h.wcNumber)})))
 const tabs=`<div class="sub-tab-row"><button class="sub-tab ${recordSub==='teams'?'active':''}" onclick="setRecordSub('teams')">Teams</button><button class="sub-tab ${recordSub==='players'?'active':''}" onclick="setRecordSub('players')">Players</button><button class="sub-tab ${recordSub==='games'?'active':''}" onclick="setRecordSub('games')">Games</button></div>`
 const th=(k,l)=>`<th class="num sortable" onclick="setRecordSort('${k}')">${l}${recordSort===k?' ▼':''}</th>`
 if(recordSub==='players'){
  const rows=[...players].sort((a,b)=>(b[recordSort]||0)-(a[recordSort]||0)).slice(0,20)
  return tabs+`<div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Player</th>${th('games','Games')}${th('titles','Titles')}${th('finals','Finals')}${th('avgRating','Avg')}${th('goals','Goals')}${th('mvps','MVPs')}</tr></thead><tbody>${rows.map((p,i)=>`<tr onclick="openStarByName('${p.name.replace(/'/g,"\'")}','${p.team.replace(/'/g,"\'")}')"><td>${i+1}</td><td>${flag(p.cc,14)} <b>${p.name}</b><div class="tiny">${p.team} · ${p.pos}${p.role?' · '+p.role:''}</div></td><td class="num">${p.games}</td><td class="num">${p.titles}</td><td class="num">${p.finals}</td><td class="num">${p.avgRating||'—'}</td><td class="num">${p.goals}</td><td class="num">${p.mvps}</td></tr>`).join('')}</tbody></table></div>`
 }
 if(recordSub==='games'){
  const rows=[...games].sort((a,b)=>(b[recordSort]||0)-(a[recordSort]||0)).slice(0,50)
  return tabs+`<div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Match</th>${th('quality','Rating')}<th>Round</th><th>MVP</th><th>Edition</th></tr></thead><tbody>${rows.map((g,i)=>`<tr><td>${i+1}</td><td>${flag(g.t1cc,14)} <b>${g.t1name}</b> ${g.g1}–${g.g2} <b>${g.t2name}</b> ${flag(g.t2cc,14)}</td><td class="num">${g.quality||'—'}</td><td>${g.phase==='group'?'Group':g.round||'Knockout'}</td><td>${g.mvp?.name||'—'}</td><td>${g.year}</td></tr>`).join('')}</tbody></table></div>`
 }
 const rows=[...teams].sort((a,b)=>(b[recordSort]||0)-(a[recordSort]||0)).slice(0,50)
 return tabs+`<div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Nation</th>${th('qualified','WCs')}${th('games','Games')}${th('titles','Titles')}${th('seconds','2nd')}${th('thirds','3rd')}${th('fourths','4th')}${th('qf','QF')}${th('gf','Goals')}</tr></thead><tbody>${rows.map((t,i)=>`<tr onclick="openTeamModal('${t.name.replace(/'/g,"\'")}')"><td>${i+1}</td><td>${flag(t.cc,14)} <b>${t.name}</b></td><td class="num">${t.qualified}</td><td class="num">${t.games}</td><td class="num">${t.titles}</td><td class="num">${t.seconds}</td><td class="num">${t.thirds}</td><td class="num">${t.fourths}</td><td class="num">${t.qf}</td><td class="num">${t.gf}</td></tr>`).join('')}</tbody></table></div>`
}

function renderTournamentsHistory() {
  const hist = [...S.history].reverse()
  // Team rankings
  const teamRank = {}
  hist.forEach(h => {
    Object.entries(h.roundReached||{}).forEach(([name,reached])=>{
      if (!teamRank[name]) teamRank[name]={name,gold:0,final:0,semi:0,qf:0}
      if (reached==='Winner') teamRank[name].gold++
      else if (reached==='Final') teamRank[name].final++
      else if (reached==='Semi-finals') teamRank[name].semi++
      else if (reached==='Quarter-finals') teamRank[name].qf++
    })
  })
  const rankList = Object.values(teamRank).sort((a,b)=>b.gold-a.gold||b.final-a.final||b.semi-a.semi)
  // Star all-time data from ALL_NATIONS
  const playerData = {}
  ALL_NATIONS.forEach(n => (n.stars||[]).forEach(s=>{
    if (!playerData[s.name]) playerData[s.name]={name:s.name,pos:s.pos,tier:s.tier,goals:0,gold:0,silver:0,bronze:0,offMVP:0,defMVP:0,ts:0}
    const p=playerData[s.name]
    p.goals+=(s.goals||0)
    p.gold+=(s.medals?.gold||0); p.silver+=(s.medals?.silver||0); p.bronze+=(s.medals?.bronze||0)
  }))
  hist.forEach(h=>{
    if (h.awards?.offMVP?.name && playerData[h.awards.offMVP.name]) playerData[h.awards.offMVP.name].offMVP++
    if (h.awards?.defMVP?.name && playerData[h.awards.defMVP.name]) playerData[h.awards.defMVP.name].defMVP++
    if (h.awards?.topScorer?.name && playerData[h.awards.topScorer.name]) playerData[h.awards.topScorer.name].ts++
  })
  const pList = Object.values(playerData)

  return `
    <div class="sec">TOURNAMENT HISTORY</div>
    ${hist.map(h=>{
      const podium = (medal, t, cls) => t ? `<div class="podium-row" style="--c1:${natColors(t.cc)[0]};--c2:${natColors(t.cc)[1]}">
        <span class="podium-stripe"></span><span class="podium-medal">${medal}</span>
        ${flag(t.cc,16)} <span class="podium-name ${cls}">${t.name}</span>
      </div>` : ''
      return `<div class="history-card">
        <div class="history-wc">${h.year||wcYear(h.wcNumber)} · WORLD CUP #${h.wcNumber}${h.host?` · 🏟️ ${h.host}`:''}</div>
        <div class="podium">
          ${podium('🥇',{name:h.champion,cc:h.cc},'gold')}
          ${podium('🥈',h.runnerUp,'silver')}
          ${podium('🥉',h.third,'bronze')}
          ${podium('4',h.fourth,'fourth')}
        </div>
        <div style="font-size:11px;color:var(--txt3);margin-top:6px">${h.totalGoals||0} goals · Avg quality ${h.averageQuality||'—'}/10${h.awards?.topScorer?` · ⚽ ${h.awards.topScorer.name} (${h.awards.topScorer.goals})`:''}</div>
      </div>`
    }).join('')}

    <div class="sec">TEAM RANKINGS</div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>#</th><th>Nation</th><th class="num">🏆</th><th class="num">🥈</th><th class="num">SF</th><th class="num">QF</th></tr></thead>
      <tbody>${rankList.slice(0,20).map((t,i)=>`<tr>
        <td style="color:var(--txt3)">${i+1}</td>
        <td class="c-name" onclick="openTeamModal('${t.name}')"><strong>${t.name}</strong></td>
        <td class="num" style="color:var(--gold)">${t.gold||'—'}</td>
        <td class="num">${t.final||'—'}</td>
        <td class="num" style="color:var(--txt3)">${t.semi||'—'}</td>
        <td class="num" style="color:var(--txt3)">${t.qf||'—'}</td>
      </tr>`).join('')}</tbody>
    </table></div>`
}

// ── INTER-WC SCREEN ───────────────────────────────────────────
function showInterWC() {
  const { retiring, debuting, host, ratingChanges, era, year, format } = startNewWC()
  const NOTABLE = new Set(['generational','legendary','epic','rare'])
  const notableRet = retiring.filter(s=>NOTABLE.has(s.tier))
  const notableDeb = debuting.filter(s=>NOTABLE.has(s.tier))
  const hostNation = ALL_NATIONS.find(n => n.name === host)
  $('interwc-content').innerHTML = `
    <div class="hero-title" style="font-size:20px;margin-bottom:4px"><span class="l1">BETWEEN</span> <span class="l2">CUPS</span></div>
    <div style="font-size:12px;color:var(--txt2);margin-bottom:14px">${year} · WC #${S.wcNumber} · ${format?.label||''}</div>
    ${era?.powers?.length?`<div class="press-box"><div class="press-kicker">ERA WATCH</div><div class="press-head">NEW POWERS RISE</div><div class="press-body">${era.powers.map(p=>`${flag(p.cc,14)} ${p.name} (+${p.boost})`).join(' · ')}</div></div>`:''}

    <div class="interwc-host">
      <div style="font-size:32px">${flag(host, 32)}</div>
      <div>
        <div style="font-family:var(--font-head);font-size:11px;letter-spacing:.12em;color:var(--gold3)">HOST NATION</div>
        <div style="font-family:var(--font-head);font-size:20px;color:var(--gold2)">${host}</div>
        <div style="font-size:11px;color:var(--txt2)">Automatically qualifies for WC #${S.wcNumber}</div>
      </div>
    </div>

    ${ratingChanges?.length?`<div class="sec">FORM SHIFTS</div>
      <div class="interwc-ratings">
        ${ratingChanges.map(r=>`<div class="interwc-rating-row">
          <span>${flag(r.cc)} ${r.name}</span>
          <span style="color:${r.delta>0?'var(--green)':'var(--red)'};font-family:var(--font-head)">${r.delta>0?'▲':'▼'} ${r.prev}→${r.next}</span>
        </div>`).join('')}
      </div>`:''}

    ${notableRet.length?`<div class="sec">RETIRING STARS</div>`+notableRet.map(s=>`
      <div class="interwc-card retire">
        <div style="font-size:20px">${flag(s.cc)}</div>
        <div style="flex:1">
          <div style="font-family:var(--font-head);font-size:14px;color:var(--txt)">${s.name} <span style="color:${tierColor(s.tier)}">— ${TIER_LABELS[s.tier]}</span></div>
          <div style="font-size:11px;color:var(--txt2)">${s.teamName} · ${s.pos} · ⚽ ${s.goals||0} career goals · ${s.medals?.gold?`🥇${s.medals.gold}`:''}</div>
        </div>
      </div>`).join(''):''}
    ${notableDeb.length?`<div class="sec">RISING STARS</div>`+notableDeb.map(s=>`
      <div class="interwc-card debut">
        <div style="font-size:20px">${flag(s.cc)}</div>
        <div style="flex:1">
          <div style="font-family:var(--font-head);font-size:14px;color:var(--txt)">${s.name} <span style="color:${tierColor(s.tier)}">— ${TIER_LABELS[s.tier]}</span></div>
          <div style="font-size:11px;color:var(--txt2)">${s.teamName} · ${s.pos} · ${s.wcsTotal} WC career ahead</div>
        </div>
      </div>`).join(''):''}
    <button class="btn btn-primary" style="width:100%;margin-top:14px" onclick="continueNewWC()">Begin WC #${S.wcNumber} ▶</button>
  `
  $('interwc-overlay').style.display='flex'
}
window.continueNewWC = function() {
  $('interwc-overlay').style.display='none'
  $('wc-number').textContent=S.wcNumber
  updatePhaseUI(); renderPlay(); renderStars(); renderNations()
  toast(`World Cup #${S.wcNumber} begins!`)
}

// ── SETTINGS + SLOT SELECT ────────────────────────────────────
async function renderSlotSelect() {
  document.body.classList.add('slot-select-mode')
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'))
  $('tab-play').classList.add('active')
  const el = $('tab-play')
  const slots = await allSlotInfo()
  el.innerHTML = `
    <div style="text-align:center;padding:32px 16px 16px">
      <div style="font-size:60px;margin-bottom:10px">⚽</div>
      <div class="hero-title"><span class="l1">WORLD</span> <span class="l2">CUP</span></div>
      <div class="hero-sub">Pick a save slot to kick off</div>
    </div>
    <div class="slots-grid">
      ${[1,2,3].map(n => {
        const s = slots[n]
        if (!s) {
          return `<div class="slot-card empty-slot" onclick="startInSlot(${n})" style="cursor:pointer">
            <div class="slot-num">SLOT ${n}</div>
            <div class="slot-empty-label">+ New Game</div>
          </div>`
        }
        const last = s.history?.[s.history.length-1]
        return `<div class="slot-card">
          <div class="slot-num">SLOT ${n}</div>
          <div class="slot-info">
            <div class="slot-wc">World Cup #${s.wcNumber||1}</div>
            <div class="slot-meta">${(s.history||[]).length} editions played</div>
            ${last?`<div class="slot-meta">Last: ${flag(last.cc)} ${last.champion}</div>`:'<div class="slot-meta">In progress</div>'}
            <div class="slot-date">${new Date(s.savedAt).toLocaleDateString()}</div>
          </div>
          <div class="slot-actions">
            <button class="btn btn-sm btn-primary" onclick="continueInSlot(${n})">Continue</button>
            <button class="btn btn-sm" onclick="deleteHomeSlot(${n})">✕</button>
          </div>
        </div>`
      }).join('')}
    </div>`
}

window.startInSlot = async function(n) {
  setActiveSlot(n)
  S.wcNumber = 1; S.phase = 'idle'
  S.teams = []; S.groups = []; S.groupMatches = []; S.knockoutRounds = []
  S.history = []; S.champion = null; S.roundReached = {}
  S.scorers = {}; S.teamGoals = {}; S.teamGoalsConceded = {}; S.allMatchResults = []; S.seasonAwards = {}
  S.storylines = []; S.legends = []; S.records = {}; S.era=null; S.currentYear=1930; S.tournamentFormat=formatForYear(1930)
  resetNameTracking()
  ALL_NATIONS.forEach(nat => { delete nat.stars; delete nat.stats; delete nat._lastRating })
  initAllStars(1)
  await autoSave()
  document.body.classList.remove('slot-select-mode')
  updatePhaseUI(); switchTab('play')
  toast(`New game started in Slot ${n}`)
}

window.continueInSlot = async function(n) {
  try {
    await loadSlot(n)
    S.currentYear=S.currentYear||wcYear(S.wcNumber||1); S.tournamentFormat=S.tournamentFormat||formatForYear(S.currentYear); if (!ALL_NATIONS.some(nat=>nat.stars?.length)) initAllStars(S.wcNumber||1)
    document.body.classList.remove('slot-select-mode')
    updatePhaseUI(); switchTab('play')
    if (S.groups?.length) renderGroups()
    if (S.knockoutRounds?.length) renderBracket()
    toast(`Loaded Slot ${n} — WC #${S.wcNumber}`)
  } catch(e) { toast('Slot is empty') }
}

window.deleteHomeSlot = async function(n) {
  await deleteSlot(n)
  renderSlotSelect()
  toast(`Slot ${n} cleared`)
}

window.goHome = function() {
  closeSettings()
  setActiveSlot(null)
  renderSlotSelect()
}

window.openSettings  = () => {
  const slotBar = $('settings-slots')
  if (slotBar) {
    const active = getActiveSlot()
    slotBar.innerHTML = `
      <div style="padding:8px 14px;font-size:11px;color:var(--txt3);font-family:var(--font-head);letter-spacing:.08em">
        ${active ? `AUTOSAVING TO SLOT ${active}` : 'NO ACTIVE SLOT'}
      </div>
      <button class="settings-item" onclick="goHome()">🏠 Home (Slots)</button>`
  }
  $('settings-overlay').style.display='flex'
}
window.closeSettings = () => { $('settings-overlay').style.display='none' }
window.doExport = () => { closeSettings(); exportSave(); toast('Exported!') }
window.doImport = async function(ev) {
  const f=ev.target.files[0]; if(!f) return
  try { await importSave(f); updatePhaseUI(); renderPlay(); toast('Imported!') }
  catch(e) { toast('Import failed: '+e.message) }
  ev.target.value=''
}
let _cb=null
window.confirmReset = function() {
  closeSettings()
  $('confirm-icon').textContent='🗑️'; $('confirm-title').textContent='Reset World?'
  $('confirm-msg').textContent='All history and saves deleted forever.'
  $('confirm-ok').textContent='Delete Everything'; $('confirm-ok').className='btn btn-danger'
  _cb=async()=>{await clearGame();ALL_NATIONS.forEach(n=>{delete n.stars;delete n.stats});location.reload()}
  $('confirm-overlay').style.display='flex'
}
window.confirmAccept = () => { $('confirm-overlay').style.display='none'; _cb?.(); _cb=null }
window.confirmDeny   = () => { $('confirm-overlay').style.display='none'; _cb=null }

// ── INIT ──────────────────────────────────────────────────────
async function init() {
  await renderSlotSelect()
}

init()

import { S, autoSave, loadGame, clearGame, exportSave, importSave } from './store.js'
import { ALL_NATIONS, flag, getSoul } from './data/nations.js'
import { initAllStars, ageAllStars, TIER_LABELS, TIER_COLORS, TIER_ORDER } from './engine/stars.js'
import {
  runQualification, drawGroups, groupStandings, playGroupMatch, buildKnockout,
  playKnockoutMatch, advanceKnockout, startNewWC
} from './engine/season.js'
import { getEffStats, ovr } from './engine/match.js'
import { resetNameTracking } from './data/names.js'

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
  $('wc-number').textContent = S.wcNumber || 1
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
    toast('Group stage done — Round of 32!'); return
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

function playNextKO() {
  const round = S.knockoutRounds[S.knockoutRounds.length - 1]
  if (!round) return
  const unplayed = round.matches.filter(m => !m.played)
  if (!unplayed.length) {
    advanceKnockout(); autoSave()
    if (S.phase === 'done') { updatePhaseUI(); renderBracket(); renderPlay(); toast(`🏆 ${S.champion?.name} are World Champions!`) }
    else { updatePhaseUI(); renderBracket(); toast(`${S.knockoutRounds[S.knockoutRounds.length-1]?.name} begins!`) }
    return
  }
  const match = unplayed[0]
  showMatchPreview(match.t1, match.t2, round.name, () => {
    const result = playKnockoutMatch(match)
    showMatchPopup(result, round.name, () => {
      renderBracket(); updatePhaseUI()
      const left = round.matches.filter(m => !m.played).length
      $('btn-main').textContent = left > 0 ? `▶ Play Next (${left} left)` : '▶ Advance Round'
    })
  })
}

// ── Pre-match preview screen ──────────────────────────────────
function showMatchPreview(t1, t2, roundName, onStart) {
  const popup = $('match-popup'), inner = $('match-popup-inner')
  popup.classList.add('match-popup-modal')
  popup.style.display = 'flex'

  const teamBlock = (team, side) => {
    const stars = team.stars || []
    const e = getEffStats(team, false)
    const o = Math.round((e.attack+e.defense+e.stamina+e.mental+e.setPieces)/5)
    const games = (team.w||0)+(team.d||0)+(team.l||0)
    const soul = team.soul || getSoul(team.name)
    return `
      <div class="preview-team ${side}">
        <div class="preview-team-head">
          <span class="preview-team-flag">${flag(team.cc)}</span>
          <span class="preview-team-name">${team.name}</span>
          <span class="preview-team-ovr">OVR ${o}</span>
        </div>
        <div class="preview-stat-grid">
          <div><span class="preview-stat-label">ATT</span><span>${e.attack}</span></div>
          <div><span class="preview-stat-label">DEF</span><span>${e.defense}</span></div>
          <div><span class="preview-stat-label">STA</span><span>${e.stamina}</span></div>
          <div><span class="preview-stat-label">MEN</span><span>${e.mental}</span></div>
          <div><span class="preview-stat-label">SET</span><span>${e.setPieces}</span></div>
        </div>
        <div class="preview-form-row">
          <div><span class="preview-stat-label">G</span>${games}</div>
          <div><span class="preview-stat-label">W</span><span style="color:var(--green)">${team.w||0}</span></div>
          <div><span class="preview-stat-label">D</span>${team.d||0}</div>
          <div><span class="preview-stat-label">L</span><span style="color:var(--red)">${team.l||0}</span></div>
          <div><span class="preview-stat-label">GF</span>${team.gf||0}</div>
          <div><span class="preview-stat-label">GA</span>${team.ga||0}</div>
        </div>
        ${soul ? `<div class="preview-section-label">SOUL</div>
          <div class="preview-soul-row">
            <span class="preview-soul-name">🎭 ${soul.name}</span>
            <span class="preview-soul-desc">${soul.desc}</span>
          </div>` : ''}
        <div class="preview-section-label">STARS (${stars.length})</div>
        ${stars.length ? stars.map(s => `
          <div class="preview-star-row" style="color:${tierColor(s.tier)}">
            <span class="badge badge-${s.tier}">${s.pos}</span>
            <span class="preview-star-name">${s.name}</span>
            <span class="muted" style="font-size:10px">${TIER_LABELS[s.tier]||s.tier}</span>
          </div>`).join('') : '<div class="muted" style="font-size:11px">No stars</div>'}
        ${team.mentalityDelta ? `<div style="font-size:11px;margin-top:6px;color:${team.mentalityDelta>0?'var(--green)':'var(--red)'}">Morale ${team.mentalityDelta>0?'▲':'▼'}${Math.abs(team.mentalityDelta)}</div>` : ''}
      </div>`
  }

  const isGroup = S.phase === 'groups'
  const nextMatch = isGroup ? S.groupMatches.find(m => !m.played) : null
  const groupLeft = nextMatch ? S.groupMatches.filter(m => !m.played && m.gi === nextMatch.gi).length : 0

  const skipButtons = isGroup
    ? `<button class="btn btn-secondary" onclick="window.skipPreviewedMatch()">Skip Game ⏭</button>
       <button class="btn btn-secondary" onclick="window.skipPreviewedGroup()">Skip Group ⏭⏭ (${groupLeft})</button>`
    : `<button class="btn btn-secondary" onclick="window.skipPreviewedMatch()">Skip Game ⏭</button>`

  inner.innerHTML = `
    <div class="playback-card preview-card">
      <div class="playback-header">
        <div class="playback-round">${roundName.toUpperCase()} — PREVIEW</div>
        <button class="btn btn-icon btn-sm" onclick="window.cancelPreview()" style="font-size:14px">✕</button>
      </div>
      <div class="preview-grid">
        ${teamBlock(t1, 'left')}
        <div class="preview-vs">VS</div>
        ${teamBlock(t2, 'right')}
      </div>
      <div class="playback-actions" style="flex-wrap:wrap;gap:8px">
        ${skipButtons}
        <button class="btn btn-primary" onclick="window.startPreviewedMatch()">▶ Simulate</button>
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
    const round = S.knockoutRounds[S.knockoutRounds.length-1]
    const match = round?.matches.find(m => !m.played)
    if (!match) return
    const result = playKnockoutMatch(match)
    showGroupResultsPopup([result], round.name, () => { renderBracket(); updatePhaseUI() })
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
  const round = S.knockoutRounds[S.knockoutRounds.length-1]
  if (!round) return
  const results = round.matches.filter(m=>!m.played).map(m => playKnockoutMatch(m))
  advanceKnockout(); autoSave()
  updatePhaseUI(); renderBracket()
  showGroupResultsPopup(results, `${round.name} Results`, () => {})
}

// ── Multi-match results popup (tabbed) ───────────────────────
function showGroupResultsPopup(results, roundName, onClose) {
  const popup = $('match-popup'), inner = $('match-popup-inner')
  popup.classList.add('match-popup-modal')
  popup.style.display = 'flex'
  let selected = 0

  const render = () => {
    const r = results[selected]
    const tabs = results.length > 1 ? results.map((res, i) => `
      <div class="group-result-tab ${i===selected?'active':''}" onclick="window._selectGroupResult(${i})">
        <div class="group-result-tab-num">M${i+1}</div>
        <div class="group-result-tab-score">${res.g1}–${res.g2}</div>
        <div class="group-result-tab-winner">${(res.g1>res.g2?res.t1:res.g2>res.g1?res.t2:null)?.name?.slice(0,12)||'Draw'}</div>
      </div>`).join('') : ''

    const events = (r.timeline||[])
    inner.innerHTML = `
      <div class="group-results-wrap">
        ${results.length>1?`<div class="group-results-tabs">${tabs}</div>`:''}
        <div class="group-results-detail">
          <div class="playback-card group-result-card-inner">
            <div class="playback-header">
              <div class="playback-round">${roundName.toUpperCase()}${results.length>1?` · M${selected+1}/${results.length}`:''}</div>
              <div class="playback-clock final">FT</div>
            </div>
            <div class="playback-score-row">
              <div class="playback-team-block">
                <div class="playback-team-stripe"></div>
                <div class="playback-team-inner">
                  <div class="playback-team-name">${flag(r.t1.cc)} ${r.t1.name}</div>
                  ${(r.t1.stars||[]).map(s=>`<div class="playback-team-star" style="color:${tierColor(s.tier)}">⭐ ${s.name} (${s.pos})</div>`).join('')}
                </div>
              </div>
              <div class="playback-score">
                <span class="${r.g1>r.g2?'lead':''}">${r.g1}</span>
                <span class="dash">–</span>
                <span class="${r.g2>r.g1?'lead':''}">${r.g2}</span>
              </div>
              <div class="playback-team-block right">
                <div class="playback-team-inner">
                  <div class="playback-team-name">${r.t2.name} ${flag(r.t2.cc)}</div>
                  ${(r.t2.stars||[]).map(s=>`<div class="playback-team-star" style="color:${tierColor(s.tier)}">⭐ ${s.name} (${s.pos})</div>`).join('')}
                </div>
                <div class="playback-team-stripe"></div>
              </div>
            </div>
            <div class="playback-events">
              ${events.length===0?'<div class="playback-event muted">No goals.</div>':
                events.map(ev=>`<div class="playback-event ${ev.team===1?'left':'right'} ${ev.isStar?'star':''}">
                  <span class="event-min">${ev.minute}'</span>
                  <span class="event-icon">⚽</span>
                  <span class="event-name">${ev.scorerName}</span>
                </div>`).join('')}
            </div>
            ${renderFinalSummary(r)}
          </div>
          <div class="playback-actions" style="margin-top:8px">
            <button class="btn btn-primary" onclick="window._closeGroupResults()">Continue ▶</button>
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
  const stars1 = t1.stars || [], stars2 = t2.stars || []

  function renderFrame(minute, score1, score2, events, finished) {
    const skipBtn  = finished ? '' : `<button class="btn btn-sm" onclick="window.skipPlayback()">Skip ⏭</button>`
    const closeBtn = finished ? `<button class="btn btn-primary" onclick="window.closePlayback()">Continue ▶</button>` : ''
    inner.innerHTML = `
      <div class="playback-card">
        <div class="playback-header">
          <div class="playback-round">${roundName.toUpperCase()}</div>
          <div class="playback-clock ${finished?'final':''}">${finished?'FT':minute+"'"}</div>
        </div>
        <div class="playback-score-row">
          <div class="playback-team-block">
            <div class="playback-team-stripe"></div>
            <div class="playback-team-inner">
              <div class="playback-team-name">${flag(t1.cc)} ${t1.name}</div>
              ${stars1.map(s=>`<div class="playback-team-star" style="color:${tierColor(s.tier)}">⭐ ${s.name} (${s.pos})</div>`).join('')}
              ${t1.soul?`<div style="font-size:10px;color:var(--txt3);margin-top:2px">🎭 ${t1.soul.name}</div>`:''}
            </div>
          </div>
          <div class="playback-score">
            <span class="${score1>score2?'lead':''}">${score1}</span>
            <span class="dash">–</span>
            <span class="${score2>score1?'lead':''}">${score2}</span>
          </div>
          <div class="playback-team-block right">
            <div class="playback-team-inner">
              <div class="playback-team-name">${t2.name} ${flag(t2.cc)}</div>
              ${stars2.map(s=>`<div class="playback-team-star" style="color:${tierColor(s.tier)}">⭐ ${s.name} (${s.pos})</div>`).join('')}
              ${t2.soul?`<div style="font-size:10px;color:var(--txt3);margin-top:2px;text-align:right">🎭 ${t2.soul.name}</div>`:''}
            </div>
            <div class="playback-team-stripe"></div>
          </div>
        </div>
        <div class="playback-progress-wrap"><div class="playback-progress" style="width:${Math.min(100,(minute/90)*100)}%"></div></div>
        <div class="playback-events">
          ${events.length===0
            ? `<div class="playback-event muted">${finished?'No goals.':'Kick off…'}</div>`
            : events.map(ev=>`<div class="playback-event ${ev.team===1?'left':'right'} ${ev.isStar?'star':''}">
                <span class="event-min">${ev.minute}'</span>
                <span class="event-icon">⚽</span>
                <span class="event-name">${ev.scorerName}</span>
              </div>`).join('')}
        </div>
        ${finished ? renderFinalSummary(r) : ''}
        <div class="playback-actions">${skipBtn}${closeBtn}</div>
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
  const starGoals1 = {}, starGoals2 = {}
  ;(r.timeline||[]).forEach(g => { if (!g.isStar) return; const m=g.team===1?starGoals1:starGoals2; m[g.scorerName]=(m[g.scorerName]||0)+1 })

  const starsBlock = (label, srList, goalsMap) => !srList.length?'':`
    <div class="playback-team-block">
      <div class="playback-block-label">${label}</div>
      ${srList.map(s=>`<div class="playback-star-row" style="color:${tierColor(s.tier)}">
        <span class="star-name">⭐ ${s.name}</span>
        <span class="muted">${s.pos}${(goalsMap[s.name]||0)>0?` · ${goalsMap[s.name]}⚽`:''}</span>
        <span class="rating-val ${ratingClass(s.rating)}">${s.rating?.toFixed(1)||'—'}</span>
      </div>`).join('')}
    </div>`

  return `
    <div class="playback-stats-grid">
      <div class="stat-cell stat-team-l">${r.t1.name}</div><div class="stat-cell stat-label">SHOTS</div><div class="stat-cell stat-team-r">${r.t2.name}</div>
      <div class="stat-cell stat-num">${r.shots1}</div><div class="stat-cell"></div><div class="stat-cell stat-num">${r.shots2}</div>
      <div class="stat-cell stat-num">${r.corners1}</div><div class="stat-cell stat-label">CORNERS</div><div class="stat-cell stat-num">${r.corners2}</div>
      <div class="stat-cell stat-num">${r.possession1}%</div><div class="stat-cell stat-label">POSS</div><div class="stat-cell stat-num">${r.possession2}%</div>
    </div>
    <div class="playback-pair">
      ${starsBlock('STARS — '+r.t1.name.toUpperCase(), sr1, starGoals1)}
      ${starsBlock('STARS — '+r.t2.name.toUpperCase(), sr2, starGoals2)}
    </div>
    ${r.effects?.length?`<div class="playback-effects">${r.effects.map(e=>`<div class="effect-line ${e.includes('⭐')?'star':''}">${e}</div>`).join('')}</div>`:''}
    ${r.mentalityChanges?`<div style="font-size:10px;color:var(--txt3);padding:4px 0;text-align:center">
      Morale: ${r.t1.name} ${r.mentalityChanges.team1.change>0?'▲':'▼'}${Math.abs(r.mentalityChanges.team1.change)} · ${r.t2.name} ${r.mentalityChanges.team2.change>0?'▲':'▼'}${Math.abs(r.mentalityChanges.team2.change)}
    </div>`:''}
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
  ]

  let html = `<div class="sub-tab-row">
    ${subTabs.map(t=>`<button class="sub-tab ${sub===t.id?'active':''}" onclick="setTourneyTab('${t.id}')">${t.label}</button>`).join('')}
  </div>`

  if (sub === 'qualifying') html += renderQualifying()
  else if (sub === 'team-stats') html += renderTeamStats()
  else if (sub === 'player-stats') html += renderPlayerStats()

  el.innerHTML = html
}
window.setTourneyTab = t => { tourneySubTab=t; renderTournament() }

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

// ── PLAY tab ──────────────────────────────────────────────────
function renderPlay() {
  const el = $('tab-play'); if (!el) return
  const p = S.phase || 'idle'

  if (!S.teams?.length) {
    el.innerHTML = `<div style="text-align:center;padding:48px 16px">
      <div style="font-size:64px;margin-bottom:12px">⚽</div>
      <div style="font-family:var(--font-head);font-size:36px;letter-spacing:.12em;color:var(--gold2)">WORLD CUP SIMULATOR</div>
      <div style="color:var(--txt2);margin:8px 0 28px">48 nations. 3 stars each. One champion.</div>
      <button class="btn btn-primary" onclick="handleMain()" style="padding:12px 32px;font-size:15px">▶ Begin World Cup 1</button>
    </div>`; return
  }

  let html = ''
  if (p === 'done') {
    const aw = S.seasonAwards || {}
    html = `
      <div class="champion-banner">
        <div style="font-size:52px">🏆</div>
        <div class="champ-title">WORLD CUP #${S.wcNumber} CHAMPIONS</div>
        <div class="champ-name">${flag(S.champion?.cc||'')} ${S.champion?.name}</div>
      </div>
      ${aw.topScorer||aw.offMVP||aw.defMVP?`
      <div class="sec">TOURNAMENT AWARDS</div>
      <div class="awards-grid">
        ${aw.topScorer?`<div class="award-card"><div class="award-icon">⚽</div><div class="award-label">Top Scorer</div><div class="award-name">${aw.topScorer.name}</div><div class="award-sub">${aw.topScorer.goals} goals · ${aw.topScorer.team}</div></div>`:''}
        ${aw.offMVP?`<div class="award-card"><div class="award-icon">🌟</div><div class="award-label">Offensive MVP</div><div class="award-name">${aw.offMVP.name}</div><div class="award-sub">${aw.offMVP.rating} avg · ${aw.offMVP.pos}</div></div>`:''}
        ${aw.defMVP?`<div class="award-card"><div class="award-icon">🛡️</div><div class="award-label">Defensive MVP</div><div class="award-name">${aw.defMVP.name}</div><div class="award-sub">${aw.defMVP.rating} avg · ${aw.defMVP.pos}</div></div>`:''}
      </div>`:''}
      ${renderTopScorers()}`
  } else if (p === 'groups') {
    const played = S.groupMatches.filter(m=>m.played).length, total=S.groupMatches.length
    html = `<div class="sec">GROUP STAGE — ${played}/${total}</div>
      <div class="prog-wrap"><div class="prog-bar" style="width:${total?played/total*100:0}%"></div></div>
      <div class="row" style="gap:6px;margin-bottom:10px">
        <button class="btn btn-sm" onclick="skipAllGroups()">⏭⏭ Skip All Groups</button>
      </div>
      ${renderRecentResults()}`
  } else if (p === 'knockout') {
    const round = S.knockoutRounds[S.knockoutRounds.length-1]
    html = `<div class="sec">${round?.name?.toUpperCase()||'KNOCKOUT'}</div>
      <div class="row" style="gap:6px;margin-bottom:10px">
        <button class="btn btn-sm" onclick="skipKORound()">⏭ Skip This Round</button>
      </div>
      ${renderRecentResults()}`
  } else if (p === 'qualified') {
    html = `<div class="sec">QUALIFIED NATIONS (${S.teams?.length||0})</div>
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
        <button class="btn btn-sm" style="font-size:9px;margin-left:4px" onclick="skipGroup(${gi})">⏭ Skip</button>
      </div>
      ${sorted.map((t,i)=>`<div class="group-row ${i<2?'qualifies':''}" onclick="openTeamModal('${t.name}')">
        ${flag(t.cc)} <span class="group-name">${t.name}</span>
        ${(t.stars||[]).some(s=>['generational','legendary'].includes(s.tier))?`<span style="color:${tierColor((t.stars||[]).find(s=>['generational','legendary'].includes(s.tier))?.tier)};font-size:10px">⭐</span>`:''}
        <span class="group-pts">${t.pts||0}</span>
        <span class="group-rec">${t.w||0}/${t.d||0}/${t.l||0}</span>
      </div>`).join('')}
    </div>`
  })
  html += '</div>'
  const played = S.groupMatches?.filter(m=>m.played)||[]
  if (played.length) {
    html += '<div class="sec">RESULTS</div>'
    html += played.slice(-8).reverse().map(m=>`<div class="match-result-card" style="padding:8px 10px">
      <div style="font-size:9px;color:var(--txt3);font-family:var(--font-head)">GROUP ${S.groups[m.gi]?.id}</div>
      <div class="match-teams" style="margin-top:2px">
        <div class="match-team" onclick="openTeamModal('${m.t1.name}')">${flag(m.t1.cc)} ${m.t1.name}</div>
        <div class="match-score" style="font-size:18px">${m.result.g1}–${m.result.g2}</div>
        <div class="match-team right" onclick="openTeamModal('${m.t2.name}')">${m.t2.name} ${flag(m.t2.cc)}</div>
      </div>
    </div>`).join('')
  }
  el.innerHTML = html
}

// ── BRACKET tab ───────────────────────────────────────────────
function renderBracket() {
  const el = $('tab-bracket'); if(!el||!S.knockoutRounds?.length){if(el)el.innerHTML='<div class="empty">Knockout not started</div>';return}
  const roundOrder = ['Round of 32','Round of 16','Quarter-finals','Semi-finals','Final']
  const roundMap = {}
  S.knockoutRounds.forEach(r => { roundMap[r.name]=r })
  let html='<div class="bracket-scroll"><div class="bracket-rounds">'
  roundOrder.forEach(name => {
    const round=roundMap[name]
    html+=`<div class="bracket-col"><div class="bracket-round-name">${name}</div>`
    if (round) {
      round.matches.forEach(m=>{
        const w=m.result?.winner
        html+=`<div class="bracket-match">
          <div class="bracket-team ${w?w===m.t1?'winner':'loser':''} ${!m.t1?'tbd':''}">${m.t1?`${flag(m.t1.cc)} ${m.t1.name}`:'-'}${m.result?`<span class="bracket-score">${m.result.g1}</span>`:''}</div>
          <div class="bracket-team ${w?w===m.t2?'winner':'loser':''} ${!m.t2?'tbd':''}">${m.t2?`${flag(m.t2.cc)} ${m.t2.name}`:'-'}${m.result?`<span class="bracket-score">${m.result.g2}</span>`:''}</div>
        </div>`
      })
    } else {
      const slots={32:16,16:8,'Quarter-finals':4,'Semi-finals':2,'Final':1}[name.replace('Round of ','')] || 2
      for(let i=0;i<slots;i++) html+=`<div class="bracket-match"><div class="bracket-team tbd">TBD</div><div class="bracket-team tbd">TBD</div></div>`
    }
    html+='</div>'
  })
  if (S.champion) html+=`<div class="bracket-col"><div class="bracket-round-name">CHAMPION</div><div class="bracket-match" style="border:1px solid var(--gold)"><div class="bracket-team winner" style="color:var(--gold);padding:10px">🏆 ${flag(S.champion.cc)} ${S.champion.name}</div></div></div>`
  html+='</div></div>'
  el.innerHTML=html
}

// ── STARS tab ─────────────────────────────────────────────────
let starSortKey = 'tier', starFilter = 'all'

function renderStars() {
  const el = $('tab-stars'); if (!el) return
  const allStars = []
  ALL_NATIONS.forEach(n => (n.stars||[]).forEach(s => allStars.push({...s,teamName:n.name,cc:n.cc})))
  const filtered = starFilter==='all' ? allStars : allStars.filter(s=>s.pos===starFilter)
  const sortFns = {
    tier:  (a,b)=>TIER_ORDER.indexOf(a.tier)-TIER_ORDER.indexOf(b.tier),
    goals: (a,b)=>(b.goals||0)-(a.goals||0),
    fame:  (a,b)=>(b.fame||0)-(a.fame||0),
    name:  (a,b)=>a.name.localeCompare(b.name),
  }
  const sorted = [...filtered].sort(sortFns[starSortKey]||sortFns.tier)

  el.innerHTML = `
    <div class="filter-row">
      Sort: ${['tier','goals','fame','name'].map(k=>`<button class="filter-btn ${starSortKey===k?'active':''}" onclick="setStarSort('${k}')">${k}</button>`).join('')}
    </div>
    <div class="filter-row">
      Filter: ${['all','FWD','MID','DEF','GK'].map(f=>`<button class="filter-btn ${starFilter===f?'active':''}" onclick="setStarFilter('${f}')">${f}</button>`).join('')}
    </div>
    <div style="font-size:11px;color:var(--txt3);margin-bottom:8px">${sorted.length} stars shown</div>
    <div class="star-grid">
      ${sorted.map(s=>{
        const avgR = s.allTimeRatings?.length ? (s.allTimeRatings.reduce((a,b)=>a+b,0)/s.allTimeRatings.length).toFixed(1) : null
        const bonus = Object.entries(s.statBonus||{}).filter(([,v])=>v>0).map(([k,v])=>`+${v} ${k.slice(0,3).toUpperCase()}`).join(' ')
        return `<div class="star-card ${s.tier}" onclick="openStarModal('${s.id}','${s.teamName}')">
          <div class="row" style="margin-bottom:3px">${tierBadge(s.tier)}<span class="star-pos">${s.pos}</span><span class="spacer"></span><span style="font-size:10px;color:var(--txt3)">⚡${s.fame||0}</span></div>
          <div class="star-name">${s.name}</div>
          <div class="star-team">${flag(s.cc)} ${s.teamName}</div>
          <div style="font-size:10px;color:${tierColor(s.tier)};margin-top:3px">${bonus}</div>
          <div class="star-stats">
            <span class="star-stat">⚽ <span>${s.goals||0}</span></span>
            ${avgR?`<span class="star-stat">★ <span>${avgR}</span></span>`:''}
            <span class="star-stat">WC <span>${s.wcsRemaining||0} left</span></span>
            ${s.medals?.gold?`<span class="star-stat">🥇<span>${s.medals.gold}</span></span>`:''}
          </div>
        </div>`
      }).join('')}
    </div>`
}
window.setStarSort   = k => { starSortKey=k; renderStars() }
window.setStarFilter = f => { starFilter=f; renderStars() }

window.openStarModal = function(starId, teamName) {
  const nation = ALL_NATIONS.find(n=>n.name===teamName)
  const star = (nation?.stars||[]).find(s=>s.id===starId)
  if (!star) return
  const avgR = star.allTimeRatings?.length ? (star.allTimeRatings.reduce((a,b)=>a+b,0)/star.allTimeRatings.length).toFixed(1) : '—'
  $('team-modal-content').innerHTML = `
    <div class="row" style="margin-bottom:12px">
      <div style="font-size:28px">${flag(star.cc)}</div>
      <div style="flex:1">
        <div style="font-family:var(--font-head);font-size:20px;color:var(--txt)">${star.name}</div>
        <div style="font-size:12px;color:var(--txt2)">${star.pos} · ${teamName}</div>
      </div>
      ${tierBadge(star.tier)}
      <button class="btn btn-icon" onclick="closeTeamModal()" style="margin-left:4px">✕</button>
    </div>
    <div class="sec">CAREER</div>
    <div class="card" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
      <div><div style="font-family:var(--font-head);font-size:20px;color:var(--gold2)">${star.goals||0}</div><div style="font-size:10px;color:var(--txt3)">GOALS</div></div>
      <div><div style="font-family:var(--font-head);font-size:20px">${avgR}</div><div style="font-size:10px;color:var(--txt3)">AVG RATING</div></div>
      <div><div style="font-family:var(--font-head);font-size:20px">${star.wcsRemaining||0}</div><div style="font-size:10px;color:var(--txt3)">WCS LEFT</div></div>
    </div>
    <div class="sec">MEDALS</div>
    <div class="card" style="display:flex;gap:16px">
      <div style="text-align:center"><div style="font-size:20px">🥇</div><div style="font-family:var(--font-head);font-size:16px;color:var(--gold2)">${star.medals?.gold||0}</div></div>
      <div style="text-align:center"><div style="font-size:20px">🥈</div><div style="font-family:var(--font-head);font-size:16px">${star.medals?.silver||0}</div></div>
      <div style="text-align:center"><div style="font-size:20px">🥉</div><div style="font-family:var(--font-head);font-size:16px">${star.medals?.bronze||0}</div></div>
      <div style="text-align:center"><div style="font-size:20px">🏅</div><div style="font-family:var(--font-head);font-size:16px;color:var(--txt3)">${star.medals?.sf||0}</div></div>
    </div>
    <div class="sec">STAT BONUSES</div>
    ${Object.entries(star.statBonus||{}).filter(([,v])=>v>0).map(([k,v])=>`
      <div class="stat-row">
        <span class="stat-lbl">${k}</span>
        <div class="stat-bar-wrap"><div class="stat-bar" style="width:${Math.round(v/0.5)}%"></div></div>
        <span class="stat-val">+${v}</span>
      </div>`).join('')}
    <div style="font-size:11px;color:var(--txt3);margin-top:8px">Effective bonus = +${Math.round(Object.values(star.statBonus||{}).reduce((a,b)=>a+(b||0),0) * (star.careerMult||1) * ({generational:3.5,legendary:2.5,epic:2.0,rare:1.5,uncommon:1.2,common:1.0}[star.tier]||1.0))} at current career stage</div>
  `
  $('team-modal-overlay').style.display='flex'
}

// ── NATIONS tab ───────────────────────────────────────────────
function renderNations() {
  const el = $('tab-nations'); if (!el||!S.teams?.length){if(el)el.innerHTML='<div class="empty">No nations qualified yet</div>';return}
  const sorted = [...S.teams].sort((a,b)=>b.rating-a.rating)
  el.innerHTML = `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>#</th><th>Nation</th><th>Tier</th><th class="num">ATK</th><th class="num">DEF</th><th class="num">STA</th><th class="num">MEN</th><th class="num">SET</th><th class="num">OVR</th><th>Stars</th></tr></thead>
    <tbody>${sorted.map((t,i)=>{
      const eff=getEffStats(t)
      const o=Math.round((eff.attack+eff.defense+eff.stamina+eff.mental+eff.setPieces)/5)
      const stars=t.stars||[]
      return`<tr>
        <td style="color:var(--txt3)">${i+1}</td>
        <td class="c-name" onclick="openTeamModal('${t.name}')">${flag(t.cc)} <strong>${t.name}</strong>${t.isHost?' 🏠':''}</td>
        <td><span style="font-size:10px;color:${t.tier==='top'?'var(--gold)':t.tier==='mid'?'var(--green)':'var(--txt3)'}">${t.tier?.toUpperCase()}</span></td>
        <td class="num" style="color:var(--gold2)">${eff.attack}</td>
        <td class="num" style="color:var(--gold2)">${eff.defense}</td>
        <td class="num" style="color:var(--gold2)">${eff.stamina}</td>
        <td class="num" style="color:var(--gold2)">${eff.mental}</td>
        <td class="num" style="color:var(--gold2)">${eff.setPieces}</td>
        <td class="num" style="color:var(--gold);font-family:var(--font-head);font-weight:700">${o}</td>
        <td>${stars.map(s=>`<span style="color:${tierColor(s.tier)};font-size:14px" title="${s.name} (${s.pos}·${TIER_LABELS[s.tier]})">⭐</span>`).join('')}</td>
      </tr>`}).join('')}
    </tbody></table></div>`
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
  const semis   = hist.filter(h=>h.roundReached?.[teamName]==='Semi-finals').length
  const statNames = {attack:'Attack',defense:'Defense',stamina:'Stamina',mental:'Mental',setPieces:'Set Pieces'}

  $('team-modal-content').innerHTML = `
    <div class="row" style="margin-bottom:14px">
      <div style="font-size:36px">${flag(t.cc)}</div>
      <div style="flex:1">
        <div style="font-family:var(--font-head);font-size:22px;color:var(--txt)">${t.name}</div>
        <div style="font-size:12px;color:var(--txt2)">${t.tier?.toUpperCase()||''} · OVR ${o} · Rating ${t.rating||'—'}</div>
      </div>
      <button class="btn btn-icon" onclick="closeTeamModal()">✕</button>
    </div>

    ${titles||finals||semis?`
    <div class="sec">WORLD CUP HISTORY</div>
    <div class="row" style="gap:20px;margin-bottom:10px">
      ${titles?`<div style="text-align:center"><div style="font-size:26px">🏆</div><div style="font-family:var(--font-head);font-size:22px;color:var(--gold2)">${titles}</div><div style="font-size:10px;color:var(--txt3)">TITLES</div></div>`:''}
      ${finals?`<div style="text-align:center"><div style="font-size:26px">🥈</div><div style="font-family:var(--font-head);font-size:22px">${finals}</div><div style="font-size:10px;color:var(--txt3)">FINALS</div></div>`:''}
      ${semis?`<div style="text-align:center"><div style="font-size:26px">🏅</div><div style="font-family:var(--font-head);font-size:22px">${semis}</div><div style="font-size:10px;color:var(--txt3)">SEMIS</div></div>`:''}
    </div>`:'<div style="font-size:12px;color:var(--txt3);margin-bottom:10px">No WC history yet</div>'}

    ${t.soul || getSoul(t.name) ? `
    <div class="sec">NATIONAL SOUL</div>
    <div class="card" style="border-left:3px solid var(--gold3)">
      <div style="font-weight:700;font-size:14px;color:var(--gold2)">${(t.soul || getSoul(t.name)).name}</div>
      <div style="font-size:12px;color:var(--txt2);margin-top:3px">${(t.soul || getSoul(t.name)).desc}</div>
    </div>`:''}

    <div class="sec">STATS (effective incl. star bonuses + soul)</div>
    ${Object.entries(statNames).map(([k,label])=>{
      const bv=base[k]||75, ev=eff[k]||75, bonus=ev-bv
      return`<div class="stat-row">
        <span class="stat-lbl">${label}</span>
        <div class="stat-bar-wrap"><div class="stat-bar" style="width:${Math.round(ev/1.3)}%"></div></div>
        <span class="stat-val">${ev}</span>
        <span class="stat-bonus">${bonus>0?`+${bonus}`:''}</span>
      </div>`}).join('')}
    ${t.mentalityDelta?`<div style="font-size:11px;color:${t.mentalityDelta>0?'var(--green)':'var(--red)'};margin-top:4px">Morale: ${t.mentalityDelta>0?'+':''}${t.mentalityDelta}</div>`:''}

    <div class="sec">STARS (${stars.length})</div>
    ${stars.map(s=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--bg4)">
      <div style="width:3px;height:36px;background:${tierColor(s.tier)};border-radius:2px;flex-shrink:0"></div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:13px">${s.name}</div>
        <div style="font-size:11px;color:var(--txt2)">${s.pos} · ${tierBadge(s.tier)} · ${s.wcsRemaining||0} WC${(s.wcsRemaining||0)!==1?'s':''} left</div>
        <div style="font-size:10px;color:var(--txt3);margin-top:2px">⚽ ${s.goals||0} goals · ⚡ ${s.fame||0} fame</div>
      </div>
      <div style="text-align:right;font-size:11px;color:var(--txt3)">
        ${s.medals?.gold?`🥇${s.medals.gold} `:''}${s.medals?.silver?`🥈${s.medals.silver}`:''}
      </div>
    </div>`).join('')}
  `
  $('team-modal-overlay').style.display = 'flex'
}
window.closeTeamModal = () => { $('team-modal-overlay').style.display='none' }

// ── HISTORY tab ───────────────────────────────────────────────
function renderHistory() {
  const el = $('tab-history'); if (!el) return
  if (!S.history?.length) { el.innerHTML='<div class="empty">No history yet</div>'; return }
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

  el.innerHTML = `
    <div class="sec">TOURNAMENT HISTORY</div>
    ${hist.map(h=>`<div class="history-card">
      <div class="history-wc">WORLD CUP #${h.wcNumber}</div>
      <div class="history-champ">🏆 ${flag(h.cc||'')} ${h.champion}</div>
      <div style="font-size:12px;color:var(--txt2);margin-top:4px">${h.totalGoals||0} goals total</div>
      ${h.awards?.topScorer?`<div style="font-size:11px;color:var(--txt3)">⚽ ${h.awards.topScorer.name} (${h.awards.topScorer.goals}) · 🌟 ${h.awards.offMVP?.name||'—'} · 🛡 ${h.awards.defMVP?.name||'—'}</div>`:''}
    </div>`).join('')}

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
    </table></div>

    <div class="sec">TOP SCORERS (ALL TIME)</div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Player</th><th>Pos</th><th class="num">Goals</th><th class="num">🥇</th><th class="num">Off MVP</th></tr></thead>
      <tbody>${[...pList].sort((a,b)=>b.goals-a.goals).slice(0,10).map(p=>`<tr>
        <td><strong>${p.name}</strong></td><td>${p.pos}</td>
        <td class="num" style="color:var(--gold)">${p.goals||'—'}</td>
        <td class="num" style="color:var(--gold2)">${p.gold||'—'}</td>
        <td class="num">${p.offMVP||'—'}</td>
      </tr>`).join('')}</tbody>
    </table></div>

    <div class="sec">DEFENSIVE MVPs (ALL TIME)</div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Player</th><th>Pos</th><th class="num">Def MVP</th><th class="num">🥇</th></tr></thead>
      <tbody>${[...pList].filter(p=>['DEF','GK'].includes(p.pos)).sort((a,b)=>b.defMVP-a.defMVP).slice(0,8).map(p=>`<tr>
        <td><strong>${p.name}</strong></td><td>${p.pos}</td>
        <td class="num" style="color:var(--blue)">${p.defMVP||'—'}</td>
        <td class="num">${p.gold||'—'}</td>
      </tr>`).join('')}</tbody>
    </table></div>`
}

// ── INTER-WC SCREEN ───────────────────────────────────────────
function showInterWC() {
  const { retiring, debuting } = startNewWC()
  const NOTABLE = new Set(['generational','legendary','epic','rare'])
  const notableRet = retiring.filter(s=>NOTABLE.has(s.tier))
  const notableDeb = debuting.filter(s=>NOTABLE.has(s.tier))
  $('interwc-content').innerHTML = `
    <div style="font-family:var(--font-head);font-size:22px;letter-spacing:.1em;color:var(--gold2);margin-bottom:4px">BETWEEN WORLD CUPS</div>
    <div style="font-size:12px;color:var(--txt2);margin-bottom:14px">Notable arrivals & departures — WC #${S.wcNumber} begins</div>
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
    ${!notableRet.length&&!notableDeb.length?'<div class="empty">Quiet offseason — no notable changes</div>':''}
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

// ── SETTINGS ──────────────────────────────────────────────────
window.openSettings  = () => { $('settings-overlay').style.display='flex' }
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
  const loaded = await loadGame()
  if (!loaded) {
    S.wcNumber = 1; S.phase = 'idle'
    resetNameTracking()
    initAllStars(1)
  } else {
    // Restore stars to ALL_NATIONS from saved S data if possible
    // Stars are stored on nation objects which aren't in S — they persist via module state
    // If page reload cleared them, reinit
    if (!ALL_NATIONS.some(n=>n.stars?.length)) initAllStars(S.wcNumber||1)
  }
  updatePhaseUI()
}

init()

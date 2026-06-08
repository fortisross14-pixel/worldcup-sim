// ── Nation tiers ─────────────────────────────────────────────
// Top: World Cup winners with multiple titles
// Mid: Strong national teams, consistent participants
// Rest: Everyone else

export const TIERS = {
  top:  { base: 75, range: 5 },
  mid:  { base: 70, range: 5 },
  rest: { base: 65, range: 5 },
}

// Star rarity chances by nation tier
export const TIER_STAR_CHANCES = {
  top: {
    generational: 0.02, legendary: 0.08, epic: 0.15,
    rare: 0.20, uncommon: 0.25 // rest = common
  },
  mid: {
    generational: 0.005, legendary: 0.035, epic: 0.12,
    rare: 0.25, uncommon: 0.30
  },
  rest: {
    generational: 0, legendary: 0.01, epic: 0.06,
    rare: 0.18, uncommon: 0.35
  },
}

export function rollStarTier(tier) {
  const c = TIER_STAR_CHANCES[tier] || TIER_STAR_CHANCES.rest
  const r = Math.random()
  let acc = 0
  for (const [t, p] of Object.entries(c)) {
    acc += p
    if (r < acc) return t
  }
  return 'common'
}

// ── All 71 nations ────────────────────────────────────────────
export const ALL_NATIONS = [
  // ── UEFA (13 slots) ──────────────────────────────────────────
  // Top tier
  { name:'Germany',    cc:'de',     conf:'UEFA', tier:'top',  base:95, hist:200, always:true },
  { name:'Italy',      cc:'it',     conf:'UEFA', tier:'top',  base:95, hist:180, always:true },
  { name:'France',     cc:'fr',     conf:'UEFA', tier:'top',  base:93, hist:120, always:true },
  { name:'Spain',      cc:'es',     conf:'UEFA', tier:'top',  base:90, hist:80,  always:true },
  { name:'England',    cc:'gb-eng', conf:'UEFA', tier:'top',  base:90, hist:60,  always:true },
  // Mid tier
  { name:'Portugal',   cc:'pt',     conf:'UEFA', tier:'mid',  base:87, hist:40,  always:true },
  { name:'Netherlands',cc:'nl',     conf:'UEFA', tier:'mid',  base:90, hist:80,  always:true },
  { name:'Belgium',    cc:'be',     conf:'UEFA', tier:'mid',  base:85, hist:30 },
  { name:'Croatia',    cc:'hr',     conf:'UEFA', tier:'mid',  base:82, hist:30 },
  { name:'Denmark',    cc:'dk',     conf:'UEFA', tier:'mid',  base:81, hist:20 },
  { name:'Serbia',     cc:'rs',     conf:'UEFA', tier:'mid',  base:79, hist:10 },
  { name:'Switzerland',cc:'ch',     conf:'UEFA', tier:'mid',  base:80, hist:15 },
  { name:'Poland',     cc:'pl',     conf:'UEFA', tier:'mid',  base:78, hist:10 },
  { name:'Ukraine',    cc:'ua',     conf:'UEFA', tier:'mid',  base:78, hist:5 },
  { name:'Austria',    cc:'at',     conf:'UEFA', tier:'mid',  base:77, hist:20 },
  { name:'Sweden',     cc:'se',     conf:'UEFA', tier:'mid',  base:77, hist:30 },
  { name:'Czech Republic',cc:'cz',  conf:'UEFA', tier:'mid',  base:76, hist:20 },
  { name:'Turkey',     cc:'tr',     conf:'UEFA', tier:'mid',  base:76, hist:10 },
  // Rest
  { name:'Norway',     cc:'no',     conf:'UEFA', tier:'rest', base:75, hist:10 },
  { name:'Hungary',    cc:'hu',     conf:'UEFA', tier:'rest', base:74, hist:30 },
  { name:'Slovakia',   cc:'sk',     conf:'UEFA', tier:'rest', base:73, hist:5 },
  { name:'Scotland',   cc:'gb-sct', conf:'UEFA', tier:'rest', base:73, hist:5 },
  { name:'Romania',    cc:'ro',     conf:'UEFA', tier:'rest', base:72, hist:15 },
  { name:'Greece',     cc:'gr',     conf:'UEFA', tier:'rest', base:71, hist:5 },
  { name:'Ireland',    cc:'ie',     conf:'UEFA', tier:'rest', base:70, hist:5 },

  // ── CONMEBOL (6 slots) ────────────────────────────────────────
  { name:'Brazil',    cc:'br', conf:'CONMEBOL', tier:'top', base:95, hist:250, always:true },
  { name:'Argentina', cc:'ar', conf:'CONMEBOL', tier:'top', base:93, hist:200, always:true },
  { name:'Uruguay',   cc:'uy', conf:'CONMEBOL', tier:'top', base:90, hist:120, always:true },
  { name:'Colombia',  cc:'co', conf:'CONMEBOL', tier:'mid', base:82, hist:20 },
  { name:'Chile',     cc:'cl', conf:'CONMEBOL', tier:'mid', base:81, hist:15 },
  { name:'Ecuador',   cc:'ec', conf:'CONMEBOL', tier:'mid', base:78, hist:5 },
  { name:'Peru',      cc:'pe', conf:'CONMEBOL', tier:'mid', base:77, hist:15 },
  { name:'Paraguay',  cc:'py', conf:'CONMEBOL', tier:'mid', base:75, hist:10 },
  { name:'Bolivia',   cc:'bo', conf:'CONMEBOL', tier:'rest',base:66, hist:5 },
  { name:'Venezuela', cc:'ve', conf:'CONMEBOL', tier:'rest',base:64, hist:1 },

  // ── CONCACAF (4+1 slots) ──────────────────────────────────────
  { name:'Mexico',      cc:'mx', conf:'CONCACAF', tier:'mid', base:82, hist:30, always:true },
  { name:'United States',cc:'us',conf:'CONCACAF', tier:'mid', base:80, hist:15 },
  { name:'Canada',      cc:'ca', conf:'CONCACAF', tier:'mid', base:76, hist:5 },
  { name:'Costa Rica',  cc:'cr', conf:'CONCACAF', tier:'rest',base:72, hist:10 },
  { name:'Honduras',    cc:'hn', conf:'CONCACAF', tier:'rest',base:68, hist:5 },
  { name:'Jamaica',     cc:'jm', conf:'CONCACAF', tier:'rest',base:66, hist:3 },

  // ── CAF (5 slots) ─────────────────────────────────────────────
  { name:'Senegal',      cc:'sn', conf:'CAF', tier:'mid', base:80, hist:10 },
  { name:'Morocco',      cc:'ma', conf:'CAF', tier:'mid', base:80, hist:15 },
  { name:'Nigeria',      cc:'ng', conf:'CAF', tier:'mid', base:79, hist:15 },
  { name:'Egypt',        cc:'eg', conf:'CAF', tier:'mid', base:78, hist:10 },
  { name:'Ghana',        cc:'gh', conf:'CAF', tier:'mid', base:76, hist:10 },
  { name:'Ivory Coast',  cc:'ci', conf:'CAF', tier:'mid', base:76, hist:10 },
  { name:'Cameroon',     cc:'cm', conf:'CAF', tier:'mid', base:74, hist:15 },
  { name:'Algeria',      cc:'dz', conf:'CAF', tier:'mid', base:74, hist:10 },
  { name:'Tunisia',      cc:'tn', conf:'CAF', tier:'rest',base:70, hist:5 },
  { name:'Mali',         cc:'ml', conf:'CAF', tier:'rest',base:68, hist:1 },
  { name:'South Africa', cc:'za', conf:'CAF', tier:'rest',base:67, hist:5 },

  // ── AFC (5 slots) ─────────────────────────────────────────────
  { name:'South Korea', cc:'kr', conf:'AFC', tier:'mid', base:78, hist:25 },
  { name:'Japan',       cc:'jp', conf:'AFC', tier:'mid', base:77, hist:15 },
  { name:'Iran',        cc:'ir', conf:'AFC', tier:'mid', base:75, hist:10 },
  { name:'Australia',   cc:'au', conf:'AFC', tier:'mid', base:74, hist:10 },
  { name:'Saudi Arabia',cc:'sa', conf:'AFC', tier:'rest',base:71, hist:5 },
  { name:'Qatar',       cc:'qa', conf:'AFC', tier:'rest',base:68, hist:3 },
  { name:'China',       cc:'cn', conf:'AFC', tier:'rest',base:67, hist:3 },
  { name:'Iraq',        cc:'iq', conf:'AFC', tier:'rest',base:66, hist:5 },

  // ── OFC (1 slot) ──────────────────────────────────────────────
  { name:'New Zealand', cc:'nz', conf:'OFC', tier:'rest', base:64, hist:3 },
]

// Confederation qualification slots (for 48-team WC format)
export const CONF_SLOTS = {
  UEFA: 16, CONMEBOL: 6, CONCACAF: 6, CAF: 9, AFC: 8, OFC: 1, HOST: 1, PLAYOFF: 1
}

// Flag as <img> from flagcdn.com — reliable on all mobile browsers
// cc can be ISO 3166-1 alpha-2 or special code
export function flag(cc, size) {
  if (!cc) return '<img src="" style="width:20px;height:15px;background:#333;border-radius:2px;display:inline-block">'
  const s = size || 20
  const h = Math.round(s * 0.75)
  const ccMap = {
    'gb-eng': 'gb-eng', 'gb-sct': 'gb-sct', 'gb-wls': 'gb-wls', 'xk': 'xk',
  }
  const code = (ccMap[cc] || cc).toLowerCase()
  return '<img src="https://flagcdn.com/' + s + 'x' + h + '/' + code + '.png" width="' + s + '" height="' + h + '" alt="' + cc + '" style="border-radius:2px;vertical-align:middle;display:inline-block;flex-shrink:0" onerror="this.style.visibility=\'hidden\'">'
}

// Names defined in names.js module


// ── Nation Souls ─────────────────────────────────────────────
// Each nation has a soul that shapes their playing style
export const NATION_SOULS = {
  // CONMEBOL
  'Brazil':        { id:'jogo_bonito',      name:'Jogo Bonito',       desc:'Beautiful game — +8 ATK, +8 SET, −4 DEF',      fx:{attack:8,setPieces:8,defense:-4}, goalBonus:0.15 },
  'Argentina':     { id:'competitive_beast',name:'Competitive Beast', desc:'Never say die — +6 DEF, +8 MEN',               fx:{defense:6,mental:8}, goalBonus:0 },
  'Uruguay':       { id:'competitive_beast',name:'Competitive Beast', desc:'Never say die — +6 DEF, +8 MEN',               fx:{defense:6,mental:8}, goalBonus:0 },
  'Colombia':      { id:'jogo_bonito',      name:'Jogo Bonito',       desc:'Flair football — +6 ATK, +6 SET, −2 DEF',      fx:{attack:6,setPieces:6,defense:-2}, goalBonus:0.08 },
  'Chile':         { id:'competitive_beast',name:'Competitive Beast', desc:'+4 DEF, +6 MEN',                               fx:{defense:4,mental:6}, goalBonus:0 },
  // UEFA Top
  'Germany':       { id:'machine',          name:'German Machine',    desc:'Relentless efficiency — +6 DEF, +6 MEN, +4 STA', fx:{defense:6,mental:6,stamina:4}, goalBonus:0 },
  'Italy':         { id:'catenaccio',       name:'Catenaccio',        desc:'Iron defense — +12 DEF, −6 ATK',               fx:{defense:12,attack:-6}, koGaCap:2, goalBonus:0 },
  'Spain':         { id:'tiki_taka',        name:'Tiki-Taka',         desc:'Possession masters — +8 SET, +8 MEN, +6 ATK',  fx:{setPieces:8,mental:8,attack:6}, goalBonus:0 },
  'France':        { id:'clinical',         name:'Clinical',          desc:'Cold-blooded finishing — +8 ATK, +6 MEN',      fx:{attack:8,mental:6}, goalBonus:0 },
  'England':       { id:'physical',         name:'Physical Kings',    desc:'High intensity — +8 STA, +6 ATK',              fx:{stamina:8,attack:6}, goalBonus:0 },
  // UEFA Mid
  'Netherlands':   { id:'total_football',   name:'Total Football',    desc:'All attack all defend — +6 ATK, +6 DEF, +6 MEN', fx:{attack:6,defense:6,mental:6}, goalBonus:0 },
  'Portugal':      { id:'clinical',         name:'Clinical',          desc:'Stars shine brightest — +8 ATK, +6 MEN',       fx:{attack:8,mental:6}, goalBonus:0 },
  'Belgium':       { id:'physical',         name:'Physical Kings',    desc:'+8 STA, +4 ATK',                               fx:{stamina:8,attack:4}, goalBonus:0 },
  'Croatia':       { id:'competitive_beast',name:'Competitive Beast', desc:'Never quit — +8 DEF, +8 MEN',                 fx:{defense:8,mental:8}, goalBonus:0 },
  'Serbia':        { id:'competitive_beast',name:'Competitive Beast', desc:'+6 DEF, +6 MEN',                               fx:{defense:6,mental:6}, goalBonus:0 },
  'Denmark':       { id:'team_spirit',      name:'Team Spirit',       desc:'United as one — +6 MEN, +4 DEF, +4 STA',      fx:{mental:6,defense:4,stamina:4}, goalBonus:0 },
  'Sweden':        { id:'physical',         name:'Physical Kings',    desc:'+8 STA, +4 DEF',                               fx:{stamina:8,defense:4}, goalBonus:0 },
  'Turkey':        { id:'competitive_beast',name:'Competitive Beast', desc:'+6 DEF, +6 MEN',                               fx:{defense:6,mental:6}, goalBonus:0 },
  'Poland':        { id:'physical',         name:'Physical Kings',    desc:'+6 STA, +4 DEF',                               fx:{stamina:6,defense:4}, goalBonus:0 },
  'Switzerland':   { id:'compact_defense',  name:'Compact Defense',   desc:'+8 DEF, +4 MEN',                               fx:{defense:8,mental:4}, goalBonus:0 },
  // AFC
  'Japan':         { id:'running_machine',  name:'Running Machine',   desc:'High press — +8 STA, +4 ATK',                 fx:{stamina:8,attack:4}, goalBonus:0 },
  'South Korea':   { id:'running_machine',  name:'Running Machine',   desc:'+8 STA, +4 MEN',                              fx:{stamina:8,mental:4}, goalBonus:0 },
  'Iran':          { id:'compact_defense',  name:'Compact Defense',   desc:'+8 DEF, +4 MEN',                               fx:{defense:8,mental:4}, goalBonus:0 },
  'Australia':     { id:'physical',         name:'Physical Kings',    desc:'+8 STA, +4 ATK',                               fx:{stamina:8,attack:4}, goalBonus:0 },
  // CAF
  'Nigeria':       { id:'physical',         name:'Physical Kings',    desc:'Raw athleticism — +8 STA, +6 ATK',            fx:{stamina:8,attack:6}, goalBonus:0 },
  'Senegal':       { id:'physical',         name:'Physical Kings',    desc:'+8 STA, +4 ATK',                               fx:{stamina:8,attack:4}, goalBonus:0 },
  'Morocco':       { id:'compact_defense',  name:'Compact Defense',   desc:'+8 DEF, +4 MEN',                               fx:{defense:8,mental:4}, goalBonus:0 },
  'Ghana':         { id:'running_machine',  name:'Running Machine',   desc:'+6 STA, +4 ATK',                               fx:{stamina:6,attack:4}, goalBonus:0 },
  'Ivory Coast':   { id:'physical',         name:'Physical Kings',    desc:'+8 STA, +4 ATK',                               fx:{stamina:8,attack:4}, goalBonus:0 },
  'Cameroon':      { id:'physical',         name:'Physical Kings',    desc:'+6 STA, +4 ATK',                               fx:{stamina:6,attack:4}, goalBonus:0 },
  'Egypt':         { id:'competitive_beast',name:'Competitive Beast', desc:'+4 DEF, +6 MEN',                               fx:{defense:4,mental:6}, goalBonus:0 },
  // CONCACAF
  'Mexico':        { id:'competitive_beast',name:'Competitive Beast', desc:'Hard to beat — +4 DEF, +6 MEN',               fx:{defense:4,mental:6}, goalBonus:0 },
  'United States': { id:'physical',         name:'Physical Kings',    desc:'+6 STA, +4 ATK',                               fx:{stamina:6,attack:4}, goalBonus:0 },
}

export function getSoul(nationName) {
  return NATION_SOULS[nationName] || { id:'team_spirit', name:'Team Spirit', desc:'United as one — +4 MEN, +2 DEF', fx:{mental:4,defense:2}, goalBonus:0 }
}

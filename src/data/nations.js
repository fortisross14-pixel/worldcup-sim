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

// Flag emoji via unicode regional indicators
export function flag(cc) {
  if (!cc) return '🏳️'
  const special = {
    'gb-eng': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'gb-sct': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    'gb-wls': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  }
  if (special[cc]) return special[cc]
  return cc.toUpperCase().split('').map(c => String.fromCodePoint(0x1F1E0 + c.charCodeAt(0) - 65)).join('')
}

// Player name pools by nation
const NAMES = {
  de: { f:['Thomas','Kai','Leroy','Joshua','Leon','Niklas','Toni','Jamal','Florian','Julian'], l:['Müller','Havertz','Sané','Kimmich','Goretzka','Süle','Kroos','Musiala','Wirtz','Brandt'] },
  it: { f:['Lorenzo','Federico','Marco','Nicolo','Davide','Manuel','Ciro','Gianluca','Luca','Roberto'], l:['Insigne','Chiesa','Verratti','Barella','Tonali','Immobile','Locatelli','Donnarumma','Pellegrini','Bonucci'] },
  fr: { f:['Kylian','Antoine','Ousmane','Paul','Raphaël','Benjamin','Kingsley','Jules','Aurélien','Christopher'], l:['Mbappé','Griezmann','Dembélé','Pogba','Varane','Pavard','Coman','Koundé','Tchouaméni','Nkunku'] },
  es: { f:['Sergio','Carlos','Marcos','Pablo','Álvaro','Dani','Nacho','Pedri','Gavi','Ansu'], l:['García','Martínez','Rodríguez','Sánchez','Morata','Carvajal','Alba','Gavi','Pedri','Félix'] },
  'gb-eng': { f:['Harry','Marcus','Raheem','Jordan','Declan','Mason','Phil','Jack','Bukayo','Jude'], l:['Kane','Rashford','Sterling','Henderson','Rice','Mount','Foden','Grealish','Saka','Bellingham'] },
  br: { f:['Neymar','Vinicius','Rodrygo','Lucas','Eder','Richarlison','Gabriel','Antony','Raphinha','Fred'], l:['Jr','Jr','Militão','Paquetá','Firmino','Thaisa','Magalhães','Araújo','Guimarães','Santos'] },
  ar: { f:['Lionel','Angel','Paulo','Rodrigo','Leandro','Nicolas','Alexis','Emiliano','Marcos','Lautaro'], l:['Messi','Di María','Dybala','De Paul','Paredes','Tagliafico','Mac Allister','Martínez','Acuña','Martínez'] },
  uy: { f:['Luis','Edinson','Diego','Federico','Rodrigo','Darwin','Ronald','Sebastián','Nahitan','Giorgian'], l:['Suárez','Cavani','Godín','Valverde','Bentancur','Núñez','Araújo','Coates','Nández','De Arrascaeta'] },
  pt: { f:['Cristiano','Bernardo','Bruno','João','Diogo','Rúben','Gonçalo','Raphaël','André','Vitinha'], l:['Ronaldo','Silva','Fernandes','Félix','Jota','Dias','Ramos','Guerreiro','André Silva','Nunes'] },
  nl: { f:['Virgil','Georginio','Frenkie','Memphis','Matthijs','Cody','Davy','Teun','Xavi','Wout'], l:['van Dijk','Wijnaldum','de Jong','Depay','de Ligt','Gakpo','Klaassen','Koopmeiners','Simons','Weghorst'] },
  default: { f:['Carlos','Marco','David','Ivan','Stefan','Alexei','Andrei','Mohammed','Hiroshi','Samuel'], l:['García','Rossi','Johnson','Petrov','Kovač','Ivanov','Popescu','Al-Rashid','Tanaka','Osei'] }
}

export function getPlayerName(cc) {
  const pool = NAMES[cc] || NAMES.default
  const f = pool.f[Math.floor(Math.random() * pool.f.length)]
  const l = pool.l[Math.floor(Math.random() * pool.l.length)]
  return `${f} ${l}`
}

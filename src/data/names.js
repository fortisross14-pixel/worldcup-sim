// ── Name pools by language ────────────────────────────────────
// Each pool has first names (f) and last names (l).
// Some languages (Portuguese) support mononyms (single-word names like Pelé, Kaká).

const POOLS = {

  // ── ENGLISH ──────────────────────────────────────────────────
  english: {
    f: ['James','Harry','Jack','Oliver','George','Thomas','Liam','Mason','Declan','Marcus',
        'Raheem','Phil','Jordan','Bukayo','Jude','Harvey','Conor','Reece','Luke','Nathan',
        'Ethan','Charlie','Callum','Ryan','Kyle','Jamie','Aaron','Lewis','Danny','Scott'],
    l: ['Smith','Jones','Williams','Brown','Taylor','Davies','Evans','Wilson','Thomas','Roberts',
        'Walker','White','Thompson','Martin','Harris','Jackson','Lewis','Clark','Hall','Ward',
        'Robinson','Young','Allen','King','Wright','Scott','Baker','Mitchell','Turner','Phillips',
        'Carter','Rogers','Campbell','Richardson','Shaw','Henderson','Collins','Reed','Cook','Morgan'],
  },

  // ── SPANISH ──────────────────────────────────────────────────
  spanish: {
    f: ['Carlos','Luis','Pablo','Alejandro','Diego','Marco','Andrés','Sergio','Álvaro','Nicolás',
        'Rodrigo','Gabriel','Emilio','Raúl','Fernando','David','Javier','Óscar','Jesús','Rafael',
        'Iván','Eduardo','Rubén','Samuel','Felipe','Arturo','Hugo','Ernesto','Roberto','Vicente'],
    l: ['García','Martínez','López','González','Hernández','Pérez','Rodríguez','Sánchez','Ramírez',
        'Torres','Flores','Rivera','Gómez','Díaz','Reyes','Morales','Cruz','Ortiz','Gutierrez','Chávez',
        'Ramos','Medina','Aguilar','Castillo','Jiménez','Vargas','Moreno','Romero','Ruiz','Alvarado',
        'Mendoza','Herrera','Muñoz','Suárez','Delgado','Vega','Castro','Peña','Guerrero','Cabrera'],
  },

  // ── FRENCH ───────────────────────────────────────────────────
  french: {
    f: ['Antoine','Kylian','Ousmane','Paul','Raphaël','Benjamin','Kingsley','Jules','Aurélien',
        'Christopher','Theo','Lucas','Loïc','Florian','Adrien','Jonathan','William','Mattéo',
        'Kevin','Nicolas','Sébastien','Alexandre','Thomas','Pierre','Maxime','Alexis','Vincent','Romain'],
    l: ['Martin','Bernard','Dubois','Thomas','Robert','Petit','Durand','Leroy','Moreau','Simon',
        'Laurent','Lefebvre','Michel','Garcia','David','Bertrand','Roux','Vincent','Fournier','Morel',
        'Girard','André','Mercier','Dupont','Lambert','Bonnet','François','Martinez','Legrand','Garnier',
        'Faure','Rousseau','Blanc','Guérin','Muller','Henry','Roussel','Nicolas','Perrin','Morin'],
  },

  // ── PORTUGUESE ───────────────────────────────────────────────
  // Has mononym pool — some players known by single name
  portuguese: {
    f: ['João','Bruno','Diogo','Rúben','Gonçalo','Raphaël','André','Vitinha','Bernardo','Cristiano',
        'Neymar','Vinicius','Rodrygo','Richarlison','Gabriel','Antony','Raphinha','Endrick','Lucas','Danilo',
        'Marcelo','Willian','Coutinho','Firmino','Ederson','Alisson','Thiago','Éder','Kaio','Matheus'],
    l: ['Silva','Santos','Ferreira','Pereira','Costa','Carvalho','Oliveira','Rodrigues','Fernandes','Alves',
        'Gomes','Lopes','Martins','Sousa','Marques','Barbosa','Nascimento','Lima','Araújo','Moreira',
        'Nunes','Pinto','Cardoso','Correia','Melo','Fonseca','Ribeiro','Monteiro','Cruz','Teixeira',
        'Andrade','Cunha','Ramos','Freitas','Machado','Vieira','Mendes','Dias','Pires','Coelho'],
    // Mononyms — single-name players (Brazilian tradition)
    mononyms: ['Pelé','Garrincha','Kaká','Ronaldinho','Romário','Rivaldo','Adriano','Bebeto','Zico',
               'Tostão','Didi','Vavá','Mané','Toró','Leandro','Falcão','Júnior','Müller','Cafu','Roberto'],
    mononymChance: 0.12,
  },

  // ── ARABIC ───────────────────────────────────────────────────
  arabic: {
    f: ['Mohammed','Ahmed','Ali','Omar','Yusuf','Hassan','Ibrahim','Khalid','Tariq','Sami',
        'Nasser','Saleh','Faisal','Hamza','Rayan','Ziad','Walid','Karim','Moussa','Samir',
        'Bilal','Rachid','Hani','Amin','Wissam','Mehdi','Sofiane','Ayoub','Yassine','Abdelhamid'],
    l: ['Al-Rashid','Al-Hassan','Al-Farsi','Benali','Boudiaf','Mansouri','Ziani','Belkacem','Hamdi','Saidi',
        'Khaled','Nouri','Brahimi','Feghouli','Mahrez','Belhanda','Amrabat','Ziyech','Ounahi','En-Nesyri',
        'Al-Dawsari','Al-Shahrani','Al-Faraj','Al-Qahtani','Otayf','Talisca','Al-Malki','Al-Buraikan','Salah','Mane'],
  },

  // ── SUB-SAHARAN AFRICAN ───────────────────────────────────────
  subsaharan: {
    f: ['Kofi','Kwame','Emmanuel','Prince','Samuel','Joseph','Michael','Christian','Victor','Collins',
        'Daniel','Patrick','Peter','Frank','Jonathan','Stephen','John','Augustine','Charles','Felix',
        'Wilfried','Serge','Didier','Yaya','Ismaila','Sadio','Nicolas','Bertrand','Blaise','Cheikhou'],
    l: ['Osei','Mensah','Asante','Boateng','Ayew','Gyan','Atsu','Partey','Amartey','Semenyo',
        'Touré','Drogba','Zaha','Pépé','Gbamin','Sangare','Cornet','Kessié','Gradel','Koné',
        'Mané','Gueye','Diallo','Diatta','Sow','Kouyaté','Sarr','Ndoye','Niakhate','Ballo-Touré',
        'Adebayor','Okafor','Eze','Iwobi','Ndidi','Lookman','Osimhen','Chukwueze','Aribo','Ekitike'],
  },

  // ── RUSSIAN / SLAVIC ──────────────────────────────────────────
  russian: {
    f: ['Aleksandr','Dmitri','Sergei','Vladimir','Ivan','Mikhail','Andrei','Nikolai','Pavel','Roman',
        'Anton','Artem','Kirill','Evgeni','Yuri','Viktor','Alexei','Oleg','Igor','Denis',
        'Daniil','Maxim','Ruslan','Timur','Vadim','Fedor','Stanislav','Konstantin','Ilya','Vitali'],
    l: ['Ivanov','Petrov','Sidorov','Smirnov','Kuznetsov','Popov','Sokolov','Lebedev','Kozlov','Novikov',
        'Morozov','Volkov','Soloviev','Vasiliev','Zaytsev','Pavlov','Semyonov','Golubev','Vinogradov','Bogdanov',
        'Voronov','Fedorov','Mikhailov','Belyaev','Tarasov','Belov','Komissarov','Orlov','Kirillov','Makarov'],
  },

  // ── GERMAN ───────────────────────────────────────────────────
  german: {
    f: ['Thomas','Kai','Leroy','Joshua','Leon','Niklas','Toni','Jamal','Florian','Julian',
        'Lukas','Marco','André','Emre','Robin','Matthias','Bastian','Mario','Benedikt','Kevin'],
    l: ['Müller','Havertz','Sané','Kimmich','Goretzka','Süle','Kroos','Musiala','Wirtz','Brandt',
        'Neuer','Reus','Hummels','Boateng','Draxler','Can','Koch','Waldschmidt','Ginter','Baumgartner'],
  },

  // ── ITALIAN ──────────────────────────────────────────────────
  italian: {
    f: ['Lorenzo','Federico','Marco','Nicolo','Davide','Manuel','Ciro','Gianluca','Luca','Roberto',
        'Giovanni','Giuseppe','Antonio','Francesco','Alessandro','Matteo','Stefano','Giorgio','Enrico','Mario'],
    l: ['Rossi','Ferrari','Russo','Bianchi','Romano','Gallo','Costa','Fontana','Conti','Esposito',
        'Ricci','Marino','Greco','Bruno','Gallo','De Luca','Mancini','Pellegrini','Barella','Tonali'],
  },

  // ── DUTCH / SCANDINAVIAN ──────────────────────────────────────
  dutch: {
    f: ['Virgil','Frenkie','Memphis','Cody','Davy','Teun','Xavi','Wout','Marten','Donyell',
        'Erling','Martin','Kasper','Mikkel','Emil','Christian','Joakim','Andreas','Jesper','Simon'],
    l: ['van Dijk','de Jong','Depay','Gakpo','Klaassen','Koopmeiners','Simons','Weghorst','Schouten','Malen',
        'Haaland','Ødegaard','Schmeichel','Damsgaard','Hojlund','Eriksen','Lindstrom','Christensen','Olsen','Norgaard'],
  },

  // ── JAPANESE ──────────────────────────────────────────────────
  japanese: {
    f: ['Takumi','Hiroki','Daichi','Ritsu','Kaoru','Junya','Ao','Yuya','Yuta','Koji',
        'Keisuke','Shinji','Shunsuke','Hotaru','Gaku','Atsuto','Makoto','Yasuhito','Shinji','Ryuji'],
    l: ['Minamino','Sakai','Doan','Ito','Mitoma','Tanaka','Nagatomo','Osako','Honda','Kamada',
        'Tsubasa','Kubo','Tomiyasu','Endo','Wataru','Fujita','Hashioka','Machida','Furuhashi','Ueda'],
  },

  // ── KOREAN ────────────────────────────────────────────────────
  korean: {
    f: ['Son','Hwang','Lee','Kim','Park','Cho','Jung','Kwon','Lim','Oh',
        'Jeong','Bae','Han','Seo','Yoon','Jang','Choi','Shin','Kang','Moon'],
    l: ['Heung-min','In-beom','Jae-sung','Seung-ho','Min-woo','Tae-seop','Jun-ho','Young-gwon','Hyun-woo','Ui-jo',
        'Hee-chan','Seung-gyu','Jung-woo','Myung-jae','Yong-woo','Dong-joon','Kyung-rok','Il-lok','Jun-su','Tae-hwan'],
  },

  // ── CHINESE ───────────────────────────────────────────────────
  chinese: {
    f: ['Wei','Lei','Yang','Zheng','Bo','Hao','Jun','Chao','Fei','Long',
        'Xiang','Tao','Jian','Rui','Peng','Yi','Kai','Chen','Bin','Dong'],
    l: ['Wang','Li','Zhang','Liu','Chen','Yang','Huang','Zhao','Wu','Zhou',
        'Xu','Zhu','Lin','He','Guo','Ma','Luo','Liang','Song','Zheng'],
  },

  // ── LATIN AMERICAN (non-Spanish/Portuguese specific) ──────────
  // Used for countries like Peru, Bolivia, etc.
  latam: {
    f: ['Paolo','Jefferson','André','Yordy','Raúl','Eduardo','Gianluca','Renato','Christian','Sergio'],
    l: ['Guerrero','Farfán','Carrillo','Ruidíaz','Tapia','Cueva','Flores','Peña','Hurtado','Advíncula'],
  },
}

// ── Country → language mix ────────────────────────────────────
// Format: [[pool_key, weight], ...] — weights don't need to sum to 1
const COUNTRY_MIX = {
  // English-speaking
  'gb-eng': [['english', 1.0]],
  'gb-sct': [['english', 1.0]],
  'us':     [['english', 0.55], ['spanish', 0.25], ['german', 0.10], ['italian', 0.10]],
  'au':     [['english', 0.85], ['italian', 0.10], ['subsaharan', 0.05]],
  'ca':     [['english', 0.65], ['french', 0.25], ['italian', 0.10]],
  'nz':     [['english', 1.0]],
  'ie':     [['english', 1.0]],
  // Spanish-speaking
  'es':     [['spanish', 1.0]],
  'mx':     [['spanish', 1.0]],
  'ar':     [['spanish', 0.85], ['italian', 0.15]],
  'co':     [['spanish', 1.0]],
  'cl':     [['spanish', 0.95], ['german', 0.05]],
  'pe':     [['spanish', 0.90], ['latam', 0.10]],
  'ec':     [['spanish', 1.0]],
  'py':     [['spanish', 1.0]],
  'bo':     [['spanish', 1.0]],
  've':     [['spanish', 1.0]],
  // Portuguese
  'br':     [['portuguese', 0.90], ['subsaharan', 0.10]],
  'pt':     [['portuguese', 0.80], ['subsaharan', 0.15], ['spanish', 0.05]],
  // French
  'fr':     [['french', 0.65], ['subsaharan', 0.20], ['arabic', 0.15]],
  'ci':     [['french', 0.50], ['subsaharan', 0.50]],
  'cm':     [['french', 0.50], ['subsaharan', 0.50]],
  'sn':     [['french', 0.30], ['subsaharan', 0.50], ['arabic', 0.20]],
  'ml':     [['french', 0.30], ['subsaharan', 0.50], ['arabic', 0.20]],
  // Arabic
  'ma':     [['arabic', 0.60], ['french', 0.30], ['subsaharan', 0.10]],
  'dz':     [['arabic', 0.60], ['french', 0.40]],
  'tn':     [['arabic', 0.60], ['french', 0.40]],
  'eg':     [['arabic', 1.0]],
  'sa':     [['arabic', 1.0]],
  'ir':     [['arabic', 0.50], ['russian', 0.50]], // Farsi-like, using arabic/russian as proxy
  'iq':     [['arabic', 1.0]],
  'qa':     [['arabic', 1.0]],
  // Sub-Saharan Africa
  'ng':     [['subsaharan', 0.55], ['english', 0.35], ['arabic', 0.10]],
  'gh':     [['subsaharan', 0.55], ['english', 0.45]],
  'za':     [['english', 0.50], ['subsaharan', 0.50]],
  // German
  'de':     [['german', 1.0]],
  'at':     [['german', 1.0]],
  'ch':     [['german', 0.65], ['french', 0.25], ['italian', 0.10]],
  // Italian
  'it':     [['italian', 1.0]],
  // Dutch/Nordic
  'nl':     [['dutch', 0.80], ['subsaharan', 0.20]],
  'be':     [['dutch', 0.45], ['french', 0.40], ['subsaharan', 0.15]],
  'dk':     [['dutch', 1.0]],
  'se':     [['dutch', 0.85], ['subsaharan', 0.15]],
  'no':     [['dutch', 1.0]],
  // Eastern Europe / Slavic
  'ru':     [['russian', 1.0]],
  'ua':     [['russian', 1.0]],
  'hr':     [['russian', 0.80], ['german', 0.20]],
  'rs':     [['russian', 1.0]],
  'pl':     [['russian', 0.80], ['german', 0.20]],
  'cz':     [['russian', 0.80], ['german', 0.20]],
  'sk':     [['russian', 0.80], ['german', 0.20]],
  'ro':     [['russian', 0.60], ['french', 0.40]],
  'hu':     [['russian', 0.80], ['german', 0.20]],
  'gr':     [['italian', 0.50], ['russian', 0.50]], // Greek, using closest proxy
  'tr':     [['arabic', 0.40], ['russian', 0.60]],
  // East Asian
  'jp':     [['japanese', 1.0]],
  'kr':     [['korean', 1.0]],
  'cn':     [['chinese', 1.0]],
  // Oceania / misc
  'uy':     [['spanish', 0.85], ['italian', 0.15]],
  'cr':     [['spanish', 1.0]],
  'hn':     [['spanish', 1.0]],
  'jm':     [['english', 1.0]],
  'xk':     [['russian', 0.60], ['arabic', 0.40]],
}

// Fallback for unknown countries
const DEFAULT_MIX = [['english', 0.5], ['spanish', 0.3], ['french', 0.2]]

// ── Name generation ───────────────────────────────────────────
function weightedPick(mix) {
  const total = mix.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [key, w] of mix) { r -= w; if (r <= 0) return key }
  return mix[mix.length - 1][0]
}

function pickFrom(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// Track used names per nation to avoid duplicates
const usedNamesPerNation = new Map()

export function getPlayerName(cc) {
  const mix = COUNTRY_MIX[cc?.toLowerCase()] || DEFAULT_MIX
  const poolKey = weightedPick(mix)
  const pool = POOLS[poolKey] || POOLS.english

  // Portuguese mononym chance
  if (pool.mononyms && Math.random() < (pool.mononymChance || 0.12)) {
    const mono = pickFrom(pool.mononyms)
    return deduplicateName(cc, mono)
  }

  const first = pickFrom(pool.f)
  const last  = pickFrom(pool.l)
  return deduplicateName(cc, `${first} ${last}`)
}

function deduplicateName(cc, baseName) {
  const key = cc?.toLowerCase() || 'default'
  if (!usedNamesPerNation.has(key)) usedNamesPerNation.set(key, new Map())
  const used = usedNamesPerNation.get(key)
  const count = (used.get(baseName) || 0) + 1
  used.set(baseName, count)
  if (count === 1) return baseName
  const numerals = ['','','II','III','IV','V','VI','VII','VIII','IX','X']
  return `${baseName} ${numerals[count] || count}`
}

// Reset name tracking between WC cycles
export function resetNameTracking() {
  usedNamesPerNation.clear()
}

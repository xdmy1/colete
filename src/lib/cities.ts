import type { DestinationCode } from './utils'

// Liste de orase per tara — folosite pentru autocomplete + corectarea denumirilor
// scrise gresit de soferi (ca sa se poata filtra in Excel dupa oras).
// Operatorul POATE scrie un oras care nu e in lista (scrie cum aude) — lista
// doar propune, nu blocheaza.

const UK_CITIES = [
  'Aberdeen', 'Ashford', 'Aylesbury', 'Banbury', 'Barnsley', 'Basildon', 'Basingstoke',
  'Bath', 'Bedford', 'Belfast', 'Birmingham', 'Blackburn', 'Blackpool', 'Bolton',
  'Boston', 'Bournemouth', 'Bradford', 'Brighton', 'Bristol', 'Burnley', 'Burton upon Trent',
  'Bury St Edmunds', 'Cambridge', 'Canterbury', 'Cardiff', 'Carlisle', 'Chatham',
  'Chelmsford', 'Cheltenham', 'Chester', 'Chesterfield', 'Colchester', 'Corby',
  'Coventry', 'Crawley', 'Crewe', 'Croydon', 'Dagenham', 'Darlington', 'Derby',
  'Doncaster', 'Dover', 'Dudley', 'Dundee', 'Dunstable', 'Durham', 'Eastbourne',
  'Edinburgh', 'Enfield', 'Exeter', 'Feltham', 'Folkestone', 'Gillingham', 'Glasgow',
  'Gloucester', 'Grantham', 'Gravesend', 'Great Yarmouth', 'Grimsby', 'Guildford',
  'Halifax', 'Harlow', 'Harrow', 'Hastings', 'Hemel Hempstead', 'Hereford',
  'High Wycombe', 'Huddersfield', 'Hull', 'Ilford', 'Ipswich', 'Kettering',
  'Kidderminster', "King's Lynn", 'Kingston upon Thames', 'Lancaster', 'Leeds',
  'Leicester', 'Lincoln', 'Liverpool', 'Livingston', 'Londra', 'Loughborough',
  'Luton', 'Maidstone', 'Manchester', 'Mansfield', 'Margate', 'Middlesbrough',
  'Milton Keynes', 'Newcastle', 'Newport', 'Northampton', 'Norwich', 'Nottingham',
  'Nuneaton', 'Oldham', 'Oxford', 'Peterborough', 'Plymouth', 'Poole', 'Portsmouth',
  'Preston', 'Reading', 'Redditch', 'Rochdale', 'Rochester', 'Romford', 'Rotherham',
  'Rugby', 'Salford', 'Salisbury', 'Scunthorpe', 'Sheffield', 'Slough', 'Southall',
  'Southampton', 'Southend-on-Sea', 'Spalding', 'St Albans', 'Stevenage', 'Stockport',
  'Stoke-on-Trent', 'Stratford', 'Sunderland', 'Sutton', 'Swansea', 'Swindon',
  'Tamworth', 'Taunton', 'Telford', 'Thetford', 'Tilbury', 'Uxbridge', 'Wakefield',
  'Walsall', 'Warrington', 'Warwick', 'Watford', 'Wellingborough', 'Wembley',
  'Weston-super-Mare', 'Wigan', 'Winchester', 'Wisbech', 'Woking', 'Wolverhampton',
  'Worcester', 'Worthing', 'Wrexham', 'York',
]

const MD_CITIES = [
  'Chișinău', 'Anenii Noi', 'Bălți', 'Basarabeasca', 'Bender', 'Briceni', 'Cahul',
  'Cantemir', 'Călărași', 'Căușeni', 'Ceadîr-Lunga', 'Cimișlia', 'Comrat', 'Criuleni',
  'Dondușeni', 'Drochia', 'Dubăsari', 'Durlești', 'Edineț', 'Fălești', 'Florești',
  'Glodeni', 'Hîncești', 'Ialoveni', 'Leova', 'Nisporeni', 'Ocnița', 'Orhei',
  'Rezina', 'Rîșcani', 'Sîngerei', 'Soroca', 'Stăuceni', 'Strășeni', 'Șoldănești',
  'Ștefan Vodă', 'Taraclia', 'Telenești', 'Tiraspol', 'Ungheni', 'Vadul lui Vodă',
  'Vulcănești', 'Codru', 'Cricova', 'Sângera', 'Vatra', 'Truşeni', 'Băcioi',
]

const BE_CITIES = [
  'Bruxelles', 'Aalst', 'Antwerpen', 'Arlon', 'Brugge', 'Charleroi', 'Dendermonde',
  'Genk', 'Gent', 'Hasselt', 'Kortrijk', 'La Louvière', 'Leuven', 'Liège', 'Lier',
  'Mechelen', 'Mons', 'Mouscron', 'Namur', 'Oostende', 'Roeselare', 'Sint-Niklaas',
  'Sint-Truiden', 'Tongeren', 'Tournai', 'Turnhout', 'Verviers', 'Vilvoorde', 'Zeebrugge',
]

const NL_CITIES = [
  'Amsterdam', 'Alkmaar', 'Almere', 'Amersfoort', 'Apeldoorn', 'Arnhem', 'Breda',
  'Delft', 'Den Bosch', 'Den Haag', 'Deventer', 'Dordrecht', 'Ede', 'Eindhoven',
  'Emmen', 'Enschede', 'Gouda', 'Groningen', 'Haarlem', 'Heerlen', 'Helmond',
  'Hilversum', 'Leeuwarden', 'Leiden', 'Lelystad', 'Maastricht', 'Nijmegen',
  'Roermond', 'Roosendaal', 'Rotterdam', 'Tilburg', 'Utrecht', 'Venlo', 'Venray',
  'Zaandam', 'Zoetermeer', 'Zwolle',
]

const DE_CITIES = [
  'Berlin', 'Aachen', 'Augsburg', 'Bielefeld', 'Bochum', 'Bonn', 'Braunschweig',
  'Bremen', 'Chemnitz', 'Dortmund', 'Dresden', 'Duisburg', 'Düsseldorf', 'Erfurt',
  'Essen', 'Frankfurt', 'Freiburg', 'Gelsenkirchen', 'Hamburg', 'Hannover',
  'Heidelberg', 'Heilbronn', 'Ingolstadt', 'Karlsruhe', 'Kassel', 'Kiel', 'Koblenz',
  'Köln', 'Krefeld', 'Leipzig', 'Lübeck', 'Ludwigshafen', 'Magdeburg', 'Mainz',
  'Mannheim', 'Mönchengladbach', 'München', 'Münster', 'Nürnberg', 'Offenbach',
  'Oldenburg', 'Osnabrück', 'Paderborn', 'Passau', 'Pforzheim', 'Regensburg',
  'Rostock', 'Saarbrücken', 'Stuttgart', 'Ulm', 'Wiesbaden', 'Wolfsburg', 'Wuppertal',
]

export const CITIES: Record<DestinationCode, string[]> = {
  UK: UK_CITIES,
  MD: MD_CITIES,
  BE: BE_CITIES,
  NL: NL_CITIES,
  DE: DE_CITIES,
}

// lowercase + fara diacritice + fara punctuatie — "Chisinau" matchuieste "Chișinău"
export function normalizeCity(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-'’.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Distanta Levenshtein simpla — prinde typo-uri gen "Nortampton" → "Northampton"
function levenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
      diagonal = tmp
    }
  }
  return prev[b.length]
}

// Sugestii pentru ce a tastat soferul: intai potriviri la inceput de cuvant,
// apoi substring, apoi typo-uri apropiate (distanta ≤2).
export function suggestCities(query: string, country: DestinationCode, limit = 6): string[] {
  const q = normalizeCity(query)
  if (q.length < 2) return []
  const list = CITIES[country] ?? []

  const starts: string[] = []
  const includes: string[] = []
  const close: string[] = []

  for (const city of list) {
    const n = normalizeCity(city)
    if (n.startsWith(q)) starts.push(city)
    else if (n.includes(q)) includes.push(city)
    else if (q.length >= 4 && levenshtein(q, n) <= 2) close.push(city)
  }

  return [...starts, ...includes, ...close].slice(0, limit)
}

// Daca ce a scris soferul e (dupa normalizare) un oras cunoscut, intoarce
// denumirea canonica; altfel pastreaza exact ce a scris (oras nou / auzit).
export function canonicalCity(value: string, country: DestinationCode): string {
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) return ''
  const q = normalizeCity(trimmed)
  const exact = (CITIES[country] ?? []).find((c) => normalizeCity(c) === q)
  return exact ?? trimmed
}

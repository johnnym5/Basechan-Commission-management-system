import type { CommissionRate } from '../types';

const GEOGRAPHIC_COUNTRY_KEYWORDS: Record<string, string[]> = {
  Canada: [
    'canada', 'toronto', 'mcgill', 'british columbia', 'vancouver', 'waterloo', 'alberta', 'mcmaster', 'calgary', 'ottawa', 'montreal', 'simon fraser', 'york university'
  ],
  USA: [
    'usa', 'united states', 'harvard', 'mit', 'stanford', 'columbia', 'yale', 'princeton', 'berkeley', 'nyu', 'california', 'texas', 'chicago', 'pennsylvania', 'michigan', 'florida'
  ],
  Australia: [
    'australia', 'melbourne', 'sydney', 'monash', 'queensland', 'unsw', 'adelaide', 'canberra', 'western australia', 'macquarie', 'rmit'
  ],
  UK: [
    'uk', 'united kingdom', 'england', 'scotland', 'wales', 'london', 'oxford', 'cambridge', 'manchester', 'edinburgh', 'leicester', 'coventry', 'aberdeen', 'birmingham', 'leeds', 'glasgow', 'sheffield', 'bristol', 'nottingham', 'southampton', 'newcastle', 'exeter', 'liverpool', 'cardiff', 'greenwich', 'sussex', 'york', 'reading', 'surrey', 'dundee', 'strathclyde', 'hull', 'swansea', 'stirling', 'plymouth', 'portsmouth', 'brunel', 'hertfordshire', 'salford', 'kingston', 'derby', 'de montfort', 'hudderfield', 'lincoln', 'roehampton', 'ulster'
  ],
};

export function resolveUniversityCountry(
  universityName: string,
  explicitCountry?: string,
  rates: CommissionRate[] = []
): string {
  // 1. If explicit country exists and is not empty, normalize & return
  if (explicitCountry && explicitCountry.trim() && explicitCountry.toUpperCase() !== 'UNKNOWN') {
    const clean = explicitCountry.trim();
    if (clean.toLowerCase() === 'united kingdom' || clean.toLowerCase() === 'u.k.') return 'UK';
    if (clean.toLowerCase() === 'united states' || clean.toLowerCase() === 'u.s.a.' || clean.toLowerCase() === 'us') return 'USA';
    return clean;
  }

  if (!universityName) return 'UK';
  const normName = universityName.toLowerCase();

  // 2. Check if another rate entry for this exact university has a country
  if (rates.length > 0) {
    const matchWithCountry = rates.find(
      (r) => r.universityName.toLowerCase() === normName && r.country && r.country.trim()
    );
    if (matchWithCountry?.country) {
      return resolveUniversityCountry(universityName, matchWithCountry.country);
    }
  }

  // 3. Match against geographic keywords in university name
  for (const [country, keywords] of Object.entries(GEOGRAPHIC_COUNTRY_KEYWORDS)) {
    for (const kw of keywords) {
      if (normName.includes(kw)) {
        return country;
      }
    }
  }

  // 4. Fallback default for SI-UK / Basechan CMS
  return 'UK';
}

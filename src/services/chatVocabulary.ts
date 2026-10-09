/**
 * Local, deterministic wording aliases and semantic grammar lexicon for Basechan chat queries.
 */

export const GRAMMAR_LEXICON = {
  // Relational & Linker Adjectives / Prepositions
  RELATIONAL_ADJECTIVES: new Set([
    'related', 'associated', 'connected', 'linked', 'via', 'under',
    'through', 'using', 'pertaining', 'concerning', 'about', 'with',
    'for', 'on', 'from', 'belonging', 'offered'
  ]),

  // Action Verbs
  ACTION_VERBS: new Set([
    'show', 'find', 'fetch', 'display', 'list', 'pull', 'extract',
    'check', 'see', 'lookup', 'get', 'give', 'filter', 'bring',
    'calculate', 'compare', 'verify', 'count', 'number'
  ]),

  // Domain Nouns
  DOMAIN_NOUNS: new Set([
    'school', 'schools', 'university', 'universities', 'institution',
    'institutions', 'route', 'routes', 'portal', 'portals', 'aggregator',
    'aggregators', 'intake', 'intakes', 'level', 'levels', 'country',
    'countries', 'payout', 'payouts', 'commission', 'commissions', 'rate', 'rates'
  ]),

  // Guidance & Status Adjectives
  GUIDANCE_ADJECTIVES: new Set([
    'focus', 'preferred', 'priority', 'green', 'allowed', 'permitted',
    'restricted', 'avoid', 'do not use', 'red'
  ]),

  // Filter Reset & Chat Clearing Commands
  FILTER_RESET_VERBS: new Set([
    'remove filter', 'clear filter', 'reset filter', 'drop filter',
    'clear all filters', 'reset all filters', 'remove all filters',
    'reset chat', 'clear chat', 'clear messages', 'start fresh', 'restart chat'
  ]),
};

const phraseAliases: Array<[RegExp, string]> = [
  [/\bhow\s+much\s+(?:do\s+)?(?:they|dem)\s+dey\s+pay\b/gi, 'payout'],
  [/\bhow\s+much\s+(?:e|them|dem)\s+(?:dey|they)\s+pay\b/gi, 'payout'],
  [/\b(?:which|what)\s+ones?\s+(?:get|has|have)\b/gi, 'schools with'],
  [/\b(?:show|find|check)\s+(?:me\s+)?(?:the\s+)?ones?\s+(?:wey|that)\s+get\b/gi, 'show schools with'],
  [/\b(?:i\s+)?wan\s+see\b/gi, 'show me'],
  [/\b(?:make\s+)?i\s+see\b/gi, 'show me'],
  [/\b(?:abeg|please)\s+(?:help\s+me\s+)?(?:check|find|show|see)\b/gi, 'show me'],
  [/\b(?:same\s+thing|do\s+same)\s+(?:for|with)\b/gi, 'same for'],
  [/\b(?:compare\s+this|compare\s+that)\s+(?:one\s+)?(?:with|to)\b/gi, 'compare with'],
  [/\b(?:what|which)\s+is\s+the\s+(?:best|top)\b/gi, 'show'],
  [/\b(?:could|can|would|will)\s+you\b/gi, ''],
  [/\b(?:do\s+(?:we|you)\s+have|is\s+there)\b/gi, 'show me'],
  [/\b(?:tell|give)\s+me\b/gi, 'show me'],
  [/\b(?:i\s+am\s+)?looking\s+for\b/gi, 'find'],
  [/\bi\s+wan(?:t)?\s+know\b/gi, 'show me'],
  [/\bwhich\s+(schools?|universities|institutions?)\b/gi, 'show $1'],
  [/\b(schools?|universities|institutions?)\s+wey\s+get\b/gi, '$1 with'],
  [/\b(?:make\s+i\s+see|let\s+me\s+see)\b/gi, 'show me'],
  [/\b(?:i\s+wan(?:t)?|i\s+need|i\s+want\s+to)\b/gi, 'show me'],
  [/\b(?:abeg(?:\s+please)?|please)\b/gi, ''],
  [/\b(?:help\s+me\s+(?:check|find|see))\b/gi, 'show me'],
  [/\b(?:compare\s+am\s+with|compare\s+this\s+one\s+with)\b/gi, 'compare with'],
  [/\b(schools?|universities|institutions?)\s+wey\b/gi, '$1 that'],
  [/\bwey\b/gi, 'that'],
  [/\bno\s+go\s+use\b/gi, 'do not use'],
  [/\bno\s+use\b/gi, 'do not use'],
  [/\bdem\s+dey\s+pay\b/gi, 'paying'],
  [/\bdey\b/gi, 'are'],
  [/\bna\b/gi, ''],
  [/\babi\b/gi, ''],
];

const spellingAliases: Record<string, string> = {
  postgradute: 'postgraduate',
  postgratuate: 'postgraduate',
  postgraduat: 'postgraduate',
  postgrad: 'postgraduate',
  undergradute: 'undergraduate',
  undergratuate: 'undergraduate',
  undergraduat: 'undergraduate',
  undergrad: 'undergraduate',
  bachelors: 'undergraduate',
  bachelor: 'undergraduate',
  masters: 'postgraduate',
  universites: 'universities',
  univeristies: 'universities',
  univesity: 'university',
  univercity: 'university',
  universiy: 'university',
  univeristy: 'university',
  unversity: 'university',
  scholl: 'school',
  schooll: 'school',
  shcool: 'school',
  commision: 'commission',
  comission: 'commission',
  commisione: 'commission',
  commisioner: 'commission',
  intack: 'intake',
  intakke: 'intake',
  intak: 'intake',
  compar: 'compare',
  comapre: 'compare',
  compair: 'compare',
  focuss: 'focus',
  focas: 'focus',
  focuse: 'focus',
  alowed: 'allowed',
  allowd: 'allowed',
  restriced: 'restricted',
  restrikted: 'restricted',
  aggregrator: 'aggregator',
  aggregater: 'aggregator',
  payuot: 'payout',
  payput: 'payout',
  postgradutee: 'postgraduate',
  postgraduaate: 'postgraduate',
  undergradutee: 'undergraduate',
  undergraduaate: 'undergraduate',
  universitty: 'university',
  universitie: 'universities',
  restrictted: 'restricted',
  resricted: 'restricted',
  comparision: 'comparison',
  commisionrate: 'commission rate',
  commisionrates: 'commission rates',
};

export function normalizeChatVocabulary(input: string): string {
  let normalized = input.normalize('NFKC').toLowerCase();
  for (const [pattern, replacement] of phraseAliases) normalized = normalized.replace(pattern, replacement);
  normalized = normalized.replace(/,/g, ' ').replace(/[^\S\r\n]+/g, ' ').trim();
  return normalized.replace(/\b[a-z]+\b/gi, (word) => spellingAliases[word] || word);
}

export function normalizeChatEntityName(input: string): string {
  return input.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');
}

import type { SearchDictionaryItem } from '../types/search';

export const STUDY_LEVEL_DICTIONARY: SearchDictionaryItem[] = [
  { id: 'PG', name: 'Postgraduate', aliases: ['pg', 'postgrad', 'postgraduate', 'masters', 'master', 'msc', 'phd'] },
  { id: 'UG', name: 'Undergraduate', aliases: ['ug', 'undergrad', 'undergraduate', 'bachelors', 'bachelor', 'bsc'] },
  { id: 'FD', name: 'Foundation', aliases: ['fd', 'foundation', 'pre-masters'] },
];

export const STATUS_DICTIONARY: SearchDictionaryItem[] = [
  { id: 'FOCUS', name: 'Focus', aliases: ['focus', 'priority', 'preferred', 'green'] },
  { id: 'ALLOWED', name: 'Allowed', aliases: ['allowed', 'permitted', 'open'] },
  { id: 'DO_NOT_USE', name: 'Do Not Use', aliases: ['restricted', 'avoid', 'red', 'do not use', 'blocked'] },
];

export const COUNTRY_DICTIONARY: SearchDictionaryItem[] = [
  { id: 'UK', name: 'United Kingdom', aliases: ['uk', 'u.k.', 'britain', 'england', 'scotland', 'wales', 'united kingdom'] },
  { id: 'Canada', name: 'Canada', aliases: ['canada', 'ca'] },
  { id: 'USA', name: 'United States', aliases: ['usa', 'u.s.a.', 'us', 'united states', 'america'] },
  { id: 'Australia', name: 'Australia', aliases: ['australia', 'au'] },
  { id: 'Ghana', name: 'Ghana', aliases: ['ghana'] },
  { id: 'Nigeria', name: 'Nigeria', aliases: ['nigeria'] },
];

export const AGGREGATOR_DICTIONARY: SearchDictionaryItem[] = [
  { id: 'BASECHAN', name: 'BASECHAN', aliases: ['basechan', 'base chan', 'basechan direct'] },
  { id: 'EDVOY', name: 'EDVOY', aliases: ['edvoy', 'ed voy'] },
  { id: 'SI-UK', name: 'SI-UK', aliases: ['si-uk', 'siuk', 'si uk', 'si_uk'] },
  { id: 'UAP', name: 'UAP', aliases: ['uap', 'u.a.p.'] },
  { id: 'CRIZAC', name: 'CRIZAC', aliases: ['crizac'] },
  { id: 'Direct', name: 'Direct', aliases: ['direct', 'direct application', 'uni direct'] },
];

export type TokenType = 'school' | 'route' | 'intake' | 'level' | 'status' | 'country' | 'aggregator' | 'search';

export interface SearchToken {
  id: string;
  type: TokenType;
  label: string;
  value: string;
}

export interface ParseResult {
  tokens: SearchToken[];
  remainingText: string;
  didYouMean?: { original: string; suggestion: SearchToken };
}

export interface SearchDictionaryItem {
  id: string;
  name: string;
  aliases: string[];
}

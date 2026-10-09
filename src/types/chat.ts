import type { StudyLevel } from './index';

export interface IntakeYearRange {
  startYear: number;
  endYear: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  resultIds?: string[];
  status?: 'sent' | 'clarifying' | 'results';
  clarification?: {
    field: 'school' | 'country' | 'level' | 'intake' | 'scope' | 'intent' | 'ranking';
    choices: Array<{ label: string; value: string }>;
  };
  resultRates?: Array<{
    id: string;
    universityId: string;
    universityName: string;
    country?: string;
    intake: string;
    studyLevel: StudyLevel;
    aggregator?: string;
    agentRate?: number;
    isFlatFee?: boolean;
    guidance?: 'FOCUS' | 'ALLOWED' | 'DO_NOT_USE';
    notes?: string;
  }>;
}

export interface ChatSearchIntent {
  schoolIds: string[];
  country?: string;
  level?: Exclude<StudyLevel, 'ALL'>;
  intake?: string;
  guidance?: 'FOCUS' | 'ALLOWED' | 'DO_NOT_USE';
  guidances?: Array<'FOCUS' | 'ALLOWED' | 'DO_NOT_USE'>;
  intakeOrder?: 'latest' | 'earliest';
  quantity?: 'schools' | 'routes';
  scopeSelection?: 'all' | 'intake' | 'level';
  aggregatorTerms: string[];
  rateMinimum?: number;
  rateMaximum?: number;
  feeType?: 'FLAT' | 'PERCENTAGE';
  sortBy?: 'rate_desc' | 'rate_asc';
  compare: boolean;
  compareSchoolIds: string[];
}

export interface PendingChatClarification {
  field: 'school' | 'country' | 'level' | 'intake' | 'scope' | 'intent' | 'ranking';
  prompt: string;
  choices: Array<{ label: string; value: string }>;
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  queryCount?: number;
  activeIntake?: string;
  activeLevel?: Exclude<StudyLevel, 'ALL'>;
  activeSchoolIds?: string[];
  lastResultSchoolIds?: string[];
  searchIntent?: ChatSearchIntent;
  pendingClarification?: PendingChatClarification;
}

export interface ChatPromptSuggestion {
  label: string;
  prompt: string;
}

export interface AgentChatProfile {
  uid: string;
  queryCount: number;
  preferredLevels: Partial<Record<Exclude<StudyLevel, 'ALL'>, number>>;
  preferredGuidance: Partial<Record<'FOCUS' | 'ALLOWED' | 'DO_NOT_USE', number>>;
  frequentSchoolIds: Record<string, number>;
  frequentCountryTerms?: Record<string, number>;
  frequentIntakeTerms?: Record<string, number>;
  suggestionTerms: string[];
  updatedAt: string;
}

export interface FavoriteSchool {
  id: string;
  universityId: string;
  universityName: string;
  createdAt: string;
}

export interface UserUpdate {
  id: string;
  title: string;
  summary: string;
  type: 'rates' | 'guidance' | 'intake' | 'routing' | 'access';
  createdAt: string;
  isRead: boolean;
  changedSchoolCount?: number;
  affectedSchoolIds?: string[];
}

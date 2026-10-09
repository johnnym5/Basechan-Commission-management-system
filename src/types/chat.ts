import type { StudyLevel } from './index';

export interface IntakeYearRange {
  startYear: number;
  endYear: number;
}

export interface StagedCommand {
  id: string; // UUID
  type: 'UPDATE_GUIDANCE' | 'UPDATE_ROUTE' | 'DISABLE_SHEET' | 'SET_DEFAULT_INTAKE' | 'CLONE_INTAKE' | 'MANAGE_ACCESS';
  description: string; // e.g. "This action will set guidance to Focus for Leicester University across PG level."
  targetEntities: {
    schoolNames?: string[];
    userEmail?: string;
    intake?: string;
    level?: StudyLevel;
    newValue?: string;
    affectedRole?: string;
  };
  payload: Record<string, any>;
}

export interface ChatFilterPrompt {
  field: 'intake' | 'intakeYearRange' | 'aggregator' | 'level' | 'guidance';
  question: string;
  choices: Array<{ label: string; value: string }>;
}

export interface NavigationAction {
  targetPage?: 'Dashboard' | 'Compare Rates' | 'Deal Calculator' | 'Users & Activity' | 'Application Directory' | 'Agent Commissions' | 'Settings';
  targetModal?: 'upload' | 'addRate' | 'migrateIntake' | 'auditLog' | 'legal';
  label: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  resultIds?: string[];
  status?: 'sent' | 'clarifying' | 'results';
  followUpFilter?: ChatFilterPrompt;
  stagedCommand?: StagedCommand;
  navigationAction?: NavigationAction;
  clarification?: {
    field: 'school' | 'country' | 'level' | 'intake' | 'intakeYearRange' | 'aggregator' | 'guidance' | 'scope' | 'intent' | 'ranking' | 'payout';
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
  countryTerms?: string[];
  level?: Exclude<StudyLevel, 'ALL'>;
  intake?: string;
  intakeYearRange?: IntakeYearRange;
  guidance?: 'FOCUS' | 'ALLOWED' | 'DO_NOT_USE';
  guidances?: Array<'FOCUS' | 'ALLOWED' | 'DO_NOT_USE'>;
  intakeOrder?: 'latest' | 'earliest';
  quantity?: 'schools' | 'routes';
  scopeSelection?: 'all' | 'intake' | 'level';
  aggregatorTerms?: string[];
  rateMinimum?: number;
  rateMaximum?: number;
  feeType?: 'FLAT' | 'PERCENTAGE';
  sortBy?: 'rate_desc' | 'rate_asc';
  compare: boolean;
  compareSchoolIds: string[];
}

export interface PendingChatClarification {
  field: 'school' | 'country' | 'level' | 'intake' | 'intakeYearRange' | 'aggregator' | 'guidance' | 'scope' | 'intent' | 'ranking' | 'payout';
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

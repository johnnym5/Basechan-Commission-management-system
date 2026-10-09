import type { AgentChatProfile, ChatConversation, ChatMessage, ChatPromptSuggestion, ChatSearchIntent, CommissionRate, FavoriteSchool, PendingChatClarification, StudyLevel, UserRole } from '../types';
import type { ChatFilterPrompt } from '../types/chat';
import { buildClarifyingQuestions, filterRatesByIntent, getDefaultIntake, getIntakeDateKey, getIntakeStartYear, MAX_COMPARISON_SCHOOLS, parseChatIntent, sanitizeChatInput } from './chatQuery';
import { MAX_QUERIES_PER_MINUTE, MAX_QUERIES_PER_SESSION, PREFERENCE_LEARNING_THRESHOLD } from './chatPersistence';

export interface AvailableChatFacets {
  intakes: string[];
  intakeYears: number[];
  aggregators: string[];
  levels: StudyLevel[];
  guidances: Array<'FOCUS' | 'ALLOWED' | 'DO_NOT_USE'>;
}

export function getAvailableChatFacets(results: CommissionRate[], role: UserRole): AvailableChatFacets {
  const distinct = <T,>(values: T[]) => Array.from(new Set(values));
  return {
    intakes: distinct(results.map((rate) => rate.intake).filter(Boolean)),
    intakeYears: distinct(results.map((rate) => getIntakeStartYear(rate.intake)).filter((year): year is number => year !== null)).sort((a, b) => a - b),
    aggregators: role === 'AGENT' ? [] : distinct(results.map((rate) => rate.aggregator || '').filter(Boolean)),
    levels: distinct(results.map((rate) => rate.studyLevel).filter((level): level is StudyLevel => level !== 'ALL')),
    guidances: distinct(results.map((rate) => rate.guidance || 'ALLOWED')),
  };
}

export function buildNextFilterPrompt(results: CommissionRate[], role: UserRole, intent: ChatSearchIntent): ChatFilterPrompt | undefined {
  if (!results.length) return undefined;
  const facets = getAvailableChatFacets(results, role);
  if (!intent.intake && !intent.intakeYearRange) {
    if (facets.intakeYears.length > 1) return {
      field: 'intakeYearRange',
      question: 'Would you like to narrow these results by intake year?',
      choices: facets.intakeYears.slice(0, 8).map((year) => ({ label: String(year), value: `from ${year} to ${year}` })),
    };
    if (facets.intakes.length > 1) return {
      field: 'intake',
      question: 'Would you like to narrow these results to a specific intake?',
      choices: facets.intakes.slice(0, 8).map((intake) => ({ label: intake, value: intake })),
    };
  }
  if (role !== 'AGENT' && !intent.aggregatorTerms?.length && facets.aggregators.length > 1) return {
    field: 'aggregator',
    question: 'Would you like to narrow these results by aggregator?',
    choices: facets.aggregators.slice(0, 8).map((aggregator) => ({ label: aggregator, value: aggregator })),
  };
  if (!intent.level && facets.levels.length > 1) return {
    field: 'level',
    question: 'Would you like to narrow these results by study level?',
    choices: facets.levels.slice(0, 8).map((level) => ({
      label: level === 'FD' ? 'Foundation' : level === 'UG' ? 'Undergraduate' : level === 'PG' ? 'Postgraduate' : level,
      value: level === 'FD' ? 'Foundation' : level === 'UG' ? 'Undergraduate' : level === 'PG' ? 'Postgraduate' : level,
    })),
  };
  if (!(intent.guidances?.length || intent.guidance) && facets.guidances.length > 1) return {
    field: 'guidance',
    question: 'Would you like to narrow these results by guidance status?',
    choices: facets.guidances.map((guidance) => ({
      label: guidance === 'DO_NOT_USE' ? 'Restricted' : guidance === 'FOCUS' ? 'Focus' : 'Allowed',
      value: guidance === 'DO_NOT_USE' ? 'Restricted' : guidance,
    })),
  };
  return undefined;
}

export interface ChatSessionState {
  conversation: ChatConversation;
  queryTimestamps: number[];
  queryCount: number;
  profile: AgentChatProfile;
  favorites: FavoriteSchool[];
}

export interface ChatTurnResult {
  state: ChatSessionState;
  matchingRates: CommissionRate[];
  clarificationQuestions: string[];
}

export function buildContextualSuggestions(state: ChatSessionState, rates: CommissionRate[], role: UserRole): ChatPromptSuggestion[] {
  const suggestions: ChatPromptSuggestion[] = [];
  const intent = state.conversation.searchIntent;
  const lastResultSchoolIds = state.conversation.lastResultSchoolIds || [];
  const lastResultSchools = Array.from(new Set(lastResultSchoolIds.map((id) => rates.find((rate) => rate.universityId === id)?.universityName).filter((name): name is string => Boolean(name))));
  if (lastResultSchools.length >= 2) {
    const comparisonSchools = lastResultSchools.slice(0, 4);
    suggestions.push({ label: `Compare ${comparisonSchools.length} results`, prompt: `Compare ${comparisonSchools.join(' and ')}` });
  }
  if (intent?.quantity === 'schools' && intent.country) {
    suggestions.push({ label: 'Count routes instead', prompt: `How many routes are in ${intent.country}?` });
    suggestions.push({ label: `Show schools in ${intent.country}`, prompt: `Show schools in ${intent.country}` });
    if (!intent.level) suggestions.push({ label: `Undergraduate in ${intent.country}`, prompt: `Show undergraduate schools in ${intent.country}` });
  }
  if (intent?.country && intent.level) {
    suggestions.push({ label: `All levels in ${intent.country}`, prompt: `Show schools in ${intent.country}` });
  }
  if (intent?.country && intent.guidance) {
    suggestions.push({ label: `All guidance in ${intent.country}`, prompt: `Show schools in ${intent.country}` });
  }
  const schoolId = intent?.schoolIds[0] || Object.entries(state.profile.frequentSchoolIds).sort((a, b) => b[1] - a[1])[0]?.[0];
  const school = rates.find((rate) => rate.universityId === schoolId)?.universityName;
  if (school) {
    suggestions.push({ label: `More routes for ${school}`, prompt: `Show me all available routes for ${school}` });
    if (role !== 'STAFF') suggestions.push({ label: `Payout for ${school}`, prompt: `How much do they pay for ${school}?` });
    if (role !== 'AGENT') {
      const aggregator = rates.find((rate) => rate.universityId === schoolId && rate.aggregator)?.aggregator;
      if (aggregator) suggestions.push({ label: `Routes by ${aggregator}`, prompt: `Show routes by ${aggregator}` });
    }
  }
  const country = intent?.country || Object.entries(state.profile.frequentCountryTerms || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (country && !intent?.level) suggestions.push({ label: `Undergraduate in ${country}`, prompt: `Show undergraduate schools in ${country}` });
  const level = intent?.level || Object.entries(state.profile.preferredLevels).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (level && intent?.country) suggestions.push({ label: `Focus schools · ${intent.country}`, prompt: `Show Focus schools in ${intent.country} for ${level === 'PG' ? 'Postgraduate' : level === 'UG' ? 'Undergraduate' : 'Foundation'}` });
  if (!suggestions.length) {
    suggestions.push({ label: 'Show Focus schools', prompt: 'Show me Focus schools' });
    suggestions.push({ label: 'Compare schools', prompt: 'Compare two schools' });
  }
  if (role === 'STAFF') {
    return suggestions.filter((suggestion) => !/payout|commission amount/i.test(suggestion.prompt)).slice(0, 3);
  }
  return Array.from(new Map(suggestions.map((suggestion) => [suggestion.prompt.toLocaleLowerCase(), suggestion])).values()).slice(0, 3);
}

function clarificationFor(intent: ReturnType<typeof parseChatIntent>, questionText: string, rates: CommissionRate[], role: UserRole): PendingChatClarification | undefined {
  if (intent.suggestedAggregators.length && role !== 'AGENT') return { field: 'aggregator', prompt: questionText, choices: intent.suggestedAggregators.map((aggregator) => ({ label: aggregator, value: aggregator })) };
  if (intent.intakeSuggestions.length) return { field: 'intake', prompt: questionText, choices: intent.intakeSuggestions.map((intake) => ({ label: intake, value: intake })) };
  if (intent.invalidIntakeYearRange) {
    const years = Array.from(new Set(rates.map((rate) => getIntakeStartYear(rate.intake)).filter((year): year is number => year !== null)));
    return { field: 'intakeYearRange', prompt: questionText, choices: years.map((year) => ({ label: String(year), value: `from ${year} to ${year}` })) };
  }
  if (intent.outOfScope) return { field: 'intent', prompt: questionText, choices: [
    { label: 'Show Focus schools', value: 'Show me Focus schools' },
    { label: 'Show all available schools', value: 'Show all available schools' },
    { label: 'Compare two schools', value: 'Compare two schools' },
  ] };
  if (intent.quantity === 'schools' && intent.countryTerms.length > 0 && !intent.level && !intent.intakeTerms.length && !intent.scopeSelection) {
    return { field: 'scope', prompt: questionText, choices: [
      { label: 'All available intakes and levels', value: 'all available intakes and levels' },
      { label: 'Choose an intake', value: 'choose a specific intake' },
      { label: 'Choose a study level', value: 'choose a specific study level' },
    ] };
  }
  if (intent.quantity === 'schools' && intent.scopeSelection === 'intake' && !intent.intakeTerms.length) {
    const intakes = Array.from(new Set(rates.filter((rate) => intent.countryTerms.some((country) => (rate.country || '').toLowerCase() === country.toLowerCase())).map((rate) => rate.intake)));
    return { field: 'intake', prompt: questionText, choices: intakes.map((intake) => ({ label: intake, value: intake })) };
  }
  if (intent.quantity === 'schools' && intent.scopeSelection === 'level' && !intent.level) {
    return { field: 'level', prompt: questionText, choices: [
      { label: 'Foundation', value: 'Foundation' }, { label: 'Undergraduate', value: 'Undergraduate' }, { label: 'Postgraduate', value: 'Postgraduate' },
    ] };
  }
  if (intent.rankingUnclear || intent.unsupportedMetric) {
    const countries = Array.from(new Set(rates.map((rate) => rate.country).filter((value): value is string => Boolean(value)))).slice(0, 3);
    const choices = [
      { label: 'Focus schools', value: 'Show me Focus schools' },
      ...(role !== 'STAFF' ? [{ label: 'Highest available payout', value: 'Show the highest payout routes' }] : []),
      ...countries.map((country) => ({ label: `Schools in ${country}`, value: `Show schools in ${country}` })),
    ];
    return { field: intent.unsupportedMetric ? 'intent' : 'ranking', prompt: questionText, choices };
  }
  if (intent.needsLevel) return { field: 'level', prompt: questionText, choices: [
    { label: 'Foundation', value: 'Foundation' }, { label: 'Undergraduate', value: 'Undergraduate' }, { label: 'Postgraduate', value: 'Postgraduate' },
  ] };
  if (intent.suggestedSchools.length) return { field: 'school', prompt: questionText, choices: intent.suggestedSchools.slice(0, 4).map((school) => ({ label: school, value: rates.find((rate) => rate.universityName.toLowerCase() === school.toLowerCase())?.universityId || school })) };
  if (intent.ambiguousSchools.length) return { field: 'school', prompt: questionText, choices: intent.ambiguousSchools.slice(0, 4).map((school) => ({ label: school, value: rates.find((rate) => rate.universityName.toLowerCase() === school.toLowerCase())?.universityId || school })) };
  if (intent.compare && /same .*intake|study level and intake/i.test(questionText)) {
    const schoolIntakes = intent.schoolTerms.map((school) => new Set(rates.filter((rate) => rate.universityName.toLowerCase() === school.toLowerCase() && (!intent.level || rate.studyLevel === intent.level || rate.studyLevel === 'ALL')).map((rate) => rate.intake)));
    const commonIntakes = Array.from(schoolIntakes[0] || []).filter((intake) => schoolIntakes.every((intakes) => intakes.has(intake))).slice(0, 5);
    if (commonIntakes.length) return { field: 'intake', prompt: questionText, choices: commonIntakes.map((intake) => ({ label: intake, value: intake })) };
  }
  if (intent.compare && intent.schoolTerms.length < 2) {
    const candidates = Array.from(new Map(rates.map((rate) => [rate.universityId, rate.universityName])).entries()).slice(0, 4);
    return { field: 'school', prompt: questionText, choices: candidates.map(([id, name]) => ({ label: name, value: id })) };
  }
  if (intent.needsSchool) return { field: 'school', prompt: questionText, choices: [] };
  return undefined;
}

function toStoredIntent(intent: ReturnType<typeof parseChatIntent>, rates: CommissionRate[]): ChatSearchIntent {
  const schoolIds = Array.from(new Set(intent.schoolTerms.flatMap((school) => rates.filter((rate) => rate.universityName.toLowerCase() === school.toLowerCase()).map((rate) => rate.universityId))));
  const ukLabels = new Set(['united kingdom', 'uk', 'u.k.', 'britain', 'great britain', 'england', 'scotland', 'wales', 'northern ireland']);
  const country = intent.countryTerms.length > 1 && intent.countryTerms.every((value) => ukLabels.has(value.toLowerCase())) ? 'UK' : intent.countryTerms[0];
  return {
    schoolIds,
    ...(country ? { country } : {}),
    ...(intent.countryTerms.length ? { countryTerms: intent.countryTerms } : {}),
    ...(intent.level ? { level: intent.level } : {}),
    ...(intent.intakeTerms[0] ? { intake: intent.intakeTerms[0] } : {}),
    ...(intent.intakeYearRange ? { intakeYearRange: intent.intakeYearRange } : {}),
    ...(intent.guidance ? { guidance: intent.guidance } : {}),
    ...(intent.guidances?.length ? { guidances: intent.guidances } : {}),
    ...(intent.intakeOrder ? { intakeOrder: intent.intakeOrder } : {}),
    ...(intent.quantity ? { quantity: intent.quantity } : {}),
    ...(intent.scopeSelection ? { scopeSelection: intent.scopeSelection } : {}),
    aggregatorTerms: intent.aggregatorTerms,
    ...(intent.rateMinimum !== undefined ? { rateMinimum: intent.rateMinimum } : {}),
    ...(intent.rateMaximum !== undefined ? { rateMaximum: intent.rateMaximum } : {}),
    ...(intent.feeType ? { feeType: intent.feeType } : {}),
    ...(intent.sortBy ? { sortBy: intent.sortBy } : {}),
    compare: intent.compare,
    compareSchoolIds: intent.compare ? schoolIds.slice(0, MAX_COMPARISON_SCHOOLS) : [],
  };
}

const nowIso = () => new Date().toISOString();
const createMessage = (role: ChatMessage['role'], text: string, status: ChatMessage['status'], resultIds?: string[], resultRates?: CommissionRate[], userRole: UserRole = 'AGENT'): ChatMessage => ({
  id: crypto.randomUUID(), role, text, createdAt: nowIso(), status, ...(resultIds ? { resultIds } : {}),
  ...(resultRates ? { resultRates: resultRates.map((rate) => ({
    id: rate.id, universityId: rate.universityId, universityName: rate.universityName,
    ...(rate.country ? { country: rate.country } : {}), intake: rate.intake, studyLevel: rate.studyLevel,
    ...(userRole !== 'AGENT' && rate.aggregator ? { aggregator: rate.aggregator } : {}),
    ...(userRole !== 'STAFF' && typeof rate.agentRate === 'number' ? { agentRate: rate.agentRate } : {}), ...(rate.isFlatFee ? { isFlatFee: true } : {}),
    guidance: rate.guidance || 'ALLOWED', ...(rate.notes ? { notes: rate.notes } : {}),
  })) } : {}),
});

export function isGreetingInput(input: string): boolean {
  return /^(?:hi|hello|hey|hiya|howdy|good\s+(?:morning|afternoon|evening)|how\s+are\s+you)(?:\s+there)?[!.?,\s]*$/i.test(input.trim());
}

export function processGreeting(state: ChatSessionState, rawInput: string, now = new Date()): ChatSessionState {
  const input = sanitizeChatInput(rawInput);
  if (!isGreetingInput(input)) throw new Error('This message is not a greeting.');
  const hour = now.getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const day = now.toLocaleDateString(undefined, { weekday: 'long' });
  const greetings = [
    `Good ${timeOfDay}, and happy ${day}. What can I help you find today? I can search schools, compare routes, and check intakes or agent rates.`,
    `Hello! Hope your ${day} is going well. What would you like help with? I can find schools, compare routes, or look up intakes and rates.`,
    `Good ${timeOfDay}! What are you looking for today? I can help you find a school, compare options, or check available routes and rates.`,
  ];
  const dayIndex = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  const reply = greetings[dayIndex % greetings.length];
  const userMessage = createMessage('user', input, 'sent');
  const assistantMessage = createMessage('assistant', reply, 'sent');
  const updatedAt = now.toISOString();
  return {
    ...state,
    conversation: {
      ...state.conversation,
      title: state.conversation.messages.length === 0 ? 'Greeting' : state.conversation.title,
      updatedAt,
      messages: [...state.conversation.messages, userMessage, assistantMessage],
    },
  };
}

export function createInitialChatState(uid: string): ChatSessionState {
  const timestamp = nowIso();
  return {
    conversation: { id: crypto.randomUUID(), title: 'New chat', createdAt: timestamp, updatedAt: timestamp, messages: [], queryCount: 0 },
    queryTimestamps: [],
    queryCount: 0,
    profile: { uid, queryCount: 0, preferredLevels: {}, preferredGuidance: {}, frequentSchoolIds: {}, frequentCountryTerms: {}, frequentIntakeTerms: {}, suggestionTerms: [], updatedAt: timestamp },
    favorites: [],
  };
}

export function processChatTurn(
  state: ChatSessionState,
  rawInput: string,
  rates: CommissionRate[],
  now = Date.now(),
  role: UserRole = 'AGENT',
): ChatTurnResult {
  const submittedValue = sanitizeChatInput(rawInput);
  const pendingClarification = state.conversation.pendingClarification;
  const selectedChoice = pendingClarification?.choices.find((choice) => choice.value.toLowerCase() === submittedValue.toLowerCase() || choice.label.toLowerCase() === submittedValue.toLowerCase());
  const input = pendingClarification?.field === 'school' && selectedChoice ? selectedChoice.label : submittedValue;
  if (!input) throw new Error('Enter a school or a question to search.');
  if (rawInput.length > 500) throw new Error('Messages must be 500 characters or fewer.');
  const conversationQueryCount = state.conversation.queryCount ?? state.queryCount;
  if (conversationQueryCount >= MAX_QUERIES_PER_SESSION) throw new Error('This chat has reached its 50 question limit. Start a new chat to continue.');
  const recentQueries = state.queryTimestamps.filter((timestamp) => now - timestamp < 60_000);
  if (recentQueries.length >= MAX_QUERIES_PER_MINUTE) throw new Error('You have reached the 10 questions per minute limit. Wait a moment and try again.');

  const schoolNames = Array.from(new Set(rates.map((rate) => rate.universityName)));
  const countryNames = Array.from(new Set(rates.map((rate) => rate.country || '').filter(Boolean)));
  const aggregatorNames = Array.from(new Set(rates.map((rate) => rate.aggregator || '').filter(Boolean)));
  const intakeNames = Array.from(new Set(rates.map((rate) => rate.intake).filter(Boolean)));
  const submittedIntent = parseChatIntent(input, schoolNames, countryNames, aggregatorNames, role, intakeNames);
  const compareAllPrevious = /\bcompare\s+(?:all\s+)?(?:4|four)\b/i.test(input);
  const priorSchoolIds = compareAllPrevious && state.conversation.lastResultSchoolIds?.length
    ? state.conversation.lastResultSchoolIds
    : state.conversation.activeSchoolIds || [];
  const contextNames = priorSchoolIds.map((id) => rates.find((rate) => rate.universityId === id)?.universityName).filter((name): name is string => Boolean(name));
  const lastAssistantMessage = state.conversation.messages.at(-1);
  const isPendingChoice = Boolean(selectedChoice);
  const waitingForLevel = pendingClarification?.field === 'level' || (lastAssistantMessage?.role === 'assistant' && lastAssistantMessage.status === 'clarifying' && /which study level/i.test(lastAssistantMessage.text));
  const isFilterFollowup = /\b(what about|this|that|these|those|it|same|also|instead|next|another)\b|\ball available (?:intakes? and (?:study )?levels?|routes?)\b|\bchoose (?:(?:a|an) )?(?:specific )?(?:intake|(?:study )?level)\b/i.test(input);
  const inputWords = new Set(input.toLowerCase().match(/[a-z0-9]+/g) || []);
  const genericSchoolWords = new Set(['university', 'universities', 'school', 'schools', 'college', 'colleges', 'institute', 'institutes', 'international', 'group', 'campus', 'center', 'centre']);
  const inputNamesSchool = schoolNames.some((school) => input.toLowerCase().includes(school.toLowerCase())
    || school.toLowerCase().split(/\s+/).some((word) => word.length >= 5 && !genericSchoolWords.has(word) && inputWords.has(word)));
  const countryAliases = ['united kingdom', 'uk', 'u.k.', 'britain', 'great britain', 'england', 'scotland', 'wales', 'northern ireland'];
  const inputNamesCountry = countryNames.some((country) => input.toLowerCase().includes(country.toLowerCase()))
    || countryAliases.some((country) => new RegExp(`(^|[^a-z0-9])${country.replace('.', '\\.').replace(/\s+/g, '\\s+')}(?=$|[^a-z0-9])`, 'i').test(input));
  const explicitlyKeepsScope = /\b(same|also|include|keep|continue)\b/i.test(input);
  const isFreshEntitySearch = !isPendingChoice && (inputNamesSchool || inputNamesCountry) && !explicitlyKeepsScope;
  const typedFilterOnly = Boolean(state.conversation.searchIntent && !inputNamesSchool && !inputNamesCountry && (
    submittedIntent.level || submittedIntent.intakeTerms.length || submittedIntent.intakeYearRange || submittedIntent.intakeSuggestions.length
    || submittedIntent.aggregatorTerms.length || submittedIntent.suggestedAggregators.length || submittedIntent.guidances?.length
  ));
  const compareUsesPreviousSchool = /\b(compare|with|versus|vs)\b.{0,32}\b(this|that|these|those|it)\b|\b(this|that|these|those|it)\b.{0,32}\b(compare|with|versus|vs)\b/i.test(input);
  const refersToPreviousSchools = !isFreshEntitySearch && (waitingForLevel || compareAllPrevious || (isFilterFollowup && !inputNamesSchool) || compareUsesPreviousSchool);
  const carriesPreviousFilters = !isFreshEntitySearch && (compareAllPrevious || isPendingChoice || isFilterFollowup || typedFilterOnly);
  const contextParts = [ ...(refersToPreviousSchools ? contextNames : []) ];
  const previousIntent = state.conversation.searchIntent;
  if (carriesPreviousFilters && previousIntent) {
    if ((pendingClarification?.field !== 'school' && !inputNamesSchool) || previousIntent.compare || compareUsesPreviousSchool) contextParts.push(...previousIntent.schoolIds.flatMap((id) => rates.filter((rate) => rate.universityId === id).map((rate) => rate.universityName)));
    if (pendingClarification?.field !== 'country' && !inputNamesCountry && previousIntent.country) contextParts.push(previousIntent.country);
    if (previousIntent.countryTerms?.length && !inputNamesCountry) contextParts.push(...previousIntent.countryTerms);
    if (pendingClarification?.field !== 'level' && !submittedIntent.level && previousIntent.level) contextParts.push(previousIntent.level === 'PG' ? 'postgraduate' : previousIntent.level === 'UG' ? 'undergraduate' : 'foundation');
    if (pendingClarification?.field !== 'intake' && !submittedIntent.intakeTerms.length && previousIntent.intake) contextParts.push(previousIntent.intake);
    if (!submittedIntent.intakeYearRange && previousIntent.intakeYearRange) contextParts.push(`from ${previousIntent.intakeYearRange.startYear} to ${previousIntent.intakeYearRange.endYear}`);
    if (!submittedIntent.aggregatorTerms.length && !submittedIntent.suggestedAggregators.length) contextParts.push(...(previousIntent.aggregatorTerms || []));
    if (previousIntent.quantity) contextParts.push(previousIntent.quantity === 'schools' ? 'how many schools' : 'how many routes');
    if (pendingClarification?.field !== 'scope' && previousIntent.scopeSelection) {
      contextParts.push(previousIntent.scopeSelection === 'all' ? 'all available intakes and levels' : previousIntent.scopeSelection === 'intake' ? 'choose a specific intake' : 'choose a specific study level');
    }
    if (pendingClarification?.field !== 'intent' && !submittedIntent.guidances?.length) contextParts.push(...(previousIntent.guidances || (previousIntent.guidance ? [previousIntent.guidance] : [])).map((value) => value === 'DO_NOT_USE' ? 'restricted' : value));
    if (previousIntent.compare) contextParts.push('compare');
  }
  const previousLevel = state.conversation.activeLevel;
  const inputHasLevel = /\b(post\s*grad|postgraduate|master'?s|msc|phd|doctoral|under\s*grad|undergraduate|bachelor'?s|bsc|foundation|fd)\b/i.test(input);
  if (carriesPreviousFilters && pendingClarification?.field !== 'scope' && !inputHasLevel && previousLevel) {
    contextParts.push(previousLevel === 'PG' ? 'postgraduate' : previousLevel === 'UG' ? 'undergraduate' : 'foundation');
  }
  const containsDatedIntake = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|spring|summer|fall|autumn|winter)\s*(?:[-/]\s*)?20\d{2}\b/i.test(input) || submittedIntent.intakeSuggestions.length > 0;
  if (carriesPreviousFilters && pendingClarification?.field !== 'scope' && !containsDatedIntake && state.conversation.activeIntake) contextParts.push(state.conversation.activeIntake);
  const expandedInput = `${input} ${Array.from(new Set(contextParts)).join(' ')}`.trim();
  const intent = parseChatIntent(expandedInput, schoolNames, countryNames, aggregatorNames, role, intakeNames);
  if (pendingClarification?.field === 'intake' && rates.some((rate) => rate.intake.toLowerCase() === input.toLowerCase())) {
    intent.intakeTerms = [rates.find((rate) => rate.intake.toLowerCase() === input.toLowerCase())!.intake];
  }
  const unresolvedReference = /\b(?:this and that|that and this|do this and that)\b/i.test(input) && !previousIntent && contextNames.length === 0;
  const questions = unresolvedReference
    ? ['What should “this and that” refer to: Focus, Allowed, Restricted, an intake, or another filter?']
    : buildClarifyingQuestions(intent);
  if (intent.compare && intent.schoolTerms.length < 2 && contextNames.length) questions.push(`Which other school should I compare with ${contextNames[0]}?`);
  const nextProfile = { ...state.profile, queryCount: state.profile.queryCount + 1, updatedAt: new Date(now).toISOString() };
  if (intent.level) nextProfile.preferredLevels[intent.level] = (nextProfile.preferredLevels[intent.level] || 0) + 1;
  for (const country of intent.countryTerms) nextProfile.frequentCountryTerms = { ...nextProfile.frequentCountryTerms, [country]: ((nextProfile.frequentCountryTerms || {})[country] || 0) + 1 };
  for (const intake of intent.intakeTerms) nextProfile.frequentIntakeTerms = { ...nextProfile.frequentIntakeTerms, [intake]: ((nextProfile.frequentIntakeTerms || {})[intake] || 0) + 1 };
  for (const guidance of intent.guidances || (intent.guidance ? [intent.guidance] : [])) nextProfile.preferredGuidance[guidance] = (nextProfile.preferredGuidance[guidance] || 0) + 1;
  for (const school of intent.schoolTerms) {
    const id = rates.find((rate) => rate.universityName === school)?.universityId;
    if (id) nextProfile.frequentSchoolIds[id] = (nextProfile.frequentSchoolIds[id] || 0) + 1;
  }
  if (nextProfile.queryCount >= PREFERENCE_LEARNING_THRESHOLD) {
    const suggestions: string[] = [];
    const favoriteLevel = Object.entries(nextProfile.preferredLevels).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (favoriteLevel) suggestions.push(`Your usual level is ${favoriteLevel}; use it as a quick filter.`);
    const favoriteSchoolId = Object.entries(nextProfile.frequentSchoolIds).sort((a, b) => b[1] - a[1])[0]?.[0];
    const favoriteSchool = rates.find((rate) => rate.universityId === favoriteSchoolId)?.universityName;
    if (favoriteSchool) suggestions.push(`You often check ${favoriteSchool}; search it with a new intake.`);
    const favoriteCountry = Object.entries(nextProfile.frequentCountryTerms || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (favoriteCountry) suggestions.push(`You often look at schools in ${favoriteCountry}; try asking for that country with another level.`);
    const favoriteIntake = Object.entries(nextProfile.frequentIntakeTerms || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (favoriteIntake) suggestions.push(`You frequently search ${favoriteIntake}; you can ask for the next available intake when it changes.`);
    nextProfile.suggestionTerms = Array.from(new Set([...nextProfile.suggestionTerms, ...suggestions])).slice(-12);
  }

  let intentResults = questions.length ? [] : filterRatesByIntent(rates, intent);
  let rankedIntake: string | undefined;
  let hadIntakeCandidates = false;
  if (intent.intakeOrder && !questions.length) {
    const dated = intentResults.map((rate) => ({ rate, key: getIntakeDateKey(rate.intake) })).filter((item): item is { rate: CommissionRate; key: number } => item.key !== null);
    hadIntakeCandidates = dated.length > 0;
    if (dated.length) {
      const extremeKey = intent.intakeOrder === 'latest' ? Math.max(...dated.map((item) => item.key)) : Math.min(...dated.map((item) => item.key));
      const matchingIntakes = new Set(dated.filter((item) => item.key === extremeKey).map((item) => item.rate.intake));
      rankedIntake = Array.from(matchingIntakes).sort()[0];
      intentResults = dated.filter((item) => item.key === extremeKey).map((item) => item.rate);
    } else intentResults = [];
  }
  const broadScope = intent.broadSearch || intent.intakeOrder !== undefined || (intent.countryTerms.length > 0 && intent.schoolTerms.length === 0);
  const defaultIntake = intent.intakeTerms[0] || (!broadScope ? getDefaultIntake(intentResults, new Date(now)) : undefined);
  if (!intent.intakeTerms.length && defaultIntake) {
    intentResults = intentResults.filter((rate) => rate.intake === defaultIntake);
  }
  const results = intent.sortBy === 'rate_desc'
    ? [...intentResults].sort((left, right) => (right.agentRate || 0) - (left.agentRate || 0))
    : intent.sortBy === 'rate_asc'
      ? [...intentResults].sort((left, right) => (left.agentRate || 0) - (right.agentRate || 0))
      : intentResults;
  const comparisonTargets = intent.compare && intent.schoolTerms.length > 1 ? intent.schoolTerms : [];
  const sharedComparisonCandidates = comparisonTargets.length
    ? filterRatesByIntent(rates, { ...intent, schoolTerms: comparisonTargets, needsSchool: false })
    : [];
  const selectedComparisonIntake = intent.intakeTerms[0] || getDefaultIntake(sharedComparisonCandidates, new Date(now));
  const comparisonRates = selectedComparisonIntake
    ? comparisonTargets.map((school) => sharedComparisonCandidates.find((rate) => rate.universityName.toLowerCase() === school.toLowerCase() && rate.intake === selectedComparisonIntake && rate.studyLevel === intent.level)
      || sharedComparisonCandidates.find((rate) => rate.universityName.toLowerCase() === school.toLowerCase() && rate.intake === selectedComparisonIntake && rate.studyLevel === 'ALL')).filter((rate): rate is CommissionRate => Boolean(rate))
    : [];
  if (intent.compare && comparisonTargets.length > 1 && comparisonRates.length !== comparisonTargets.length && !questions.length) {
    questions.push(`I could not find all selected schools at the same ${intent.level ? 'intake' : 'study level and intake'}. Which ${intent.level ? 'intake' : 'study level and intake'} should I compare?`);
  }
  const quantityCount = intent.quantity === 'schools'
    ? new Set(results.map((rate) => rate.universityId)).size
    : results.length;
  const quantityLabel = intent.quantity === 'schools'
    ? quantityCount === 1 ? 'school' : 'schools'
    : quantityCount === 1 ? 'route' : 'routes';
  const quantityScope = intent.countryTerms[0] ? ` in your available ${intent.countryTerms[0]} data` : ' matching your search in available data';
  const ukLabels = new Set(['united kingdom', 'uk', 'u.k.', 'britain', 'great britain', 'england', 'scotland', 'wales', 'northern ireland']);
  const countryDisplay = intent.countryTerms.length > 1 && intent.countryTerms.every((value) => ukLabels.has(value.toLowerCase())) ? 'UK' : intent.countryTerms[0];
  const guidanceLabel = (intent.guidances || (intent.guidance ? [intent.guidance] : [])).map((value) => value === 'DO_NOT_USE' ? 'Restricted' : value === 'FOCUS' ? 'Focus' : 'Allowed').join(' or ');
  const matchedSchools = Array.from(new Set(results.map((rate) => rate.universityName)));
  const schoolPreview = matchedSchools.slice(0, 10).join(', ');
  const extraSchoolCount = matchedSchools.length - Math.min(matchedSchools.length, 10);
  const assistantText = questions.length
    ? questions.join(' ')
      : intent.intakeOrder
        ? rankedIntake
          ? `The ${intent.intakeOrder} dated intake is ${rankedIntake}.`
          : hadIntakeCandidates ? 'I could not find a dated intake to compare.' : 'There are no matching routes with dated intakes to compare.'
      : intent.quantity
        ? quantityCount
          ? intent.quantity === 'schools'
            ? `There ${quantityCount === 1 ? 'is' : 'are'} ${quantityCount} ${quantityLabel} in your available${countryDisplay ? ` ${countryDisplay}` : ''} data${intent.intakeTerms[0] ? ` for ${intent.intakeTerms[0]}` : intent.intakeYearRange ? ` from ${intent.intakeYearRange.startYear} to ${intent.intakeYearRange.endYear}` : ' across all available intakes'}${intent.level ? ` at ${intent.level} level` : ' and all study levels'}${guidanceLabel ? ` with ${guidanceLabel} guidance` : ''}.`
            : `There ${quantityCount === 1 ? 'is' : 'are'} ${quantityCount} ${quantityLabel}${quantityScope}${guidanceLabel ? ` with ${guidanceLabel} guidance` : ''}.`
          : intent.quantity === 'schools'
            ? `No schools with matching routes were found in your available${countryDisplay ? ` ${countryDisplay}` : ''} data. Try another intake or level.`
            : `There are no ${quantityLabel}${quantityScope}. Try another country or filter.`
      : (intent.guidances?.length || intent.guidance)
        ? matchedSchools.length
          ? `${guidanceLabel} schools: ${schoolPreview}${extraSchoolCount > 0 ? `, and ${extraSchoolCount} more` : ''}.`
          : `No schools currently match ${guidanceLabel} guidance.`
      : results.length
      ? `I found ${results.length} matching ${results.length === 1 ? 'route' : 'routes'}${intent.level ? ` for ${intent.level}` : ''}${defaultIntake ? ` in ${defaultIntake}` : ' across available intakes'}.`
      : (() => {
        const filters = [
          ...intent.schoolTerms,
          ...intent.countryTerms,
          ...(intent.level ? [intent.level] : []),
          ...intent.intakeTerms,
          ...(intent.intakeYearRange ? [`${intent.intakeYearRange.startYear}-${intent.intakeYearRange.endYear}`] : []),
          ...(intent.guidance ? [intent.guidance === 'DO_NOT_USE' ? 'Restricted guidance' : `${intent.guidance} guidance`] : []),
          ...intent.aggregatorTerms,
        ];
        return filters.length
          ? `No local routes matched ${filters.join(', ')}. Try removing a filter or choosing another intake, level, or guidance option.`
          : 'I could not find a matching route. Try a different school name or intake.';
      })();
  const userMessage = createMessage('user', input, questions.length ? 'clarifying' : 'sent');
  const finalAssistantText = questions.length ? questions.join(' ') : assistantText;
  const finalResults = intent.compare && comparisonTargets.length > 1
    ? comparisonRates.length === comparisonTargets.length && !questions.length ? comparisonRates : []
    : results;
  const clarification = questions.length ? clarificationFor(intent, finalAssistantText, rates, role) : undefined;
  const followUpFilter = questions.length ? undefined : buildNextFilterPrompt(finalResults, role, toStoredIntent(intent, rates));
  const assistantMessage = {
    ...createMessage('assistant', finalAssistantText, questions.length ? 'clarifying' : 'results', finalResults.map((rate) => rate.id), finalResults, role),
    ...(clarification ? { clarification: { field: clarification.field, choices: clarification.choices } } : {}),
    ...(followUpFilter ? { followUpFilter } : {}),
  };
  const messages = [...state.conversation.messages, userMessage, assistantMessage];
  const conversation = {
    ...state.conversation,
    title: state.conversation.messages.length ? state.conversation.title : input.slice(0, 48),
    updatedAt: new Date(now).toISOString(),
    messages,
    queryCount: conversationQueryCount + 1,
    ...(intent.level ? { activeLevel: intent.level } : {}),
    ...(defaultIntake ? { activeIntake: defaultIntake } : {}),
    ...(intent.schoolTerms.length ? { activeSchoolIds: Array.from(new Set(intent.schoolTerms.flatMap((school) => rates.filter((rate) => rate.universityName.toLowerCase() === school.toLowerCase()).map((rate) => rate.universityId)))) } : {}),
    ...(finalResults.length ? { lastResultSchoolIds: Array.from(new Set(finalResults.map((rate) => rate.universityId))).slice(0, MAX_COMPARISON_SCHOOLS) } : {}),
    searchIntent: toStoredIntent(intent, rates),
    ...(clarification ? { pendingClarification: clarification } : followUpFilter ? {
      pendingClarification: { field: followUpFilter.field, prompt: followUpFilter.question, choices: followUpFilter.choices },
    } : { pendingClarification: undefined }),
  };
  return {
    state: { ...state, conversation, queryTimestamps: [...recentQueries, now], queryCount: state.queryCount + 1, profile: nextProfile },
    matchingRates: finalResults,
    clarificationQuestions: questions,
  };
}

# Progressive Chat Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users refine locally available school routes across chat turns by intake year/range, aggregator, level, and guidance, while keeping results, counts, and role permissions accurate.

**Architecture:** Extend the deterministic local query intent with validated year ranges and data-backed entity suggestions. Persist a structured active filter scope in the conversation, recalculate results locally after each message, and derive next filter prompts from distinct facets still present in those results. Make the route and school totals open the scoped results and return focus to the chat composer.

**Tech Stack:** TypeScript, React, Vitest, Testing Library, existing local chat parser/session and local rate data.

**Spec:** `docs/superpowers/specs/2026-10-09-progressive-chat-filtering-design.md`

## Global Constraints

- Use the local route set for natural-language filtering; do not add a network query.
- Preserve role access: Agents cannot query/reveal aggregators or routing; Staff cannot query/reveal payouts; Admin retains current access.
- Compute counts only from locally available, role-appropriate records and describe results as available data.
- Resolve aggregator and intake/year suggestions from accessible local records; never silently apply a guessed correction.
- Year range endpoints are inclusive and apply to the intake-cycle start year.
- Multiple aggregators are OR alternatives within the aggregator facet; different filter facets combine to narrow results.
- Keep the interaction in chat; do not add a separate filter panel or external school directory.

## Review Focus

- Reversed year ranges: ask for corrected bounds and do not return results. Test in Task 1.
- Intake labels without a parseable start year: exclude them from numeric year ranges and do not infer a year. Test in Task 1.
- A misspelled aggregator with zero, one, or multiple close local matches: offer safe choices or request correction without applying a guess. Test in Task 2.
- Several aggregators plus another facet, followed by typed refinement or a fresh unrelated search: aggregator values OR together, facets AND together, follow-up keeps scope, fresh search resets it. Test in Task 3.
- A role without aggregator access or a filter producing zero routes: hide inaccessible facets and stop the follow-up sequence on zero results. Test in Task 3.

---

### Task 1: Parse intake years and inclusive ranges

**Files:**
- Modify: `src/types/chat.ts`
- Modify: `src/services/chatQuery.ts`
- Test: `src/services/chatQuery.test.ts`

**Interfaces:**
- Adds `IntakeYearRange` to `src/types/chat.ts`: `{ startYear: number; endYear: number }`.
- Imports `IntakeYearRange` into `src/services/chatQuery.ts` for query parsing.
- Produces `getIntakeStartYear(intake: string): number | null` for labels such as `2021 - 2022`, `September 2021`, and `Autumn 2021`.
- Adds optional `intakeYearRange?: IntakeYearRange` and `invalidIntakeYearRange?: boolean` to `ChatIntent`.
- `filterRatesByIntent(rates, intent)` applies a year range by the parsed intake-cycle start year, with inclusive bounds.

- [ ] **Step 1: Write failing range parser tests**

Add `parses inclusive intake year ranges in common wording` asserting `from 2021 to 2025`, `between 2021 and 2025`, and `2021-2025` all produce `{ startYear: 2021, endYear: 2025 }`.

Add `uses the intake cycle start year for range filtering` asserting `2021 - 2022`, `September 2021`, and `Autumn 2021` match the range while `2020 - 2021` and `Current intake` do not.

Add `flags reversed intake year ranges for clarification` asserting `from 2025 to 2021` marks `invalidIntakeYearRange` and generates a correction question.

- [ ] **Step 2: Run the parser tests and confirm the expected failures**

Run: `npm test -- --run src/services/chatQuery.test.ts`
Expected: the new range parsing, filter, and reversed-bound assertions fail because the intent has no year-range fields or parser.

- [ ] **Step 3: Implement intake-year parsing and filtering**

Implement `getIntakeStartYear(intake: string): number | null`, parse an inclusive range from the three specified phrasings, retain reversed bounds as invalid intent for clarification, and filter only labels with a recognized start year.

- [ ] **Step 4: Run query tests**

Run: `npm test -- --run src/services/chatQuery.test.ts`
Expected: all tests in `chatQuery.test.ts` pass, including the new year-range cases.

- [ ] **Step 5: Commit the year-range parser**

```bash
git add src/services/chatQuery.ts src/services/chatQuery.test.ts
git add src/types/chat.ts
git commit -m "feat: parse intake year ranges"
```

### Task 2: Resolve intake and aggregator names from local data

**Files:**
- Modify: `src/services/chatVocabulary.ts`
- Modify: `src/services/chatQuery.ts`
- Test: `src/services/chatVocabulary.test.ts`
- Test: `src/services/chatQuery.test.ts`

**Interfaces:**
- Extends the signature to `parseChatIntent(input: string, knownSchools: string[], knownCountries?: string[], knownAggregators?: string[], role?: UserRole, knownIntakes?: string[])`; existing call sites remain compatible.
- Uses the existing `aggregatorTerms: string[]` field for canonical matched names and adds `suggestedAggregators: string[]` as unconfirmed candidates to `ChatIntent`.
- Adds `intakeSuggestions: string[]` as unconfirmed locally available intake candidates to `ChatIntent`.
- Exact supported aggregator/intake names take precedence over fuzzy candidates. Fuzzy candidates are suggestions only; session handling in Task 3 requires confirmation before applying.

- [ ] **Step 1: Write failing vocabulary and entity-match tests**

Add vocabulary tests for common intake/aggregator spelling and punctuation variants, including `intack` and `SI UK` normalization where safe.

Add query tests named `matches multiple known aggregators as canonical alternatives`, `suggests but does not apply a single misspelled aggregator`, `asks the user to choose when an aggregator typo has multiple candidates`, and `suggests a known intake when the typed intake is misspelled`.

Assert exact matched names populate `aggregatorTerms`; likely corrections populate suggestion arrays and leave the corresponding filter unapplied.

- [ ] **Step 2: Run the vocabulary and query tests and confirm the expected failures**

Run: `npm test -- --run src/services/chatVocabulary.test.ts src/services/chatQuery.test.ts`
Expected: the new dynamic aggregator/intake matching and typo-candidate assertions fail.

- [ ] **Step 3: Implement local data-backed entity matching**

Normalize names to lowercase alphanumeric text for exact aggregator matching; resolve all exact names in one request. For a non-exact name, compare against only the supplied accessible local aggregator/intake names using edit distance (maximum 1 edit below 7 characters, maximum 2 edits at 7 or more characters); return equally close best candidates, capped at four, without selecting them. Preserve the role rule that Agents do not receive aggregator matches or suggestions.

- [ ] **Step 4: Run the vocabulary and query tests**

Run: `npm test -- --run src/services/chatVocabulary.test.ts src/services/chatQuery.test.ts`
Expected: all tests in both files pass, and exact matches remain preferred over fuzzy suggestions.

- [ ] **Step 5: Commit the entity matcher**

```bash
git add src/services/chatVocabulary.ts src/services/chatVocabulary.test.ts src/services/chatQuery.ts src/services/chatQuery.test.ts
git commit -m "feat: match local intake and aggregator names"
```

### Task 3: Preserve filters and offer available next facets

**Files:**
- Modify: `src/types/chat.ts`
- Modify: `src/services/chatSession.ts`
- Test: `src/services/chatSession.test.ts`

**Interfaces:**
- Adds `ChatFilterPrompt` in `src/types/chat.ts` with `field: 'intake' | 'intakeYearRange' | 'aggregator' | 'level' | 'guidance'`, `question: string`, and `choices: Array<{ label: string; value: string }>`.
- Adds optional `followUpFilter?: ChatFilterPrompt` to `ChatMessage`; the same canonical choice values populate `PendingChatClarification` so a selected choice continues the current scope.
- Extends `ChatSearchIntent` with `intakeYearRange?: IntakeYearRange`, optional `countryTerms?: string[]` for country aliases, and optional `aggregatorTerms?: string[]` for older stored conversations, plus existing country/intake/level/guidance filters needed to replay the scope.
- Adds `AvailableChatFacets` in `src/services/chatSession.ts` with `intakes: string[]`, `intakeYears: number[]`, `aggregators: string[]`, `levels: StudyLevel[]`, and `guidances: Array<'FOCUS' | 'ALLOWED' | 'DO_NOT_USE'>`.
- Adds `getAvailableChatFacets(results: CommissionRate[], role: UserRole): AvailableChatFacets` and `buildNextFilterPrompt(results: CommissionRate[], role: UserRole, intent: ChatSearchIntent): ChatFilterPrompt | undefined`. Facets with only one remaining value are omitted; order is intake/year, aggregator, level, guidance.
- Extends `PendingChatClarification.field` with `intakeYearRange`, `aggregator`, and `guidance`; choices carry canonical local values.
- `processChatTurn` merges confirmed choices and filter-only typed follow-ups with prior scope, accepts several aggregators as alternatives, and starts a fresh scope for an unrelated explicit school or country search.

- [ ] **Step 1: Write failing multi-turn session tests**

Add `keeps country and year filters while adding aggregators`, asserting a UK 2021–2025 scope remains active after entering two aggregators and only routes matching both the year range and either aggregator remain.

Add `confirms a suggested aggregator before applying it`, asserting selecting a correction applies the canonical name and an unconfirmed typo returns no narrowed result.

Add `asks only about facets with multiple accessible values`, asserting the result message carries the next prompt from remaining intakes/aggregators/levels/guidance and omits single-valued or role-hidden facets.

Add `offers a broader scope after a filter returns zero routes`, asserting zero results stop the facet sequence and provide a remove/widen suggestion.

Add `resets filters for a new explicit country search`, asserting prior aggregator/year filters do not leak into the new country query.

- [ ] **Step 2: Run the session tests and confirm the expected failures**

Run: `npm test -- --run src/services/chatSession.test.ts`
Expected: tests fail because the conversation stores a single intent and has no data-driven progressive facet sequence or aggregator correction confirmation.

- [ ] **Step 3: Implement structured scope merging and data-driven follow-ups**

Store all active facets in `ChatSearchIntent`, pass the currently available intake and aggregator names into `parseChatIntent`, and recalculate local results after each turn. Treat input containing only a known filter value as a continuation; a new explicit school or country query resets the scope. Use OR for aggregator names and AND across filter types. Attach the next available facet prompt to the result message; do not show aggregator prompts or candidates to Agents. Do not offer more facets when no routes match.

- [ ] **Step 4: Run session, access, and query tests**

Run: `npm test -- --run src/services/chatSession.test.ts src/services/chatQuery.test.ts src/services/accessPolicy.test.ts`
Expected: all listed tests pass; existing role and query behavior remains intact.

- [ ] **Step 5: Commit progressive session filtering**

```bash
git add src/types/chat.ts src/services/chatSession.ts src/services/chatSession.test.ts
git commit -m "feat: preserve progressive chat filter scope"
```

### Task 4: Make totals actionable and return focus to chat

**Files:**
- Modify: `src/components/ChatExperience.tsx`
- Test: `src/components/ChatExperience.test.ts`

**Interfaces:**
- `ChatBubble` renders `ChatMessage.followUpFilter` choices under result messages as well as clarification messages.
- The chat result preview shows separate accessible controls for the unique-school total and route total, each opening the matching current scoped result set.
- `ChatComposer` accepts an input ref or focus callback so opening scoped results can focus the existing composer without clearing its draft or session scope.

- [ ] **Step 1: Write failing result interaction tests**

Add `renders the next available filter prompt with choices under the result message`, `opens scoped school results and focuses the chat composer when the school total is clicked`, and `opens scoped route results and focuses the chat composer when the route total is clicked`.

Assert the opened result set matches the clicked total, the composer receives focus, and any existing draft remains unchanged.

- [ ] **Step 2: Run the component tests and confirm the expected failures**

Run: `npm test -- --run src/components/ChatExperience.test.ts`
Expected: the tests fail because totals are plain text and opening results does not focus the composer.

- [ ] **Step 3: Implement actionable totals and focus handling**

Render keyboard-accessible buttons for the distinct school count and route count. Route the school total through unique `universityId` selection and the route total through all result IDs. Open the results panel, set its scoped result list, and focus the composer on the next animation frame without overwriting the draft.

- [ ] **Step 4: Run component tests and the complete verification suite**

Run: `npm test -- --run src/components/ChatExperience.test.ts`
Expected: all component tests pass, including focus and draft-preservation cases.

Run: `npm test`
Expected: all test files pass.

Run: `npm run build`
Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 5: Commit actionable result totals**

```bash
git add src/components/ChatExperience.tsx src/components/ChatExperience.test.ts
git commit -m "feat: make chat result totals actionable"
```

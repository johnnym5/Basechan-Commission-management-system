# Structured Local Chat Interpreter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make offline chat interpret school searches and follow-ups with explicit, locally persisted intent and clear selectable clarifications.

**Architecture:** Store the current structured search intent and pending clarification on each conversation. Parse each new message against local role-safe rates, resolve short answers against the pending field, and use prior results for “compare all 4.” Ask which supported criterion vague ranking words mean, and derive optional prompt chips from current intent and existing local preference history. Keep chat turn processing and conversation persistence local.

**Tech Stack:** React 19, TypeScript 6, existing deterministic chat parser, account-scoped IndexedDB.

**Spec:** `docs/superpowers/specs/2026-10-09-structured-local-chat-interpreter-design.md`

## Global Constraints

- The interpreter remains deterministic and does not send chat text to a server or external model.
- A chat turn must not issue Firestore reads or writes.
- All parsed filters and result fields remain role-aware.
- Never silently choose among multiple plausible school matches.
- Keep the four-school comparison cap, 500-character input limit, 50-query conversation limit, and existing result-card presentation.
- Existing conversations without structured intent continue to load and derive only safe context supported by existing fields.

## Review Focus

- Pending-level answers update the active search, not a new query; manually verify “UK schools” followed by “Foundation” and “Postgraduate.”
- Country-only requests include available levels and intakes; inspect UK/England aliases and missing country values.
- Typo suggestions never silently select a school; manually inspect close single matches, multiple close candidates, and no candidate.
- “Compare all 4” uses the last displayed result schools and asks about incompatible routes; inspect fewer-than-four and incompatible route cases.
- Legacy conversations still load and a sent message makes no Firestore calls; inspect old-record fallback and the complete send path.
- Vague ranking words ask for a role-authorized criterion; unsupported processing-time ranking says the field is unavailable.
- Contextual prompt chips use active intent or local history and do nothing until selected.

## File Map

- Modify `src/types/chat.ts`: define the serializable `ChatSearchIntent`, `PendingChatClarification`, clarification field and choice types; add optional intent and last-result school IDs to `ChatConversation` for legacy compatibility and optional choices to `ChatMessage`.
- Modify `src/services/chatQuery.ts`: normalize broad school/country phrasing, parse local role-visible filters, resolve exact/alias/partial/fuzzy school candidates, identify uncertainty, and produce actionable no-match responses.
- Modify `src/services/chatSession.ts`: resolve pending replies, merge explicit follow-up filters, apply country-only broad searches, bind “compare all 4” to the stored result IDs, and update conversation intent.
- Modify `src/components/ChatExperience.tsx`: display clarification choices as buttons, submit selected values through the same local turn path, and preserve intent on resume/new conversation.
- Modify `src/services/localRateDatabase.ts`: reuse the existing account-scoped conversation, profile, usage, and favorite stores; add local profile deletion. No IndexedDB schema migration is required.

## Interfaces

- `ChatSearchIntent` is a JSON-serializable object with `schoolIds: string[]`, `country?: string`, `level?: Exclude<StudyLevel, 'ALL'>`, `intake?: string`, `guidance?: 'FOCUS' | 'ALLOWED' | 'DO_NOT_USE'`, `aggregatorTerms: string[]`, `rateMinimum?: number`, `rateMaximum?: number`, `feeType?: 'FLAT' | 'PERCENTAGE'`, `sortBy?: 'rate_desc' | 'rate_asc'`, `compare: boolean`, and `compareSchoolIds: string[]`.
- `PendingChatClarification` is `{ field: 'school' | 'country' | 'level' | 'intake' | 'intent' | 'ranking'; prompt: string; choices: Array<{ label: string; value: string }> }`.
- `ChatMessage.clarification?` is `{ field: PendingChatClarification['field']; choices: PendingChatClarification['choices'] }`; each choice value is a stable school ID, normalized country, canonical level, intake, or intent key.
- `ChatPromptSuggestion` is `{ label: string; prompt: string }`; `buildContextualSuggestions(state: ChatSessionState, rates: CommissionRate[], role: UserRole): ChatPromptSuggestion[]` returns optional suggestions derived only from current intent, existing profile history, and role-readable local data.
- `ChatConversation.searchIntent?: ChatSearchIntent`, `pendingClarification?: PendingChatClarification`, and `lastResultSchoolIds?: string[]` remain optional for stored conversation compatibility.
- `processChatTurn(state, rawInput, rates, now, role)` continues returning `{ state, matchingRates, clarificationQuestions }`; choices are carried on the assistant `ChatMessage` as optional structured clarification metadata.

## Task 1: Add serializable conversation intent and clarification types

**Files:** `src/types/chat.ts`

- [x] Extend `ChatConversation` and `ChatMessage` with optional serializable intent/clarification metadata; preserve old records where fields are absent.
- [x] Include optional pending ranking criterion state without storing rate records or role-protected fields.

## Task 2: Improve local keyword and school matching

**Files:** `src/services/chatQuery.ts`

- [x] Parse broad country searches without forcing a level; retain explicit level/intake/guidance and role-visible payout/routing extraction.
- [x] Return school candidate choices with stable local identifiers; use conservative fuzzy thresholds and do not auto-select ambiguous matches.
- [x] Distinguish an unclear/out-of-scope request from recognized filters with zero matching rates; produce actionable clarification text for each.
- [x] When a request uses vague ranking language (“best,” “top,” “recommended”), require a supported criterion; do not equate those words with Focus or payout. Explicit “highest/lowest payout” keeps the existing role-gated sort.
- [x] For unsupported metrics such as processing speed or conversion rate, return an unavailable-data clarification and offer only existing supported criteria.

## Task 3: Resolve pending replies and conversational context

**Files:** `src/services/chatSession.ts`

- [x] Resolve short replies only against `pendingClarification`; apply selected field to stored intent and rerun local filtering.
- [x] Preserve earlier filters only for recognized follow-up wording; update `searchIntent` on every turn and clear pending state once resolved.
- [x] Store unique school IDs from the displayed result set and map “compare all 4” to the last four schools; clarify missing/incompatible common level or intake.
- [x] Ensure country-only broad searches return all matching levels/intakes and a zero-result response reports applied filters with concrete next choices.
- [x] Add `buildContextualSuggestions(state, rates, role)` using current intent, `AgentChatProfile` history already saved locally, and role-readable rates; return prompts for real available next steps only.

## Task 4: Render and submit clarification choices locally

**Files:** `src/components/ChatExperience.tsx`

- [x] Carry clarification choices on assistant messages and render one button per explicit choice; selecting one sends its exact value through `processChatTurn`.
- [x] Render contextual prompt chips from `buildContextualSuggestions`; chips submit their exact prompts and never modify intent before user selection.
- [x] Ensure `ChatExperience.sendMessage` continues to use in-memory rates and local IndexedDB only; do not call Firestore services from the message-submit handler.
- [x] Preserve clarification state when local conversations are saved, loaded, resumed, or started fresh.
- [x] Run `npm run build`; confirm only existing bundle-size warnings remain.

## Task 5: Final regression review

**Files:** all implementation files above

- [x] Verify Agent parsing never consumes Staff routing fields and Staff parsing never consumes Agent payout fields.
- [x] Review 4-school cap, 500-character limit, 50-query limit, and existing result-card privacy behavior without altering them.
- [ ] Manually walk through the review-focus scenarios against local role-safe data.
- [x] Review the diff for accidental Firestore calls in local parsing/search and for data added to persisted intent beyond identifiers and filter values.

## Handoff Notes

- The planned work is one cohesive local chat interpreter; tasks depend on the shared types but remain independently reviewable.
- No external model or new dependency is needed.
- Do not deploy or change Firestore rules for this feature.

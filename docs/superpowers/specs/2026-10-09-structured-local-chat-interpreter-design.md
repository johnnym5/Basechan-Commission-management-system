# Structured Local Chat Interpreter Design

**Status:** Approved by product owner
**Date:** 2026-10-09

## Purpose

Make chat understand school-search requests and follow-up answers reliably while continuing to run locally against the authenticated user's cached, role-safe rate data. The interpreter remains deterministic and does not send chat text to a server or external model.

Also make ranking language explicit and provide contextual prompt suggestions from the active search and local conversation history. Recommendations must use existing authorized rate fields and must not invent unavailable metrics.

## Current failure

`parseChatIntent` parses each message as mostly independent text. `processChatTurn` tries to recover context by inspecting the last assistant message and recent user wording. This makes a short answer such as “Foundation” easy to misapply, causes broad country queries such as “schools in UK” to ask for a study level unnecessarily, and leaves phrases such as “compare all 4” without a stable link to the four routes previously shown. School matching uses substring and token checks that can mistake a partial word for a school or fail to distinguish an uncertain match from no match.

## Design

### Structured conversation intent

Persist a typed search intent on each conversation. It records normalized school targets, country, level, intake, guidance, supported role-visible filters, comparison targets, the last displayed result identifiers, and a pending clarification field plus its candidate choices. The stored structure contains identifiers and filter values, not cached payout or routing records. Each turn updates this intent explicitly.

Conversation state remains scoped to the signed-in UID and the current role-safe local database. A new conversation starts with an empty intent. Loading an older conversation restores its intent when present; older records without it continue to load and derive only the safe context supported by their existing fields.

### Turn resolution

For each message, first check whether it answers an outstanding clarification. A valid choice updates that field in the saved intent and reruns the search. If it does not answer the pending question, parse it as a new request and preserve prior filters only when the wording signals a follow-up, such as “also,” “same,” “compare these,” or “what about.” Short answers are interpreted only when a matching clarification is pending.

Country-only or broad school requests return matching schools across available levels and intakes unless the user asks to narrow them. A missing study level is requested only when a named-school or comparison request needs one to identify a useful result. “Compare all 4” resolves against the last four displayed schools, within the existing four-school comparison limit. Comparison still requires records with compatible level and intake; missing or incompatible values trigger a targeted clarification.

### Local matching and clarification

Normalize case, punctuation, whitespace, and known chat vocabulary before extracting keywords. Match countries, intakes, study levels, guidance, school names, and role-visible filters against the local cached data. Add conservative typo matching for school names and common aliases. Never silently choose among multiple plausible school matches: show up to three named choices and wait for selection. If no school is close enough, explain that no match was found and offer the nearest candidates, if any, or ask the user to rephrase.

Classify a request that has no recognizable search/filter intent as unclear or out of scope, and ask what the user means with concrete example choices. A recognized filter with zero matches should say which filters were applied and offer useful next steps, such as removing a filter or choosing a different intake. Do not silently drop a recognized filter or broaden results.

All parsed filters and result fields remain role-aware. Agent searches cannot inspect Staff-only routing fields; Staff searches cannot inspect Agent payouts. Admin chat continues to use the Admin-authorized local rates.

### Subjective ranking and contextual suggestions

Honor explicit ranking criteria that exist in the local role-safe data, such as highest or lowest Agent payout for roles allowed to read payout. “Focus” and “Restricted” refer to the existing guidance values and remain filters, not ranking meanings. Ask what the user means by vague terms such as “best,” “top,” or “recommended,” offering only criteria available to that role, such as highest payout when permitted, Focus guidance, or a country/intake filter. Do not silently interpret a vague quality word as guidance or payout.

If the user asks for a metric absent from the current data, such as processing speed or conversion rate, say that the data is unavailable and offer supported alternatives. Do not add new data fields or Admin directive stores as part of this work.

Generate optional prompt chips from the current search intent and locally saved recent conversations. Suggestions may offer an available next step such as choosing a level for a country search, narrowing to Focus/Restricted guidance, selecting an intake, or comparing the displayed schools. Apply a suggestion only after the user selects it; chips submit a complete local query or clarification value. Respect the current role's visible fields when generating suggestions.

### Local-only operation

Parsing, clarification resolution, search, comparison selection, and conversation persistence use local code and the account-scoped IndexedDB cache. A chat turn must not issue Firestore reads or writes. The existing independent rate synchronization may refresh the cached dataset when available, but it does not participate in processing a sent message.

## User-visible behavior

- “Schools in UK” lists cached UK schools across available levels and intakes, with a result count and concise refinement suggestions.
- “Postgraduate” after a pending level question applies to the saved request and returns its results.
- “Compare all 4” selects the four schools in the last result set; missing compatible comparison data prompts for the specific level or intake needed.
- A likely school typo shows a “Did you mean …?” choice. Selecting a choice continues the saved search with that exact school.
- An unclear phrase asks what the user means and offers concrete examples from supported search actions.
- A zero-result search identifies its applied filters and offers ways to refine the request.
- “Best/top/recommended” asks for a supported ranking criterion; “fastest processing” explains that processing-time data is unavailable and offers supported alternatives.
- Prompt chips reflect the current search or local history, remain optional, and never apply a filter without selection.
- All behavior works without internet once the authorized local rate snapshot exists.

## Boundaries

- No external LLM, server-side parser, Cloud Function, or network query for chat text.
- No chat-driven rate edits or changes to role authorization.
- No silent application of inferred school suggestions or learned preferences.
- No new Admin directive store, conversion-rate/processing-time/deadline data fields, alternate card/table views, or calculator/PDF action integration.
- Keep the four-school comparison cap, 500-character input limit, 50-query conversation limit, and existing result-card presentation.

## Acceptance criteria

1. Search intent and pending clarification survive local conversation save, reload, resume, and offline use.
2. A short answer is applied only to the clarification currently pending; it does not become an unrelated new search.
3. Country-only/broad queries do not ask for a level unless the requested operation requires it.
4. “Compare all 4” resolves to the four schools in the immediately preceding displayed result set and enforces compatible records.
5. A close typo or ambiguous school name produces selectable suggestions and does not search until confirmed.
6. Unclear requests and recognized zero-result searches receive distinct, actionable responses.
7. Unsupported ranking metrics are reported as unavailable; ranking suggestions use only role-authorized fields.
8. Contextual prompt chips are derived from active intent or local history, are optional, and run only after selection.
9. Search matching and outputs never read fields hidden from the current role.
10. Submitting a chat message makes no Firestore request; it searches the in-memory/local cached rates and persists the conversation locally.
11. Existing conversations without structured intent still load without data loss or runtime errors.

## Implementation scope

Expected touchpoints are `src/types/chat.ts`, `src/services/chatQuery.ts`, `src/services/chatSession.ts`, `src/components/ChatExperience.tsx`, and `src/services/localRateDatabase.ts`. No test files are included in this implementation; the production build is the recorded verification step.

# Chat and Natural-Language Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Agents and Staff an account-linked chat experience to search, filter, inspect, favorite, and compare authorized school information using natural language.

**Architecture:** A local deterministic parser converts text into typed search intent; a role-specific repository queries only the Firestore read model allowed for the current user. Chat state, Favorites, and learned preferences are per account. A conversation keeps short-lived query context while stored history is capped and bounded.

**Tech Stack:** React 19, TypeScript 6, Firebase Firestore 10.14, existing CSS/Tailwind setup, existing Lucide icons.

**Spec:** `docs/superpowers/specs/2026-10-09-agent-staff-chat-search-design.md` (sections 4–6).

## Global Constraints

- No Cloud Functions, external LLM calls, or external query transmission.
- Query text maximum is 500 characters; rate limit is 10 queries per minute; conversation limit is 50 user queries.
- Keep at most five conversations per account; creating a sixth deletes the oldest.
- Start preference suggestions after 10 queries and continue learning; never silently apply a suggestion.
- A missing named-school intake uses nearest future, then newest available record, then nearest current intake.
- Ask for missing level; comparison supports up to four schools on one intake and one study level.
- Use role-safe Agent/Staff read models from `2026-10-09-secure-role-access-and-rate-models.md`; never query canonical Admin rate data.
- Preserve the user's current uncommitted changes when implementing this plan.

## Review Focus

- A 500-character query succeeds and 501 characters is rejected before persistence; test boundary lengths.
- Ambiguous names and typos produce a suggestion/clarification rather than an incorrect silent match; test aliases, near misses, and duplicate school names.
- No-intake named-school requests use the exact future/newest/current fallback; test future absent, record dates absent, and no current match.
- Mixed-level/intake comparisons request clarification instead of showing mismatched figures; test missing and incompatible combinations.
- Account switching, offline mode, and opening an old conversation never leak another user's messages or display stale data as fresh; test user isolation and cached snapshots.

---

## File Map

- Create `src/types/chat.ts`: typed messages, conversations, parser outcomes, filters, result cards, and preference profile.
- Create `src/services/chatQueryParser.ts`: deterministic English query parsing and clarification generation.
- Create `src/services/schoolSearchService.ts`: query role-safe projection data and apply normalized filters/intake defaults.
- Create `src/services/chatHistoryService.ts`: account-scoped conversation CRUD, five-conversation retention, and 50-query enforcement.
- Create `src/services/favoritesService.ts`: account-scoped favorite school records.
- Create `src/services/preferenceService.ts`: compact deterministic preference aggregation and optional suggestions.
- Create `src/hooks/useChatSession.ts`: active session state, query limiter, persistence, resume/new behavior, and result context.
- Create `src/components/ChatView.tsx`, `ChatMessageList.tsx`, `ChatComposer.tsx`, `SchoolResultCard.tsx`, `FullResultsView.tsx`, and `SchoolCompareMatrix.tsx`.
- Modify `src/App.tsx`, `src/components/AppLayout.tsx`, `AgentPortalView.tsx`, and `StaffPortalView.tsx` to show dedicated role chat and keep current role banner/count tiles.
- Add parser, service, retention, comparison, and UI interaction tests using the shared Vitest and Firestore emulator harness established by the access/rate-model plan.

## Interfaces

- `parseChatQuery(input: string, context: ChatContext, vocabulary: SearchVocabulary): ParseOutcome` returns `{ kind: 'search'; filters: SearchFilters; compareTargets?: string[]; guidanceIntent?: boolean }`, `{ kind: 'clarify'; prompt: string; choices?: ClarificationChoice[] }`, or `{ kind: 'out_of_scope'; reply: string }`.
- `searchSchools(input: { role: 'AGENT' | 'STAFF' | 'ADMIN'; filters: SearchFilters; activeSchoolId?: string }): Promise<SearchResult>` returns role-safe school cards plus `{ appliedIntake: string; matchCount: number; suggestions: string[] }`.
- `saveConversation(uid: string, conversation: ChatConversation): Promise<void>` persists a per-user conversation and enforces 5 retained conversations/50 user turns.
- `submitChatQuery(input: { uid: string; role: UserRole; text: string; context: ChatContext }): Promise<ChatTurnResult>` validates, rate-limits, parses, searches, and returns clarification or results; it never calls a remote model.
- `resolveDefaultIntake(records: SchoolRateRecord[], now: Date): SchoolRateRecord | undefined` implements the future > newest available > nearest current precedence.

## Task 1: Define chat types and deterministic parser

**Files:** `src/types/chat.ts`, `src/services/chatQueryParser.ts`, parser tests.

- [ ] Add tests for supported filters (school, country, level, intake, guidance, role-visible payout/routing), comparison/follow-up intents, out-of-scope requests, ambiguous terms, and aliases/typos.
- [x] Implement local parsing for common level, intake, guidance, country, and school terms; unknown school terms prompt clarification.
- [ ] Add test that values and fields hidden from a role are not recognized as searchable filters for that role.

## Task 2: Implement role-safe search, intake defaults, and compare validation

**Files:** `src/services/schoolSearchService.ts`, `src/types/chat.ts`, search tests.

- [ ] Test `resolveDefaultIntake` for future, no-future/newest, incomplete-date/nearest-current, and no-available-intake cases.
- [ ] Test result filters, requested ranking only, preview count/refinement suggestions, and maximum four compare targets.
- [x] Implement local role-read-model filtering with named-school intake defaults and clarification for missing levels; enforce shared intake/level checks at compare time.
- [ ] Test that Agent comparisons show payout values while Staff comparisons show routing/guidance and that flat fees are not arithmetically compared with percentage rates.

## Task 3: Add per-account conversations, limits, and Favorites

**Files:** `src/services/chatHistoryService.ts`, `src/services/favoritesService.ts`, Firestore rules, service tests.

- [ ] Test query sanitization (blank/control characters), 500/501-character boundary, and 10 requests/minute boundary.
- [ ] Test a conversation stops at 50 user turns; creating a sixth conversation removes the oldest; conversation records are scoped to the authenticated UID; returning users can choose resume or start new.
- [x] Implement per-user Firestore paths and rules, resume/new selection state, account-scoped Favorites, and chronological History.
- [ ] Test account switching and logout clear in-memory conversation, result, and favorite state before another user loads.

## Task 4: Add ongoing preference learning

**Files:** `src/services/preferenceService.ts`, `src/types/chat.ts`, preference tests.

- [ ] Test no suggestions before 10 queries, suggestions at 10, repeated learning after 10, reset behavior, and no silent filter application.
- [ ] Implement a compact per-user preference profile from deterministic query/favorite/view signals; persist separately from retained conversations.
- [ ] Ensure deleting the oldest conversation does not erase the compact profile, while clearing preferences does.

## Task 5: Build chat, interactive results, and full results view

**Files:** `src/components/ChatView.tsx`, `ChatMessageList.tsx`, `ChatComposer.tsx`, `SchoolResultCard.tsx`, `FullResultsView.tsx`, `SchoolCompareMatrix.tsx`, component tests.

- [ ] Test the 500-character composer limit, enter/submit behavior, clarification prompt action, favorite action, compare selection limit, and View All transition.
- [x] Implement resume-or-start-new prompt, compact result preview, and a full results view with the composer at the top and incremental result loading.
- [x] Implement comparison matrix for at most four schools with explicit unavailable values and block comparison when intake/level differ.
- [ ] Implement role-specific school cards with only the fields allowed by each read model.

## Task 6: Integrate Agent and Staff dedicated chat pages

**Files:** `src/App.tsx`, `src/components/AppLayout.tsx`, `AgentPortalView.tsx`, `StaffPortalView.tsx`, responsive UI tests.

- [ ] Test Agent/Staff page retains the role banner and three count tiles while hiding old directory/search controls and always-visible cards.
- [ ] Replace Agent and Staff directory bodies with dedicated chat, retaining current role-specific access behavior and existing visual language.
- [x] Build the persistent collapsible Favorites, History, and Updates side rail for Agents and Staff; the workspace navigation remains available while browsing each panel.
- [ ] Verify production build and lint; expected: all current routes still render for Admin and role pages render only their authorized UI.

## Execution Notes

- Depends on secure role-specific projections and approval rules from `2026-10-09-secure-role-access-and-rate-models.md`.
- Do not start user-facing Chat until the Admin domain and Agent approval rules are validated.
- Existing `watchlistUtils.ts` uses browser-local storage; migrate Favorites to the account-scoped service rather than treating current local state as an account identity.

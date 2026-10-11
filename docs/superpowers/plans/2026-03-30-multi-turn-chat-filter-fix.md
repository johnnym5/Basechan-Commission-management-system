# Multi-Turn Chat Context Memory & 100+ Lexicon Expansion Plan

Fix chat context persistence bug where active filters (e.g. Postgraduate level, Sept 2026 intake) are wiped during follow-up comparison queries and entity searches. Expand natural language grammar lexicon and intent parser to support 100+ question styles, pidgin/informal slang, entity terms, and follow-up patterns.

## Global Constraints
- Active `studyLevel` (`PG` / `UG` / `FD`) and active `intake` MUST persist across chat session turns unless explicitly overridden or cleared.
- `parseChatIntent` and `processChatTurn` must not prompt for study level if the active session level is already set in context.
- All 168 existing Vitest unit tests must remain 100% green.
- `npm run build` must succeed without TypeScript or bundling errors.

## Tasks

### Task 1: Fix Multi-Turn Level & Intake Filter Persistence in Chat Session
- **Files**: `src/services/chatSession.ts`, `src/services/chatSession.test.ts`
- **Goal**: Preserve `state.conversation.activeLevel` and `state.conversation.activeIntake` in `processChatTurn` even when `isFreshEntitySearch` is true, unless the current user prompt contains a conflicting level or intake word or explicit filter reset. Ensure comparison queries like `"Compare University of Greenwich and Aberdeen University"` inherit `activeLevel: "PG"` automatically.

### Task 2: Expand Lexicon & Intent Parser for 100+ Natural Language Patterns & Edge Cases
- **Files**: `src/services/chatVocabulary.ts`, `src/services/chatQuery.ts`, `src/services/chatSession.test.ts`
- **Goal**: Add 100+ verbs, nouns, adjectives, pidgin slang variations (`"how much dem dey pay"`, `"which ones get"`, `"compare am with"`), anaphora/pronoun bindings (`"compare both"`, `"compare them"`), and multi-turn filter adjustment commands (`"remove filter for intake"`, `"clear level and country filters"`).

### Task 3: Comprehensive Multi-Turn Chat Vitest Unit Test Suite
- **Files**: `src/services/chatSession.test.ts`, `src/components/ChatExperience.test.ts`
- **Goal**: Add thorough unit tests verifying 1-step comparison flows, study level retention across 5+ turns, pidgin slang parsing, and multi-filter removal commands.

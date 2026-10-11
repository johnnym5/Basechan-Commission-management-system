# Smart Conversational Search Bar Implementation Plan

Replace fragmented search inputs with a unified, deterministic "Smart Conversational Search Bar". The component tokenizes natural language queries into interactive UI chips, offers fuzzy typo corrections ("did you mean?"), rotates role-aware typewriter placeholders safely, and provides contextual dropdown suggestions.

## Global Constraints
- Zero LLM dependencies: all parsing must be deterministic using Levenshtein edit distance.
- Typewriter placeholders must be decoupled from the DOM `<input placeholder>` attribute to prevent screen reader noise.
- Extracted tokens (`SearchToken`) must synchronize seamlessly with `DashboardFilters`.
- All Vitest unit tests must remain 100% green.
- `npm run build` must succeed with zero TypeScript or bundling errors.

## Tasks

### Task 1: Search Types & Vocabulary Engine
- **Files**: `src/types/search.ts`, `src/constants/searchDictionaries.ts`
- **Goal**: Define `TokenType`, `SearchToken`, `ParseResult`, and dictionary constants for schools, study levels, guidance statuses, intakes, and countries.

### Task 2: Deterministic NLP Tokenizer & Levenshtein Fuzzy Matcher
- **Files**: `src/utils/nlpParser.ts`, `src/utils/nlpParser.test.ts`
- **Goal**: Build Levenshtein edit distance logic and `parseNaturalLanguage()` to convert raw search text into `SearchToken[]` chips, remaining search query, and `didYouMean` typo suggestions.

### Task 3: Safe Accessibility-Compliant Typewriter Hook
- **Files**: `src/hooks/useTypewriter.ts`, `src/hooks/useTypewriter.test.ts`
- **Goal**: Implement `useTypewriter(prompts, isPaused, speed, pauseDelay)` that types and rotates prompts, pausing when the search input is focused or active chips exist.

### Task 4: Smart Search Bar Component (`SmartSearchBar.tsx`)
- **Files**: `src/components/SmartSearchBar.tsx`, `src/components/SmartSearchBar.test.tsx`
- **Goal**: Build the UI component rendering interactive token chips, input field with overlay typewriter placeholder, "Did you mean?" fuzzy chip prompt, and contextual dropdown suggestions.

### Task 5: Integration with Dashboard Views & Filters
- **Files**: `src/components/MasterTable.tsx`, `src/components/RoleDashboardView.tsx`, `src/components/DashboardView.tsx`
- **Goal**: Replace legacy input fields with `<SmartSearchBar />` and map tokens directly to `DashboardFilters`.

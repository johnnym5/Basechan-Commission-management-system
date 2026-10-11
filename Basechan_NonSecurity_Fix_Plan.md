# Basechan Commission Management System
## Functional, Financial-Integrity, Search, UX and Maintainability Fix Plan

**Audience:** Coding agent working on the Basechan Commission Management System repository  
**Repository:** `johnnym5/Basechan-Commission-management-system`  
**Audit baseline:** `main` at `c5634a0e299a738efe7f88ec4e6047a5f470b174` (11 October 2026)  
**Purpose:** Address the non-security findings from the code review with focused fixes, regression tests, and a clear record of what changed.

---

## 1. Instructions to the coding agent

Read this file fully before making changes. Inspect the current repository and current branch first; the working tree may have moved on from the audit baseline.

Implement the listed non-security fixes in small, reviewable steps. Preserve the app's existing architecture, product behaviour where it is correct, commission domain semantics, and current user workflows. Do not rewrite the application or introduce a new framework simply to address these issues.

### Mandatory implementation constraints

- **Do not perform security remediation as part of this task.** Authentication, account authorisation, Firestore Security Rules, disabled-account enforcement, dependency security remediation, print/export HTML security work, secrets, and repository-history cleanup are explicitly outside this change set.
- **Do not migrate the application away from its existing client-side architecture.** Do not add a server, API backend, Cloud Functions, or another paid server-side component. Existing React/Vite client code may be corrected where the functional fixes below require it.
- Do not make unrelated visual redesigns or broad refactors.
- Do not change Firebase project configuration, billing plan, environment variables, authentication provider, or Firestore rules.
- Do not invent commission-conversion rules. When the data does not support a valid comparison, report that it is not comparable rather than guessing.
- Do not use TypeScript `any` to silence a type error. Prefer proper types, discriminated unions, generics, or narrow type guards.
- Preserve existing records and backwards compatibility. Do not rename, delete, or migrate persisted fields unless the current schema is confirmed and a migration is explicitly documented.
- Add or update tests for each defect corrected. A code change is not complete until its acceptance criteria pass.
- Run the available checks and report actual results. Do not claim tests, builds, or lint checks passed if they were not run.

### Suggested execution sequence

1. Inspect the source and tests for every target file; verify whether each finding still applies.
2. Fix financial comparison consistency first because misleading commission rankings are the highest functional risk.
3. Fix intake classification and university grouping.
4. Correct natural-language search parsing and its performance.
5. Fix mutation-path consistency and the remaining UI/data presentation defects.
6. Improve types, tests, documentation, and automated checks.
7. Run lint, tests, and production build; summarise any remaining failures and out-of-scope blockers.

If a finding has already been fixed in the current branch, do not reapply it. Verify it with tests, then mark it as already resolved in the final report.

---

## 2. Priority definitions

| Priority | Meaning |
|---|---|
| **P0 – Financial correctness** | Can display an incorrect commission comparison, best route, or margin. Fix before relying on comparison outputs. |
| **P1 – Functional correctness** | Can produce incorrect search results, mislabel intake history, group distinct universities, or leave parts of the app out of sync. |
| **P2 – Usability and maintainability** | Causes confusing labels, inconsistent presentation, brittle types, avoidable performance costs, or inaccurate project documentation. |
| **P3 – Automation and polish** | Improves repeatability and prevents regressions; should be implemented after the code-level fixes are stable. |

---

# 3. P0: Make commission comparisons dimensionally correct

## Finding

A commission difference is not automatically comparable across all rate rows. The code has a central helper in `src/utils/commissionFormatter.ts`, but several high-impact code paths still compare or display raw numeric `diffMargin` values without consistently accounting for flat-fee versus percentage rates, currency, or the net/gross basis.

Examples identified in the reviewed source include:

- `src/components/CompareView.tsx` ranking rows by raw `diffMargin` to identify minimum/maximum or “best” results.
- `src/utils/groupingUtils.ts` deriving a best route and maximum margin from raw numeric margins.
- `src/services/chatSession.ts` producing comparison or dossier text with a hard-coded `%` suffix, including for flat-fee rows.
- Flat-fee presentation in some comparison UI using a hard-coded `£`, rather than the row's actual currency.

These paths can make values such as `£1,000` and `15%` look directly comparable, or render a flat fee as a percentage. That is a financial interpretation error, not just a display inconsistency.

## Required changes

### 3.1 Establish one shared comparability rule

Review and consolidate the domain-level behaviour in `src/utils/commissionFormatter.ts`. Reuse and extend the current helpers instead of creating a separate interpretation in each component.

The shared comparison contract must account for, at minimum:

- **Rate type:** flat fee versus percentage.
- **Currency:** monetary values with different currencies must not be directly ranked unless an existing, explicit and reliable conversion basis is part of the data model.
- **Calculation basis:** `netOrGross` or the equivalent domain field must match before values are directly compared.
- **Meaning of the compared field:** ensure `masterRate`, `agentRate`, `netMargin`, and `diffMargin` are not accidentally treated as interchangeable.
- **Missing or invalid values:** a missing value must not silently become zero and win or lose a ranking.

Use the real field names and types in the current schema. Do not introduce invented conversions or assume every currency is GBP.

If two rates are incompatible, return a typed non-comparable result. Prefer a discriminated result such as `{ comparable: true, ... }` versus `{ comparable: false, reason: ... }`, or an equivalent pattern consistent with the repository's conventions. Avoid returning a numeric sentinel such as `-1` or `0` to represent “not comparable”.

### 3.2 Update the comparison matrix

**Primary file:** `src/components/CompareView.tsx`

- Replace direct raw-number ranking with the shared comparability helper.
- Do not highlight a maximum or minimum across incompatible units or calculation bases.
- If no valid comparable group exists, show an explicit neutral state such as “Not directly comparable”.
- Keep the comparison dimensions visible enough that users can understand why a ranking was or was not produced.
- Fix any “best by level” aggregation that currently aggregates across different intakes without including the intake dimension. Either include intake in the aggregation key or update the label and grouping so that the result cannot be mistaken for a same-intake comparison.
- Use the actual currency associated with a flat fee. Do not hard-code `£` when the row may be in another currency.
- Keep percentage formatting and currency formatting separate. A percent value must not use a currency symbol; a flat fee must not be suffixed with `%`.

### 3.3 Update university and route grouping

**Primary file:** `src/utils/groupingUtils.ts`

- Review `bestRoute`, `maxMargin`, route ordering, and any group-level comparison logic.
- Ensure a group's “best route” is chosen only from comparable candidate rates.
- If candidate routes contain different fee types, currencies, bases, or other incompatible dimensions, either maintain separate comparable groups or return no single best route with an explanatory state.
- Do not claim that a group-level maximum is the best commercial route when the values are not comparable.
- Preserve all routes even when a best route cannot be calculated. Failure to rank must not cause route data to disappear.

### 3.4 Update conversational comparison output

**Primary file:** `src/services/chatSession.ts`

- Remove hard-coded percentage assumptions from comparison and dossier responses.
- Format rates through the shared commission formatting utilities.
- Calculate and show a margin only when the two source values and their units/bases support that calculation.
- When the request combines incompatible values, explain that a direct comparison is unavailable and show the individual values with their correct units.
- Keep the language clear for non-technical staff. Do not expose internal enum names or implementation terms as the user-facing explanation.
- Check other message-building paths in `src/services/` for duplicate commission arithmetic, not only the currently identified examples.

### 3.5 Add financial regression tests

Update or add tests beside the relevant utility/component/service tests. At minimum cover:

1. Percentage compared with percentage on the same basis: valid comparison and correct display.
2. Flat fee compared with flat fee in the same currency and on a compatible basis: valid comparison and currency-aware display.
3. Flat fee compared with percentage: not directly comparable; no max/min highlight.
4. Flat fees in different currencies: not directly comparable unless an existing explicit conversion rule is implemented and tested.
5. Same rate type but net versus gross: no comparison unless the domain model defines a valid conversion.
6. Missing or malformed rate: does not become a valid zero-valued candidate.
7. Group containing a mixture of comparable and incompatible routes: all routes remain visible, and the “best” route is selected only from the valid comparison set.
8. Chat/dossier output never attaches `%` to a flat fee.
9. A “best by level” result does not silently combine different intakes as though they were one comparable cohort.

### Acceptance criteria

- All comparison surfaces use the shared domain rules instead of bespoke raw `diffMargin` ordering.
- Incompatible values cannot win or lose a ranking based solely on their numeric representation.
- Rate values always display with their correct unit and currency.
- The above regression tests pass.

---

# 4. P1: Correct intake lifecycle and historical intake presentation

## Finding

`src/utils/groupingUtils.ts` contains `isHistoricalIntake(intake, referenceYear = new Date().getFullYear())`. The current year-only comparison can label an intake as current even after its month has passed. For example, “Jan 2026” can be classified as non-historical during October 2026 because its year is still 2026.

The reviewed `MasterTable` and `CompareView` logic can also fall back to placing all routes in active sections when no current routes are found. Historical routes can therefore be shown under an active/current label instead of a previous-intake label.

## Required changes

### 4.1 Parse intake dates consistently

**Primary file:** `src/utils/groupingUtils.ts`  
**Related files:** `src/components/MasterTable.tsx`, `src/components/CompareView.tsx`, and any shared intake/date utilities found during inspection.

- Inspect the actual intake formats found in the data and tests before implementing parsing. Examples may include `Jan 2026`, `January 2026`, `Sept 2026`, `September 2026`, a year-only intake, and existing configured lifecycle labels.
- Introduce one shared parser/normalizer for intake periods rather than having components interpret intake labels independently.
- Compare both year and month when a month is available.
- Avoid permissive date parsing that silently interprets malformed labels as valid dates.
- Treat year-only or unrecognised labels explicitly. Do not guess the month for a year-only intake.
- Prefer an existing authoritative lifecycle setting when one is available and valid. If date inference is needed, keep it separate from the stored/manual lifecycle state so the UI does not overwrite source data.
- Make the reference date injectable into the utility or pass it as an argument so tests are deterministic and do not depend on the day they are run.

### 4.2 Separate current and historical routes accurately

**Primary files:** `src/components/MasterTable.tsx`, `src/components/CompareView.tsx`

- Do not put historical routes into an active/current section just because no current routes are present.
- If there are no current routes, show a clear empty state for current intakes and show historical routes under the previous-intakes section.
- Keep the actual data accessible; this correction must not hide history or delete routes.
- Use accurate labels for the active, upcoming, current, and historical states used by the product. Do not treat these terms as equivalent without checking existing product semantics.
- Check the modal and collapsible panels for consistent route counts and labels after grouping.
- Confirm that sorting and comparison do not reclassify a historical route as current in a secondary view.

### 4.3 Handle configured empty intake lists

**Primary file:** `src/hooks/useSystemConfig.ts`

The reviewed code only updates the in-memory active-intake state when the fetched array is non-empty. An intentionally empty `activeIntakes` array can therefore be ignored and leave an old list in state.

- Distinguish “field is present and is an empty array” from “field is missing or invalid”.
- Apply an explicitly empty array as an empty list.
- Keep the intended fallback only for missing or invalid data, not for a valid empty value.
- Add tests for missing field, valid empty array, non-empty array, and malformed field.
- This task does not include changing Firestore rules. If runtime access to configuration documents remains blocked by existing configuration, document it as an out-of-scope dependency rather than altering rules in this task.

### Tests and acceptance criteria

Cover at least:

- A past month in the current year is historical when the reference month is later.
- The current month is classified according to the documented product rule.
- A future month is not classified as historical.
- Year-only and invalid intake labels have a deliberate, tested result.
- If there are no current routes, historical routes appear under previous intakes and are not labelled active.
- An explicitly empty active-intakes array clears current state.
- The same intake receives the same classification in master cards, comparison view, and modal details.

---

# 5. P1: Prevent unrelated universities from being merged into one group

## Finding

`normalizeUniversityName()` in `src/utils/groupingUtils.ts` strips common prefixes and suffixes such as `University of ` and ` University`. This can collapse distinct real institutions into one key. For example, two institutions whose names normalise to `York` could be merged even if they are in different countries. The grouping key also does not consistently incorporate country or a canonical university identifier.

Country resolution appears to have overlapping logic in `src/utils/countryResolver.ts` and `src/utils/groupingUtils.ts`; the new search path uses the resolver from `groupingUtils`. Diverging country logic can make the same school appear with different country tags in different parts of the app.

## Required changes

### 5.1 Use a stable and collision-resistant grouping key

**Primary file:** `src/utils/groupingUtils.ts`  
**Related files:** `src/components/MasterTable.tsx`, `src/components/CompareView.tsx`, university/search data utilities.

- Inspect whether the current model already has a stable university/institution ID. If it does, prefer that as the primary identity key.
- If no stable ID exists, build a conservative key from a normalized institution name and a reliable country/region field when available.
- Normalization may standardise case, whitespace, punctuation, and harmless formatting, but must not remove meaningful name components in a way that merges different institutions.
- Do not merge two institutions solely because their shortened names match.
- Keep display names separate from internal grouping keys. Users should continue to see the authoritative/display name from their data.
- If an identity cannot be resolved reliably, preserve the separate entries instead of merging by assumption.
- Ensure route grouping is scoped to the correct institution; avoid merging routes across country, institution, or other identity boundaries.

### 5.2 Consolidate country resolution

**Primary files:** `src/utils/countryResolver.ts`, `src/utils/groupingUtils.ts`

- Establish one shared country-resolution function and have callers use it.
- Reuse explicit country fields from the existing records before guessing from an institution name.
- Avoid silently treating an unrecognised institution as UK solely because the resolver has no match. Use the product's existing neutral/unknown representation, or add a typed unknown state if needed.
- Keep known aliases and institution mappings covered by tests.
- Do not mass-edit existing university country data. This is a resolver correction, not a data migration.
- Check whether `src/utils/countryResolver.ts` is currently unused or only partially integrated and either wire it in consistently or remove genuinely redundant logic after confirming no caller depends on it.

### 5.3 Tests and acceptance criteria

Test at least:

- Same institution with different whitespace/casing still groups together.
- Different institutions with similar shortened names do not group together.
- Two institutions in different countries do not merge merely because their name normalises similarly.
- A stable institution ID takes precedence over fuzzy name similarity where the schema supports it.
- An unknown institution does not automatically receive an unsupported country.
- Master cards, comparisons, and search filters use the same grouping/country resolution behaviour.

---

# 6. P1: Make natural-language search preserve the user's full request

## Finding

`src/components/SmartSearchBar.tsx` uses the parser in `src/utils/nlpParser.ts`. In `handleExecuteSearch`, when at least one parser token is returned, the current flow applies the recognised tokens but can ignore `parsed.remainingText` and `parsed.didYouMean`. A compound request may therefore be partially applied while the unrecognised part is silently dropped.

The parser also tokenises input using whitespace and checks each token against aliases. This prevents multiword aliases such as `United Kingdom` from matching as a phrase. Intake recognition using substring matching can cause `Sept 2027` to match a broad `Sept` alias and lose the year-specific intention.

## Required changes

### 6.1 Preserve unparsed terms

**Primary file:** `src/components/SmartSearchBar.tsx`  
**Related files:** `src/utils/nlpParser.ts`, `src/types/search.ts`

- Inspect the full parse-result type and the component's search execution flow.
- Never silently discard `remainingText` when some tokens were recognised.
- Clearly separate three outcomes:
  1. All meaningful terms were understood and the filters can be applied.
  2. Some terms were understood but one or more meaningful terms remain unresolved.
  3. The request is ambiguous and needs the user to choose a suggestion.
- When unresolved terms remain, retain and show them in the input or display a visible message. Offer relevant suggestions when available.
- Do not automatically treat an uncertain fuzzy suggestion as a confirmed institution, country, or intake filter.
- A user should be able to correct or remove a suggested filter before it is committed.
- Preserve the existing chip-based interface and keyboard/mobile behaviour.
- Avoid showing a success state that implies the entire query was applied when only part was understood.

### 6.2 Match phrases before individual tokens

**Primary files:** `src/utils/nlpParser.ts`, `src/constants/searchDictionaries.ts`, `src/types/search.ts`

- Replace token-only alias matching with phrase/span-aware matching for multiword dictionary entries.
- Match longer, more specific aliases before shorter generic aliases, so a recognised phrase is not fragmented into conflicting filters.
- Normalise case and punctuation consistently, but do not strip meaningful digits or year information.
- Make overlap resolution deterministic. If multiple aliases overlap, choose based on documented priority (for example, longest phrase, then dictionary priority), or return an ambiguity result for the UI.
- Keep the existing dictionary-driven approach. Do not add an external AI/NLP service or a server dependency.

### 6.3 Correct intake matching

**Primary file:** `src/utils/nlpParser.ts`

- Treat month and year as separate components in intake aliases.
- A query such as `Sept 2027` must not be resolved to `Sept 2026` merely because the token `Sept` is present.
- When a year is supplied, require an exact year match in the target intake candidate.
- When a month is supplied without a year and more than one year is possible, present options or use the documented product default. Do not silently choose a stale year.
- Ensure aliases such as abbreviated/full month names are mapped to canonical month values before matching.

### 6.4 Parser result and error states

- Define and document the parser's result contract, including recognised filters, remaining text, fuzzy suggestions, ambiguity, and no-match conditions as appropriate.
- Keep the result typed; avoid loosely shaped objects or `any` casts.
- Do not treat ordinary unrecognised words as fatal errors. Preserve them and tell the user what was and was not applied.
- Keep recent-search and filter-chip behaviour consistent between enter-key submission and clicking a suggestion.

### Regression tests and acceptance criteria

Add tests for:

- A fully recognised single-filter query.
- A compound query with multiple recognised filters.
- A compound query with one recognised filter plus one unresolved university qualifier.
- A multiword country alias such as `United Kingdom`.
- Multiword aliases such as `direct application` where that alias exists in the dictionary.
- `Sept 2027` versus `Sept 2026`.
- Month aliases with different casing and punctuation.
- Ambiguous fuzzy matches: no suggestion is silently committed.
- Enter key and selection-button execution apply the same filters.
- `remainingText` remains visible or otherwise recoverable after partial parsing.

---

# 7. P1/P2: Reduce natural-language parser cost for large directories

## Finding

`src/utils/nlpParser.ts` performs school matching with repeated array searches and fuzzy-distance checks. The parse is called from the search component when `localInput` or `rates` changes. With a large number of rate rows, repeated normalisation, `rates.find()` calls, and Levenshtein checks can cause avoidable work while users type.

## Required changes

**Primary files:** `src/utils/nlpParser.ts`, `src/components/SmartSearchBar.tsx`, `src/constants/searchDictionaries.ts`

- Profile the parser or use focused test/benchmark fixtures to confirm the main costs before optimising.
- Build a reusable index of normalised university, country, intake, and aggregator names from the loaded data rather than scanning every rate row repeatedly for every term.
- Deduplicate institution names before fuzzy matching.
- Build indexes when the underlying rate dataset changes, not for each keystroke.
- Cache or memoise expensive deterministic normalisation/dictionary work where it is safe to do so.
- Avoid computing a full Levenshtein matrix for clearly unrelated or excessively long tokens. Apply a documented input bound and length/distance pre-checks while preserving useful spelling correction.
- Keep parsing deterministic for identical input and dataset.
- Do not add dependencies unless measurements demonstrate a clear benefit and the dependency fits the existing bundle and maintenance constraints.
- The optimisation must preserve the phrase-aware and intake-year correctness rules in Section 6.

## Tests and acceptance criteria

- Add a large fixture with many rate rows but repeated institution names; assert the parser returns the same semantic result as the small fixture.
- Ensure the parser does not repeatedly rebuild the full index for each input character when the dataset is unchanged.
- Add a performance-oriented benchmark or a bounded-cost test if the project has an appropriate convention. Avoid brittle tests that fail due to normal machine timing variance.
- Manually verify responsive typing with a realistic large dataset after the implementation.

---

# 8. P1: Route canonical rate changes through the existing write service

## Finding

`src/components/MasterTable.tsx` contains inline edit handlers such as `SchoolStatusCell.handleUpdateStatus` and `AggregatorRouteCell.handleUpdateAggregator` that update canonical `rates` documents directly with `updateDoc`. The existing `src/services/adminRateWriteService.ts` is the central write path for canonical rate changes and coordinates related projections, audit/activity data, feeds, and user updates.

A direct write can bypass that existing application workflow and leave other views/projections stale or miss the expected change history.

## Required changes

**Primary files:** `src/components/MasterTable.tsx`, `src/services/adminRateWriteService.ts`

- Inspect all mutation handlers that edit canonical rate data, including status, aggregator, and any similar inline control.
- Route canonical rate mutations through the existing write-service abstraction instead of calling `updateDoc` directly from presentation components.
- If the service lacks a required operation, extend it using the current project patterns. Keep the mutation semantics consistent with existing writes.
- The component should handle loading, success, validation errors, and write failures without showing a false success state.
- Keep optimistic UI behaviour only if the current implementation can revert cleanly on failure. Otherwise update the UI after confirmed success.
- Avoid duplicating projection, feed, or history update logic inside the component. The write service should remain the single orchestrator for these domain mutations.
- This is a consistency fix to the existing application write path. Do not change authentication, Firestore rules, or the client-side deployment model as part of it.

## Tests and acceptance criteria

- A successful inline status edit uses the central write service.
- A successful aggregator edit uses the central write service.
- A failed write leaves the displayed state consistent with persisted state and shows a useful error message.
- Existing related projections and change-feed behaviours are covered by service tests or existing integration tests.
- No canonical-rate `updateDoc` call remains in these targeted presentation handlers unless there is a documented and tested reason.

---

# 9. P2: Improve the personal workspace role/organisation badge

## Finding

`src/components/PersonalWorkspaceWidget.tsx` uses a hard-coded `SI-UK Ghana Partner` fallback for the Agent badge. This can show a specific organisation that does not belong to the current user.

## Required changes

- Inspect the actual user/profile/org data types and existing display conventions.
- Derive the organisation/partner label from the current user's available profile data where it exists.
- If the organisation is not available, use a neutral generic label such as `Agent`, `Partner`, or the existing role label. Do not invent a specific partner name.
- Handle long organisation names without breaking the widget layout on desktop or mobile.
- Add tests for a named organisation, missing organisation, missing display name, and fallback role.

**Acceptance criterion:** No user is shown a partner name hard-coded for another organisation.

---

# 10. P2: Make favourite-school update alerts accurately describe the change

## Finding

`src/services/userUpdates.ts` can return updates that concern guidance as well as rates. `src/components/ChatExperience.tsx` currently presents the notification as if rates were updated in every case. The result is misleading when the underlying change is a guidance update or another supported update type.

## Required changes

**Primary files:** `src/services/userUpdates.ts`, `src/components/ChatExperience.tsx`

- Inspect the supported update types and their actual payload shape.
- Use the update's real type to choose an accurate notification message. Do not say “rates updated” for guidance-only updates.
- If an update contains multiple change types, use a truthful combined label, or present separate items if that better matches the existing UX.
- Keep the institution name and relevant date/context if already available; do not fabricate a changed rate if the payload does not contain one.
- Verify how older records without `affectedSchoolIds` are handled. If the current data model supports reliable name-based fallback matching, use a normalised, collision-conscious match; otherwise show the update only when the relationship is reliable. Do not introduce broad fuzzy matching that could attribute one school's update to another school.
- Ensure an update does not appear repeatedly just because the user opens the chat again, consistent with the existing seen/unseen data model.

## Tests and acceptance criteria

- A rate update produces a rate-specific notification.
- A guidance update produces a guidance-specific notification.
- An unknown update type uses a neutral fallback label.
- Legacy updates are matched only when the school relationship is sufficiently reliable.
- Seen/unseen behaviour remains consistent with the current product design.

---

# 11. P2: Remove avoidable TypeScript escape hatches

## Finding

The reviewed code still contains `any`-style casts, including in `src/components/RoleDashboardView.tsx` and `src/hooks/useSystemConfig.ts` (for example, an `intakeLifecycles` cast). These hide schema mismatches and make future changes more fragile.

## Required changes

- Search the current source for `as any`, explicit `any`, and equivalent unsafe type escape hatches in files touched by this plan.
- Prioritise the casts in `RoleDashboardView.tsx` and `useSystemConfig.ts` that intersect with the intake/config work above.
- Define the proper type for dashboard state, role-specific data, lifecycle configuration, and any callback payload that is currently cast.
- Use runtime validation/narrowing where data is external or can be malformed; TypeScript compile-time types alone do not validate Firestore data.
- Do not expand this ticket into a repository-wide type rewrite. Fix touched paths and any additional obvious casts discovered in their direct call chains.
- If a type cannot accurately be established from the source, leave a clear TODO with an explanation rather than inventing a broad type.

**Acceptance criterion:** The touched code compiles without `any` casts being used to silence the fixed issues, and existing valid dashboard/config states retain their behaviour.

---

# 12. P2: Fix smaller comparison and configuration edge cases

Resolve these where applicable after the priority items above.

## 12.1 “Best by level” must preserve the intake dimension

**File:** `src/components/CompareView.tsx`

The reviewed aggregation can combine rows across different intakes while labelling the result as best by study level. Check the full aggregation key and its output label. Do not combine periods into one result unless that is explicitly intended and clearly communicated. Add a test with two intakes for the same level and different rates.

## 12.2 Flat-fee currency must not be hard-coded

**File:** `src/components/CompareView.tsx` and any shared formatter it uses

Use the rate's real currency, consistent with Section 3. Ensure the currency switcher and all comparison representations agree about how a value is displayed. Do not perform foreign-exchange conversion unless there is an existing, defined conversion basis.

## 12.3 Active intake arrays may be intentionally empty

**File:** `src/hooks/useSystemConfig.ts`

Implement the missing-versus-empty distinction described in Section 4.3 and cover it with tests. Do not fix this by inventing a default active intake when the configured value is deliberately empty.

## 12.4 Consolidate duplicated country resolution

**Files:** `src/utils/countryResolver.ts`, `src/utils/groupingUtils.ts`

Complete Section 5.2. Make sure search chips, grouped cards, and comparison view use the same resolver rather than subtly different fallback rules.

## 12.5 Keep alert messages aligned with update types

**Files:** `src/services/userUpdates.ts`, `src/components/ChatExperience.tsx`

Complete Section 10 and test every currently supported update type.

---

# 13. P3: Tests, CI, and repository documentation

These are process/quality tasks, not security remediation. Implement only in a way consistent with the project's existing GitHub setup.

## 13.1 Establish a repeatable check sequence

The reviewed `package.json` included these scripts:

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:rules` (Firestore emulator-based test command)

Confirm the scripts are still present and inspect the test configuration before running them. At minimum, run lint, unit tests, and build after changes. The rules test may be run as a verification step, but this plan does not author or alter Firestore rules.

Record the actual result of each command in the implementation summary, including failed tests that pre-date the changes. Do not change unrelated tests simply to make the suite green.

## 13.2 Add or repair continuous integration if the repository has no existing workflow

The audit baseline had no `.github/workflows/` workflow files and the README contained a static “Build Passing” badge. Verify the current branch before acting.

If CI is still absent, add a minimal GitHub Actions workflow that:

1. Uses the Node version supported by the repository's current dependencies and documentation.
2. Installs dependencies reproducibly from the lockfile.
3. Runs lint, unit tests, and the production build.
4. Reports a clear failed status when any required step fails.
5. Does not print secrets or depend on a deployed Firebase project for the basic checks.

If Firestore emulator tests are added to CI, configure them according to the repository's existing test harness; do not rewrite the rules test suite as part of this non-security task. Keep CI configuration minimal and avoid adding unnecessary paid services.

Replace or remove a static build badge if it makes an unverified claim. If a dynamic workflow badge is used, ensure its URL and workflow name are correct.

## 13.3 Correct stale TypeScript documentation

The README at the audit baseline showed a TypeScript badge for version `5.0`, while `package.json` declared a TypeScript dependency around `6.0.2`. Verify the current files and either update the badge to match the actual supported project version or remove the badge if it is not maintained. Do not upgrade or downgrade TypeScript solely to match a badge.

## 13.4 Update documentation only for actual behaviour changes

- Describe search behaviour, grouping, intake labels, and commission comparability only after they are implemented and tested.
- Do not claim the app supports a feature that remains incomplete.
- Keep documentation concise and consistent with the UI wording used by staff.

---

# 14. Scope exclusions and deferred findings

The following areas are intentionally excluded from this implementation plan. **Do not modify them in this task.** They were separated from the functional fixes at the product owner's direction.

- Authentication, role/permission policy, account eligibility, and account disablement enforcement.
- Firestore Security Rules, security model changes, or any server-side authorization work.
- Security-related dependency upgrades or vulnerability remediation.
- HTML/print/export injection remediation.
- Repository secrets, local session artefacts, and Git history cleanup.
- Moving the application to a server, backend, API, Cloud Functions, or other server-side architecture.
- Firebase plan changes, paid infrastructure, or a new hosting/deployment model.
- Cross-user browser storage/privacy corrections identified during the audit. These are intentionally deferred because they overlap with the excluded account/privacy scope.

One functional issue was observed around system configuration document access: the currently reviewed rules did not have specific matches for the `system_config`/`settings` paths used by `src/hooks/useSystemConfig.ts`. Resolving this may require a Firestore rules change, which is excluded here. The agent should not weaken or alter the rules to make the feature work. If the relevant configuration operations still fail at runtime, record the exact failing operation and document it as an unresolved, out-of-scope dependency for a separate decision.

Security exclusions do not permit the agent to introduce new security regressions. Preserve existing code and configuration behaviour outside the explicit functional changes in this plan.

---

# 15. Definition of done

The work is complete only when all applicable conditions below are satisfied:

- [ ] No invalid cross-unit commission rankings remain in `CompareView`, `groupingUtils`, or conversational comparison output.
- [ ] Percentage and flat-fee values display with the correct unit and currency.
- [ ] Historical intakes are classified by month and year when the label supports it, and are never falsely labelled active merely because no current rows exist.
- [ ] An intentionally empty configured active-intake list is not ignored in client state.
- [ ] Similar institution names cannot merge unrelated universities because of over-aggressive normalisation.
- [ ] Country resolution is shared and does not silently default unknown institutions to an unsupported country.
- [ ] Natural-language search does not silently discard unresolved parts of a query.
- [ ] Multiword aliases and year-specific intake searches work deterministically.
- [ ] Parser work is bounded and indexed for large datasets, without regressing accuracy.
- [ ] Inline canonical rate edits go through the existing write service and produce consistent downstream application state.
- [ ] Workspace organisation labels and favourite-school update messages reflect actual user/update data.
- [ ] The touched code avoids new `any` casts and has meaningful regression tests.
- [ ] Lint, tests, and build have been run, and results are recorded accurately.
- [ ] No security rules, authentication, account policy, or server-side architecture changes have been made as part of this task.
- [ ] The final report lists changed files, design choices, tests run, results, known remaining issues, and any work deliberately deferred.

---

# 16. Required final report from the coding agent

When finished, return a concise but sufficiently detailed report with these sections:

1. **Summary:** what was fixed and what was not changed.
2. **Files changed:** each file and the reason it changed.
3. **Financial-integrity changes:** comparison rules and how non-comparable values are represented.
4. **Search and intake changes:** parser semantics, month/year handling, and unknown-term behaviour.
5. **Grouping changes:** university identity and country resolution.
6. **Write-path and notification changes:** central write service, workspace label, and update message behaviour.
7. **Tests and commands:** exact commands run and their actual pass/fail status.
8. **Remaining issues:** include the system-configuration/rules dependency if it is still reproducible, plus any other verified issue that was intentionally excluded.
9. **Scope confirmation:** explicitly confirm that no security rules, authentication policy, server-side architecture, or unrelated redesign changes were made.

Do not mark a finding as fixed merely because code was edited. Tie each completed item to a regression test, a verified manual check, or both.

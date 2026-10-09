# Progressive Chat Filtering Design

## Goal

Let Admin, Staff, and Agent users progressively narrow locally available school and route results through natural language, without losing their current search scope. The chat should show broad results first, then suggest useful next filters, while supporting typed filters, clickable totals, and role-appropriate data.

## Agreed interaction

1. A broad request such as “all universities in UK” returns all matching local routes and schools immediately. A broad count returns the count across all matching records in the available dataset, across available intakes and levels.
2. The assistant offers a relevant next filter only when that filter can refine the current results. The normal sequence is intake/year, aggregator, then other available dimensions such as study level or guidance. Users can skip steps by typing a filter directly. Broad searches do not block results with a mandatory clarification first.
3. Applying a filter updates the current result set and offers the next useful filter. The flow stops when no useful filter remains or when the result set is empty.
4. Route and unique-school totals remain visible. Clicking a total opens the current scoped results and focuses the chat composer; the user can enter another filter without losing the scope.
5. “From 2021 to 2025” means intake cycles whose start year falls within 2021 through 2025 inclusive. Available result data is the source for date and facet choices.
6. Users may choose multiple aggregators. Within the aggregator facet, selected aggregators are alternatives; across different facets, filters combine to narrow results.
7. Aggregator matching prioritizes exact names from the user’s available data. A likely spelling correction is proposed for confirmation, never silently applied. Ambiguous candidates are shown as choices.
8. Aggregator filters and fields remain governed by existing role access. Local/offline queries use the same filter behavior against the locally available dataset.

## Filter state and query model

Represent the active scope as a structured set of optional filters rather than rebuilding it from a single prior sentence. The state includes country, intake or inclusive intake-year bounds, study level, guidance, and one or more aggregator identifiers/names. Keep the current result IDs or enough intent to deterministically re-run the query against the current local rate set.

A new unrelated search starts a fresh filter scope. Explicit follow-up language or selecting a filter choice continues the current scope. Each turn merges newly recognized filters into the existing scope, while preserving all other selected dimensions. A user can add an intake and aggregator in one message; the parser should not require the suggested order.

Each follow-up prompt is based on the distinct values present in the current result set. Do not ask for a facet when only one value is available or when the user cannot access it. The current result set is recalculated after every added filter. Empty results stop the sequence and return a short explanation plus safe suggestions to broaden the search or remove a filter.

## Parsing, vocabulary, and ambiguity

Extend the local query vocabulary with:

- Inclusive year ranges and common ways to express them: “2021 to 2025,” “between 2021 and 2025,” and “from 2021 through 2025.”
- Intake wording, season/month labels, year ranges, and common misspellings. Correct likely mistyped years only against years actually present in available intake data and ask the user to confirm.
- Aggregator references, common punctuation/spacing variants, and common misspellings.
- Conversational continuation cues that preserve the current scope while adding a filter.

Resolve entity names against the accessible local records, not a hard-coded external directory. Prefer exact matches. A single close match becomes a confirmation choice; multiple close matches require the user to choose; no safe match prompts for a corrected name or offers available choices. Apply this conservatively to aggregator names and intake/year values so a correction is never silent. Country aliases should resolve to the country labels represented in the current data.

For a year range, parse the intake-cycle start year from supported labels such as “2021 - 2022,” “September 2021,” or “Autumn 2021.” Include cycles whose start year is between the requested bounds, inclusive. If a label has no parseable year, it does not match a numeric year-range filter and should not be silently assigned a year.

## Results and UI

Keep the chat as the primary flow. After an initial broad result, show a concise count and the next available filter as a prompt with choices where practical. Choices are data-driven: available intake values/ranges, aggregators, levels, and guidance statuses are drawn from the active results and role permissions.

Make route and unique-school totals actionable. Activating either total opens the matching results view and focuses the existing chat composer. The user’s active filter state remains intact so the next message continues narrowing those results. The result view should identify the applied scope in plain language, including the year range and selected aggregators when present.

## Access, offline behavior, and data boundaries

Do not add a network query for natural-language filtering. Use the local route set already supplied to ChatExperience, whether it came from a fresh online sync or the saved offline database. Preserve existing role filtering: Agent queries cannot reveal aggregator/routing fields; Staff cannot reveal payout fields; Admin retains its current access. Counts must be computed after the accessible local dataset and role rules are applied.

This feature cannot claim a national or complete school count beyond the local dataset. Wording should describe results as schools/routes in the available data and show the active scope.

## Failure and edge cases

- A range with reversed years asks the user to correct it rather than returning misleading results.
- A year range with no dated intake labels returns no matching dated routes and suggests available intake years.
- A likely misspelled intake or aggregator is confirmed before applying.
- Several aggregator names in one request are OR alternatives within the aggregator facet.
- A filter that yields zero routes stops follow-up suggestions and offers the last useful broader scope.
- If no additional filter values are available, give results without a redundant follow-up prompt.
- A new explicit country/school search resets unrelated filters; “same,” “also,” and selected filter chips preserve them.
- A click on a school total drills into that school subset; a click on a route total opens all routes in the active scope.

## Out of scope

- Adding new school, intake, or aggregator records to the database.
- Changing Firestore query architecture, schema, or role security rules.
- External/global school directory lookup or internet-based autocomplete.
- Applying guessed corrections without the user’s confirmation.
- Replacing the chat with a separate structured filter panel.

## Success criteria

- “All universities in UK” shows all matching local results and offers only filters that can refine that result set.
- A year range such as 2021–2025 includes only route intakes whose parsed start year is within that inclusive range.
- Intake, aggregator, level, and guidance filters can be added in separate turns or together without losing earlier filters.
- Multiple aggregators use OR semantics within their facet; other facet types narrow the result set together.
- Clicking route or school totals opens the matching scoped results and focuses the composer while preserving filter state.
- Fuzzy entity matching confirms likely corrections before applying them.
- The follow-up sequence stops at zero results or when no useful facet remains.
- Results and counts use only locally available, role-appropriate records.

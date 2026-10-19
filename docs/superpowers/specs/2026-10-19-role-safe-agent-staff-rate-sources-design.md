# Role-Safe Agent and Staff Rate Sources

## Goal

Make the Agent and Staff dashboards consume only the role-specific Firestore data intended for them. An Agent must see the Admin's Basechan/Direct sub-agent payout for the exact university, study level, and intake. A missing payout must never be replaced by a third-party aggregator rate. Staff must see routing information without payout, master-rate, or margin data.

This change corrects data ownership and display behavior. It does not attempt to reduce Firestore reads or writes; read-cost optimization is a later task.

## Current behavior

- `useCommissionRates` loads `rate_sheets` for every role. Those documents contain canonical `CommissionRate` records.
- `buildDashboardRates` chooses a Focus row before the Agent-specific Basechan route, then falls back to the first route if no Basechan route exists.
- Agent projections currently contain payout values from every aggregator while omitting the aggregator field, making third-party payouts indistinguishable from the sub-agent payout.
- Staff has a role-specific `staff_rates` projection, but the shared rate-sheet sync can still download canonical financial fields to a Staff client.
- Firestore rules allow all signed-in users to read `rate_sheets`; the Staff rule also accepts a broader set of email matches than the app's Staff role resolver.

## Design

### Data sources by role

- **Admin:** keep using the canonical `rates` and existing Admin cache path.
- **Staff:** use the existing role-scoped local sync over `staff_rates` and Staff update feeds. The Staff read model contains school, intake, level, aggregator, guidance, and routing notes, with no master rate, agent payout, or margin.
- **Agent:** use the existing role-scoped local sync over `agent_rates`, the approved Agent's organization rates, that Agent's personal overrides, and Agent update feeds. Do not load Agent data from `rate_sheets` or canonical `rates`.
- Keep local caches scoped to the signed-in UID and role. Staff and Agent cache hydration must not consume the shared/global canonical sheet cache.

### Agent payout projections and selection

- Populate shared `agent_rates` only from canonical Admin records whose aggregator identifies the Basechan/Direct sub-agent payout. Do not write third-party route payouts to the Agent default projection.
- Keep explicit organization and personal Agent overrides, with their current precedence, but apply them only to a canonical sub-agent payout record.
- Select and display rates by exact university ID, study level, and intake. Do not prefer `FOCUS` over the sub-agent payout, search a different intake for a replacement rate, or fall back to the first available route.
- Build the Agent school list from the non-financial `universities` directory and join eligible payout rows by university ID. A university with one sub-agent payout displays one rate. A university with no eligible payouts remains discoverable and displays “No rate for this school”; a missing level or intake does not create a substitute route.
- Staff's existing Focus-route then top-yield routing behavior remains unchanged.

### Firestore access rules

- Change `rate_sheets` reads to Admin-only; keep its writes Admin-only.
- Keep the current `staff_rates`, `agent_rates`, organization override, personal override, and role-feed boundaries.
- Align the Firestore Staff identity check with the Staff email format recognized by `resolveUserAccess` (`*.basechaninternational@gmail.com`). Agent reads continue to require an approved Agent request and matching organization for organization-scoped records.
- Keep the signed-in university directory limited to non-financial identity fields; it supports school-level empty states but must not carry commission values.

### Existing data migration

- Version the role-rate-model migration so an Admin can rebuild `agent_rates` from canonical rates once after deployment. The rebuild removes third-party rows from the Agent default projection and retains only eligible sub-agent payout rows, respecting sheet visibility.
- Use the existing Admin-only role-rate-model migration mechanism for the one-time rebuild. Do not add per-reload projection writes or routine startup migrations.
- Existing explicit organization/personal overrides for third-party canonical rows are excluded from Agent results after the change; the assignment path must not create new such overrides.

## Out of scope

- Reducing Firestore read/write counts, adding pagination, or changing the broader cache and bucket strategy.
- Changing Staff route selection rules or Admin canonical rate records.
- Removing organization or personal Agent override features for eligible Basechan/Direct payout records.
- Changing the Admin dashboard or commission calculations.

## Acceptance criteria

1. Admin, Staff, and Agent rate loading paths are distinct at the Firestore data-source boundary.
2. A Staff client never requests or caches canonical `rate_sheets`/`rates` data; its displayed model has no master rate, agent rate, or margin fields.
3. An Agent's default payout rows originate only from Basechan/Direct Admin sub-agent records and approved Agent override layers.
4. For a given university, level, and intake, the Agent sees that exact payout if present; otherwise no third-party or cross-intake substitute appears.
5. The Agent school directory includes schools with no eligible payout and shows “No rate for this school”; a school with one eligible payout shows exactly one rate.
6. Staff still sees Focus/top-yield routing guidance and no commission amounts.
7. Firestore rules deny non-Admin reads of `rate_sheets` and reject Staff identity matches that the application does not recognize as Staff.
8. Existing Admin read behavior and role visibility/override semantics for eligible Agent payouts remain intact.

## Verification plan

- Add focused tests first for exact Agent payout selection, no fallback on missing levels/intakes, role-specific sync source selection, Admin/Staff/Agent projection contents, override eligibility, and empty-state behavior.
- Verify Firestore rules with emulator tests for canonical bucket access, exact Staff identity matching, and existing Agent organization/personal scoping.
- Run the project unit suite and production build after implementation. Report any Firestore read/write impact separately; performance optimization is intentionally deferred.

## Design assumptions and risks

- Basechan and Direct (including a documented direct alias, if present in the canonical data) identify the Admin-managed sub-agent payout. Third-party aggregators do not.
- Explicit organization/personal overrides remain intentional exceptions to the shared payout, but they must be based on an eligible Basechan/Direct record.
- Switching Staff and Agent from bucket documents to per-record role read models may change cold-start read counts. No read-count target is part of this change.
- The one-time Admin projection migration writes the rebuilt Agent read model; it is an upgrade action, not a per-reload operation.

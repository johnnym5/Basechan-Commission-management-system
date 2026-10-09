# Agent and Staff Chat Search Design

**Status:** Implemented in the current checkout; review implementation notes below before deployment.
**Date:** 2026-10-09

## 1. Purpose and scope

Add a personalized, natural-language chat experience for Agents and Staff to find and compare the schools and rate information they are already allowed to see. Keep Admin's existing dashboard and add a header switch to move between Dashboard and Chat. The feature includes account-linked chat history, Favorites, role-scoped Updates, organization approval for Agents, and secure role-specific Firestore read models.

This design does not add Cloud Functions, an external LLM, PDF generation, or Admin natural-language write commands. Admin rate and data edits continue through the dashboard. Chat is for discovery, filtering, clarification, and comparison.

## 2. Roles, organizations, and access

### Role identification

- Admin status comes from the trusted `@basechaninternational.com` email domain, as clarified by the product owner. `users.role` is not a security authority.
- Staff is identified by a normalized Gmail address whose local part ends in `.basechaninternational`, such as `name.basechaninternational@gmail.com`. Staff does not require organization approval.
- Other users outside the Admin and Staff domains are Agents.
- Every user at the Admin domain receives the full Admin access currently provided by the Admin dashboard.

### Agent organization approval

- Each Agent account is associated with one organization in v1.
- During Google sign-up, an Agent selects an existing organization from a dropdown or requests that Admin add a missing organization.
- Only Admin can create organizations.
- Selecting an existing organization still creates a pending access request. The Agent cannot see rates until Admin approves the request.
- Existing Agent accounts must complete the same organization request and approval flow as new Agent accounts. Existing access is not grandfathered around approval.
- User Management shows pending, approved, rejected, and revoked requests. Admin can approve or reject; a rejected request can later be approved; approved access can later be revoked. The Agent sees the current request status.
- Pending, rejected, and revoked Agents cannot read Agent rate data.

### Rate precedence and administration

For an approved Agent, the effective rate is resolved in this order:

1. Agent-specific override.
2. Organization override.
3. Shared default Agent rate.

Admin can change rates for one Agent, an organization, selected Agents, selected organizations, or all organizations. When applying broader changes, Admin chooses whether to preserve specific Agent overrides or replace them. Admin can clear a specific override to restore inheritance from the organization or shared default. Staff route information remains distinct from Agent payout data.

## 3. Firestore security and read models

There are no server functions. The client reads role-specific projections, and Firestore rules enforce access independently of UI visibility.

- Keep the canonical full rate records Admin-only.
- Provide a Staff read model containing school/intake/level data, routing and aggregator details, and applicable guidance. It excludes Agent payout values.
- Provide an Agent read model containing school/intake/level data, effective Agent payout values, and applicable guidance. It excludes Staff-only routing and aggregator details.
- Keep organization and Agent override data protected so an Agent can read only their own effective rate data and approved organization context.
- Enforce Admin access through the trusted Admin domain; enforce Agent approval and organization membership in rules; enforce Staff role access using the agreed domain identity.
- Restrict self-service writes to profile and request fields. Users cannot self-assign role, organization approval, or access state.
- Revoke access in the rules-backed read path and clear role-sensitive UI state on sign-out, account change, and access revocation. Cached data must not be presented as current authorized data after these transitions.
- Route Admin rate edits and imports through shared role projection synchronization and relevant update fanout. Projection writes are chunked below Firestore's 500-operation limit; cross-collection changes remain client-side multi-step operations and should be monitored for partial failure.
- Backfill both projections from canonical rate data before enabling the new role-specific reads. The import utility syncs role models in bounded chunks.

## 4. Page and navigation design

### Agents and Staff

- Provide a dedicated chat-first page; hide the existing directory/search controls and always-visible school cards.
- Retain the current role banner and all three existing count tiles at the top (institutions, Focus, restricted), with each role's current visibility rules.
- Show school and search results only when the user asks for them.
- Keep Chat, Favorites, History, and Updates available in a persistent side section that can collapse responsively.
- Preserve the product's existing visual language.

### Admin

- Keep the existing dashboard.
- Add a header switch between Dashboard and Chat.
- Admin Chat can use the same search and comparison interaction, with Admin's authorized full-data view. Admin dashboard editing remains separate from chat.

## 5. Search and conversation behavior

### Natural-language parsing

- Parse locally and deterministically; do not send queries to an external model or server function.
- Support deterministic English keyword parsing for school, country, study level, intake, Focus/restricted status, Agent payout, Staff routing/aggregator details, and guidance, subject to the current role's data access.
- Use exact and partial school-name matching; when the name is uncertain, ask the user to check it rather than silently choosing another school. A full alias dictionary and typo correction are follow-up work.
- Recognize search, filter, compare, follow-up, and guidance intents. Preserve the selected school and current conversation context for follow-ups such as “compare this with X.”
- Keep the assistant within the Basechan school/rate/guidance domain and politely redirect unrelated requests.

### Clarification and defaults

- Ask a concise follow-up when a broad or ambiguous request needs more detail to produce a useful result. Offer interactive choices where practical.
- For a named school without an intake, choose the nearest future intake for that school. If none exists, use its newest available intake record; if that cannot be determined, use the nearest current intake.
- Ask which study level when a named-school query omits level and the available records require a level choice.
- A comparison of up to four schools requires a common intake and study level. Ask for missing values rather than comparing mismatched records.
- Do not rank results unless asked. For a large match set, show the count, a small preview, and useful refinement suggestions.

### Results and comparison

- Render results as interactive school cards within the conversation.
- Cards expose role-appropriate information and actions such as opening details, favoriting, selecting for comparison, or viewing all matches.
- “View all” opens a full results view with the chat composer pinned at the top. It must support the entire result set (including hundreds of matches), with practical pagination or incremental loading.
- Compare up to four schools in a matrix for the same intake and level. Agents see Agent payout values and Staff see route/aggregator details and guidance. Do not imply that unlike fee types (for example, a percentage and a flat fee) are directly comparable through arithmetic. Make unavailable or missing values explicit.

## 6. Conversations, limits, and personalization

- Chat history, current conversation state, and Favorites are linked to the authenticated account and sync across devices.
- Keep at most five conversations per account. Creating a sixth removes the oldest conversation.
- Limit a conversation to 50 user queries/turns. A normal visit is expected to be short, but context persists across visits until the limit or retention rule applies.
- On return/login, offer to continue the previous conversation or start a new one and show where the user left off.
- Keep prior conversations visible in History. The active conversation carries the immediate context used for follow-up questions.
- Sanitize input and enforce a maximum query length of 500 characters and a rate limit of 10 queries per minute.
- Begin preference suggestions after 10 queries, then continue refining them as more history accumulates. Learn from deterministic signals such as frequently viewed/favorited schools, countries, levels, and intakes. Suggestions remain optional and never silently apply filters.
- Keep compact learned preferences separate from the five retained conversations so older conversation removal does not erase the preference signal. Provide a way to clear learned preferences.
- Use the existing Firestore offline persistence where possible. Show when cached results may be stale; offline support does not grant access to data the current account is no longer authorized to read.

## 7. Updates

- Provide a persistent Updates section with an unread badge.
- On return, summarize unread updates briefly.
- Each notice represents an Admin action and can summarize grouped changes, such as “7 schools moved to Focus.”
- Clicking a notice opens the affected, role-tailored school results and marks the notice as read.
- Deliver only changes relevant to the user's role, organization, approval state, and individual assignment. Agent notices may include relevant payout, guidance, intake, and Focus changes; Staff notices may include relevant routing, aggregator, guidance, intake, and Focus changes. Never reveal fields the recipient cannot otherwise read.
- Individual Agent changes notify only that Agent; organization changes notify approved Agents in that organization; broad changes notify the affected approved Agents; shared guidance/intake changes go to the relevant roles.
- Persist notice read state per user account.

## 8. Out of scope

- Cloud Functions or other server-side functions.
- External LLM or sending user queries outside the application.
- Chat-driven Admin edits, staged commands, undo/redo, or time-travel editing.
- PDF generation.
- Replacing the Admin dashboard or removing its existing editing workflow.

## 9. Implementation notes and known limits

- Firestore uses `staff_rates`, `agent_rates`, sparse `organization_agent_rates` and `agent_rate_overrides`, and per-user records under `users/{uid}`. Role projections and migrations run in the Admin client; there are no Cloud Functions.
- Admin login automatically initializes role projections from canonical rates once. It also migrates old override IDs, removes organization copies that duplicate shared defaults, and offers a manual rebuild action in User Management. Projection document IDs are stable opaque hashes of canonical rate IDs so schools with multiple routing records remain distinct without placing aggregator names in Agent document IDs.
- Canonical Admin rate writes use bounded batches, an idempotent operation record, saved mutation details, deterministic audit IDs, grouped notices, and a resume action. Incomplete operations still in `preparing` can be discarded safely before canonical writes; incomplete operation detail is retained only until completion.
- Organization and individual Agent assignments use sparse override documents. Individual overrides can be cleared in User Management to reveal the organization's rate or shared default. Explicitly replacing organization rates clears only selected Agent overrides.
- Creating the sixth conversation deletes the oldest. Five are retained; compact preferences remain in the account profile and can be cleared without removing Favorites or conversation history.
- Admin keeps the dashboard and switches to Chat from the header. Agents and Staff use a dedicated Chat-first page with their role banner and count tiles; role-scoped navigation keeps Chat, Favorites, History, and Updates available.
- Natural-language parsing is deterministic, local, and English-only. It handles known and partial school names, country, level, intake, guidance, role-visible payout or routing filters, comparison, follow-up context, ranking only when requested, out-of-scope redirection, and conservative one-character typo suggestions that require confirmation. It does not use an external model or silently apply suggestions.
- Clarification is text-based with selectable level buttons. Results appear as interactive cards in the conversation; full results show 24 at a time with the composer pinned above them. Comparisons are capped at four schools and require a common intake and level.
- The client enforces message length and conversation limits. A Firestore rules-backed set of ten server-timestamped slots enforces the rolling one-minute account query cap, including across new conversations. This design does not provide billing-grade abuse controls for arbitrary Firestore writes.
- Chat shows an offline/stale-data notice but does not label individual cached results with Firestore freshness metadata. Role access rules and live access listeners still revoke current access when an Agent is rejected or revoked.
- Update fanout re-checks current approved Agent and Staff recipients, filters affected schools against each role's sheet visibility, omits payout-only changes from Staff notices and routing-only changes from Agent notices, and uses operation-derived IDs for retry safety. A large fanout can still be partial if the Admin client stops mid-run; resuming the same operation retries the notice path.

## 10. Acceptance outcomes

- An unapproved or revoked Agent cannot read payout data, even by direct Firestore query.
- Existing and new Agents use the same organization request and approval flow.
- Staff can read routing details but cannot read Agent payout fields; Agents can read their authorized payout fields but cannot read Staff-only routing fields.
- Admin can change individual, organization, selected-group, and global rates while explicitly preserving or replacing more-specific overrides.
- Agents and Staff can search, clarify, inspect full result sets, favorite schools, and compare up to four schools using role-appropriate data.
- Chat state, Favorites, learned preferences, and update read state remain associated with the user's account.
- Update notices show only relevant authorized changes and opening a notice marks it read.
- The existing Admin dashboard remains available with a header switch to Chat.

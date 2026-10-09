# Role-Aware Dashboards and Shared Chat FAB

**Status:** Approved for specification; awaiting user review before implementation planning.

## 1. Goal

Give Admin, Staff, and Agent the same responsive dashboard structure and a shared bottom-right Chat entry point. Dashboard content, filters, metrics, and route details must respect each role's existing access limits. Chat and dashboard filters must stay synchronized so users can search conversationally and then inspect the same result set in the dashboard.

## 2. Approved product decisions

- All three roles use the same dashboard layout and a bottom-right Chat floating action button (FAB).
- The Admin Dashboard/Chat header switcher is replaced by the Chat FAB. Admin navigation to backend pages remains available to Admin.
- Staff and Agents land on the dashboard and do not receive backend navigation.
- Chat opens in a right-side panel on desktop and a modal popup view on mobile.
- A clear Chat search updates dashboard filters immediately. “View on dashboard” closes Chat and brings the filtered results into view.
- Dashboard filters are available as context for Chat follow-ups.
- Staff sees routing and guidance data without payout figures. Agents see organization-approved routes and their effective payout without Admin margin data. Admin retains the full dashboard.

## 3. Shared dashboard structure

All roles share the page hierarchy and responsive behavior:

1. Overview hero with role-appropriate title and explanation.
2. Four compact KPI cards using the same card sizing, responsive grid, and interactions. The metrics and labels are role-specific.
3. A role-aware analytics and guidance section with clickable summary items.
4. A shared search and filter toolbar with active-filter chips and a clear-all action.
5. A role-safe route results view with pagination and an empty state.
6. A persistent Chat FAB that opens the shared conversational search panel.

Admin keeps its existing profit and margin analytics, editable `MasterTable`, and Admin-only actions. The shared presentation does not grant Staff or Agents Admin table fields or actions.

### Staff dashboard content

- KPIs: visible routes, universities, countries, and Focus schools.
- Analytics: route distribution by application portal/aggregator and counts for Focus, Allowed, and Restricted guidance.
- Filters: school, country, study level, intake, guidance, and application portal/aggregator.
- Route rows show school and country, level, intake, portal/aggregator, and guidance. They omit master rate, Agent payout, and margin.

### Agent dashboard content

- KPIs: organization-approved routes, universities, countries, and payout route counts.
- Analytics: guidance counts and payout type distribution (percentage versus flat fee). Do not calculate a combined average or rank that compares percentage payouts with flat amounts.
- Filters: school, country, study level, intake, guidance, payout type, and payout range within the selected payout type. No aggregator filter.
- Route rows show the Agent's effective payout, whether percentage or flat fee, and the other fields in the Agent projection. They omit Admin margin fields and aggregator details.
- Organization scope is determined by the approved Agent access record and role-safe rate projection, not a user-editable dashboard filter.

### Admin dashboard content

- Retain the existing Admin KPIs, margin/earnings analytics, full filters, editable rate table, and Admin actions.
- Keep the shared dashboard shell, Chat FAB, and Chat-to-dashboard filter handoff.
- Remove the Dashboard/Chat segmented header switcher once the FAB is available.

## 4. Role-safe data and filtering

Dashboard views consume role-scoped records already loaded by the application. Staff data comes from the Staff projection; Agent data comes from organization defaults and authorized organization/personal overrides; Admin data remains Admin-only. The dashboard must not fetch canonical Admin records to populate Staff or Agent views.

Use a typed dashboard filter model for common filters (school text, country, study level, intake, and guidance) plus role-specific fields (Staff portal/aggregator, Agent payout type and range, Admin's existing filters). Role validation determines which filters can be set and applied. Unsupported filter values are ignored or clarified; they are never silently interpreted as a different field.

Filters and counts are computed from the current role's authorized visible rates, including sheet visibility settings. UI filtering is not an authorization boundary; existing Firestore read models and rules remain responsible for access control. Do not persist filter state across user or organization changes. Reset filters and in-memory dashboard/chat context when the authenticated user, role, or Agent organization scope changes.

Agent payout range comparisons are valid only within the selected payout type. Percentage and flat-fee values are never combined into one average, rank, or threshold comparison.

## 5. Chat and dashboard synchronization

The dashboard shell owns the active dashboard filter state and shares it with the dashboard and Chat panel.

- When Chat resolves a school search into supported filters, it updates the shared filter state. The visible dashboard applies those filters immediately behind the panel.
- When the user manually changes dashboard filters, the next Chat turn receives the current filters as local conversational context.
- A greeting, out-of-scope prompt, ambiguous school match, missing required clarification, or unsupported role field does not apply a new dashboard filter. Once the user resolves the ambiguity, the resulting search may apply its filters.
- Assistant search results offer “View on dashboard.” Activating it closes the panel and scrolls/focuses the dashboard results and active-filter summary.
- Chat remains a conversational surface with its own message history and result preview. It does not replace the dashboard results or navigate to a separate backend page.
- Results and counts are derived locally from the loaded role-safe rate set. Offline/cache mode follows the existing local-data behavior and freshness status.

## 6. Chat FAB and responsive behavior

- Display a fixed, accessible Chat FAB at the bottom right for all roles. It remains reachable while dashboard content scrolls and respects mobile safe-area insets.
- Desktop opens a right-side drawer over the dashboard. Keep the dashboard visible behind the drawer and preserve its current filter state.
- Mobile opens a responsive modal popup over the dashboard with a dimmed backdrop and a usable composer above the on-screen keyboard.
- Close controls include an explicit close button, Escape, and backdrop click. Closing preserves the dashboard filters and conversation draft.
- Opening/closing uses short, consistent transitions and honors `prefers-reduced-motion`.
- The drawer/popup traps keyboard focus while open and restores focus to the FAB on close.

## 7. Loading, empty, and offline states

- Reuse the shared dashboard loading, error, offline, quota, and stale-cache indicators. Status messaging must remain distinct between network offline, Firestore quota limit, and stale cached data.
- Empty results explain which active filters excluded routes and offer a clear-all action.
- When no local role-safe cache exists, show the existing load/error state; never silently fall back to broader role data.
- Preserve search and filter behavior when cached role-safe data is available offline.

## 8. Acceptance and test coverage

### Data and role isolation

- Staff dashboard rows and all metrics contain no master rate, Agent payout, or margin values.
- Agent dashboard rows contain only organization-approved routes and the effective Agent payout; no Admin margin or aggregator data is rendered or searchable.
- Admin retains full metrics and editing actions; Staff and Agent views have no Admin mutation controls or backend navigation.
- Changing user, role, access state, or Agent organization clears prior role data, filters, and Chat context before loading the new scope.
- Sheet visibility changes affect route cards, KPIs, filter options, and results consistently.

### Filter behavior

- Shared and role-specific filters combine predictably; KPI and analytics clicks apply the corresponding filter.
- Active-filter chips accurately represent state; clear-all resets filters, pagination, and counts.
- Agent payout thresholds are applied only within percentage or flat-fee values of the selected type.
- Empty states, loading, offline, quota, and stale cache are distinguishable.

### Chat handoff

- A clear Chat search updates the dashboard filter state and visible result count immediately.
- An ambiguous or unsupported Chat request does not alter dashboard filters until resolved.
- Manual dashboard filters are available in Chat follow-up context.
- “View on dashboard” closes Chat, preserves the applied filters, and brings results into view.
- Desktop drawer and mobile popup open/close correctly; Escape/backdrop close, focus trap/return, and reduced motion are covered.

### Regression

- Admin dashboard search, filters, analytics, table editing, and backend navigation continue to work.
- Staff/Agent Chat history, favorites, offline local search, and account isolation continue to work when Chat is opened from the FAB.
- The production build and application test suite pass.

## 9. Non-goals

- Changing Firestore authorization policy, projection schemas, Agent approval workflow, or organization membership rules beyond what is required to consume existing role-safe data.
- Introducing server-side or AI-powered search; Chat remains deterministic and local.
- Showing Agent aggregator or Admin margin information in Staff/Agent dashboards.
- Replacing Admin's backend pages with a Staff/Agent-visible navigation menu.

## 10. Implementation boundaries to validate during planning

Likely components include `AppLayout`, `DashboardView`, `StaffPortalView`, `AgentPortalView`, `ChatExperience`, `ChatExperience.css`, role-specific rate types/selectors, and focused service/component tests. The plan should determine whether to extend the existing dashboard component or extract a shared role-aware shell/table without widening the Admin data contract. Do not begin implementation until this specification is reviewed and the implementation plan is approved.

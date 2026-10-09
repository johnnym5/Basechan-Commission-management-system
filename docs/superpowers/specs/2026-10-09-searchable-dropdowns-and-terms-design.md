# Searchable Dropdowns and Updated Terms Design

## Goal

Make every application dropdown searchable by typing, correct the country choices in rate entry, and replace the current permission and Terms of Use copy with the wording supplied by the user.

## Current behavior

- The application has 41 native `<select>` controls across rate management, portals, access administration, audit history, and calculators. Native select menus do not support in-list search.
- `PredictiveInput` filters options as the user types, but shows at most eight matches. The Add Rate form builds countries only from `CommissionRate.country`, so contaminated values such as aggregator names can appear and countries absent from current records are unavailable as suggestions.
- The Edit Rate form currently uses text fields for aggregator and intake, while the Add Rate form already uses searchable inputs for data-backed values.
- The login terms gateway and Legal Center contain different terms. The gateway acceptance statement does not mention advertised rates; the Legal Center currently contains unrelated liability, subscription, and logo clauses.

## Design

### Searchable dropdown control

Create a shared accessible searchable dropdown for fixed-choice controls. It accepts labeled options with stable values, a selected value, change handler, optional placeholder/disabled state, and an accessible name. Typing filters all matching options without dropping matches after an arbitrary fixed count. Keyboard interaction supports opening, moving through results, selection, and dismissal; an empty result state is shown. Preserve form submission values, existing selection behavior, and role-based disabled states.

Replace the application's native dropdowns with this control, including all 41 identified controls. Controls that already accept new text remain searchable free-entry inputs; fixed-choice controls (for example role, study level, and pricing type) remain limited to their valid choices. Existing database values remain selectable even when they are not in the standard list.

### Country suggestions

Provide a complete built-in country list as searchable suggestions for rate creation, rather than relying only on countries already present in rates. Keep recognized existing country labels and aliases used by the data, such as `UK`, when appropriate. Exclude obvious non-country values from suggestions, including aggregator names and sheet labels. The editable country field continues to accept a newly typed value.

### Updated Terms of Use

Replace the current Terms of Service text in both Legal Center and the login terms gateway with the following four sections, retaining wording and meaning:

1. **Authorized Access & User Roles** — Access is available to authorized Basechan International staff, verified partner agencies, and registered students or clients. Each user may access only the information and services permitted under their assigned role.
2. **Confidentiality & Information Protection** — Student records, personal information, partner agreements, commission rates, and commercial terms must be handled confidentially. Users must not disclose restricted information without appropriate authorization.
3. **Responsible Use & Data Accuracy** — Users must provide accurate information and use the platform for legitimate study abroad services and authorized business activities. Unauthorized data collection, downloading, sharing, or alteration may result in access suspension or account termination.
4. **Security Monitoring & Privacy** — Platform activity may be logged and reviewed to protect accounts, maintain accurate records, and prevent misuse. Personal information is handled in accordance with our Privacy Policy and applicable data protection requirements.

The login gateway checkbox uses the supplied acceptance statement: “By ticking this box, you confirm that you have read, understood, and agree to Basechan International’s Terms and Conditions and the advertised rates applicable to your services or partnership.” The Legal Center displays the same acceptance statement as text; accepting it remains a login-gateway action.

## Constraints

- Do not add a UI dependency; use the existing React, TypeScript, and Tailwind stack.
- Keep searches local and deterministic; typing must not query a server.
- Preserve free-text entry only on fields that already support creating new values, including country, aggregator, and intake.
- Do not change role permissions or rate-write authorization.
- Use the exact user-provided terms and acceptance wording, with only heading and layout formatting.

## Acceptance criteria

- Every existing native dropdown is searchable and keyboard-operable.
- Typing filters the complete option set and does not silently hide matching choices because of an eight-result cap.
- Country suggestions cover the full country list and exclude known non-country artifacts; a new country can still be typed.
- Existing and custom aggregator/intake/country values remain selectable/editable.
- The four terms sections and acceptance statement match the supplied wording in both entry points.
- Tests cover filtering beyond eight values, no matches, keyboard selection, country catalogue/cleanup, field free-entry, and terms copy.
- `npm test` and `npm run build` pass.

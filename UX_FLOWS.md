```markdown:UX_FLOWS.md
# UX Flows & Wireframes

## Global Navigation
Simple top bar for Admins.

```text
┌─────────────────────────────────────────────┐
│ [Logo] Basechan Comm System     [Logout]    │
├─────────────────────────────────────────────┤
Screen 1: The Master Intelligence Table
Route: / (Default post-login)
Purpose: Compare rates, find the best profit margin, and trigger updates.

Plaintext
│ ┌── Filters ─────────────────────────────┐  │
│ │ [Search Uni...] [Intake ▾] [Level ▾]   │  │
│ │ [Aggregator ▾]  [Sort: DIFF (High-Low)]│  │
│ └────────────────────────────────────────┘  │
│                                             │
│ ┌─ Rates ───────────── [Upload Excel] ───┐  │
│ │ Uni Name | Intake | Lvl | Aggregator | Master | Agent | DIFF  | Edit │
│ │ Aberdeen | Jan 26 | UG  | EDVOY      | 14%    | 10%   | +4%   | [✎]  |
│ │ Aberdeen | Jan 26 | UG  | SI-UK      | 12%    | 10%   | +2%   | [✎]  |
│ │ Bradford | Sep 26 | PG  | CRIZAC     | £3750  | £2800 | +£950 | [✎]  |
│ └────────────────────────────────────────┘  │
Screen 2: Manual Edit Modal
Purpose: Manually update a specific rate without uploading a whole Excel sheet.

Plaintext
┌─ Edit Rate: Aberdeen University ──────────┐
│ Aggregator: [ EDVOY ▾ ]                   │
│ Intake:     [ Jan 2026 ▾ ]                │
│ Level:      [ UG ▾ ]                      │
│                                           │
│ Master Rate: [ 14 ] %                     │
│ Agent Rate:  [ 10 ] %                     │
│ DIFF:        +4% (Auto-calculated)        │
│                                           │
│ [Cancel]                       [Save]     │
└───────────────────────────────────────────┘
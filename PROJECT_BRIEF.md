# Project Brief: Commission Intelligence Engine

## Problem
Managing international student recruitment commissions across multiple universities, intakes (e.g., Jan 2026, Sept 2026), study levels (FD, UG, PG), and aggregators (SI-UK, EDVOY, UAP, CRIZAC) is currently done via a complex, multi-sheet Excel workbook. This creates version control issues, makes real-time comparison difficult, and increases the risk of manual miscalculation of profit margins (DIFF).

## Users
| Role | Needs | Can do | Cannot do |
|---|---|---|---|
| Admin | Fast lookups, accurate margin data, ability to update rates | View all rates, import Excel, edit university data, update commissions | N/A (Highest privilege) |

## Core capability
To ingest the Master Commission Excel workbook and provide a unified, filterable, and editable web dashboard for comparing Master (Incoming) rates versus Agent (Outgoing) rates to instantly surface the profit margin (DIFF).

## In scope (v1)
- [x] Secure Admin authentication.
- [x] Excel parser to ingest "MASTER COMMISSION SHEET 2025 - 2026 FEB.xlsx" as the initial database seed.
- [x] Master datatable with advanced filtering (by University, Country, Intake, Level, Aggregator).
- [x] CRUD operations for Universities and Commission Rates.
- [x] Auto-calculation of DIFF (Master - Agent) upon any rate update.

## Out of scope (explicitly not doing)
- Agent logins or agent-facing portals.
- Student application tracking.
- Invoice generation or deposit tracking.

## Success criteria
- Admins can find the most profitable route (Aggregator) for a specific university and study level in under 5 seconds.
- The system correctly ingests the 360+ rows from the legacy Excel sheets without data loss.
```eof

```markdown:ARCHITECTURE.md
# Architecture

## Pattern
**Monolithic SPA with API backend**. Chosen because this is an internal, data-dense administrative tool that requires fast client-side filtering and sorting, and does not require complex microservices or high public concurrency.

## Component map
- **Frontend (Client):** Renders the data tables, handles complex filtering state, and provides forms for manual updates.
- **API Layer (Server):** Handles authentication, validates incoming manual edits, and exposes endpoints for the data.
- **Excel Parser Service:** A dedicated server-side utility that reads the uploaded `.xlsx` file, normalizes the data across the various sheets (RAW, REAL, MASTER, etc.), and seeds the database.
- **Database:** Relational SQL database to enforce schema integrity between Universities, Intakes, and Rates.

## Primary data flow (Excel Import)
1. Admin uploads `MASTER COMMISSION SHEET.xlsx`.
2. → `ParserService` reads buffer, maps column headers to schema.
3. → `Validation` checks for existing universities and overwrites/updates rates.
4. → `Persistence` writes to SQL Database in normalized tables.
5. → Response returns success/failure metrics (e.g., "Updated 182 universities").

## Boundaries & rules
- All routes require Admin authentication.
- The Excel parser is entirely server-side; the client only sends the file buffer.
- DIFF is calculated on the fly by the database/backend, never trusted from client input.

## Scaling notes
- Current design holds to roughly ~5,000 universities and ~50,000 rate rows, which is vastly beyond the current 360-row Excel sheet. 
- The first bottleneck will be the client-side rendering of the master table if pagination is not implemented.
```eof

```markdown:DATA_MODEL.md
# Data Model

## Pattern & Strategy
The Excel sheet relies on horizontal columns for different study levels and aggregators. To make this queryable and maintainable in a database, we must **normalize** the data vertically. 

### Entity: User
| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | UUID | Yes | Primary Key |
| `email` | String | Yes | Unique |
| `passwordHash`| String | Yes | Bcrypt |

### Entity: University
| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | UUID | Yes | Primary Key |
| `name` | String | Yes | e.g., "Aberdeen University" |
| `country` | String | No | e.g., "UK", "USA" |
| `status` | Enum | Yes | `ACTIVE`, `TBC`, `NIL` |

### Entity: CommissionRate
*This is the core transactional table. Instead of having columns for M-UG, M-PG, A-UG, A-PG, we create discrete records.*

| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | UUID | Yes | Primary Key |
| `universityId` | UUID | Yes | Foreign Key -> University |
| `intake` | String | Yes | e.g., "Jan 2026", "Sept 2026", "Oct-Feb 2026" |
| `aggregator` | String | Yes | e.g., "SI-UK", "EDVOY", "UAP", "CRIZAC", "BASECHAN" |
| `studyLevel` | Enum | Yes | `FD`, `UG`, `PG` |
| `masterRate` | Decimal | Yes | Incoming % (or flat fee) |
| `agentRate` | Decimal | Yes | Outgoing % (or flat fee) |
| `diffMargin` | Decimal | Yes | Auto-calculated (masterRate - agentRate) |
| `isFlatFee` | Boolean | Yes | False = Percentage, True = Currency amount |
| `netOrGross` | Enum | Yes | `NET`, `GROSS` |

## Indexes
- `University(name)` for fast text search.
- `CommissionRate(universityId, intake)` for fast lookups of specific terms.
- `CommissionRate(diffMargin)` to allow sorting by most profitable routes.
```eof

### Next Step: Tech Stack & Verification (Gate 2)

Before I write the `TECH_STACK.md` and start building the Walking Skeleton (the Excel parser and database), I need you to confirm:

**1. The Tech Stack Default:** I recommend **Next.js (React/TypeScript) + PostgreSQL + Prisma ORM**. It handles backend parsing and frontend tables perfectly. Is this acceptable, or do you have a mandated stack (e.g., Python/Django, PHP/Laravel)?
**2. The Data Normalization:** In the Excel sheet, columns go wide (e.g., one row has FD, UG, and PG rates). In `DATA_MODEL.md`, I split these into separate rows so you can easily filter "Show me all PG rates above 15%". Does this normalized approach work for you?
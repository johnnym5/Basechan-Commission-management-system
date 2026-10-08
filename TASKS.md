# Implementation Tasks

Status: `TODO` · `DOING` · `BLOCKED` · `REVIEW` · `DONE`

## Milestone 1: Foundation & Auth
### T-001 · Init Vite & Firebase
- **Status:** DONE
- **Why:** Base scaffold.
- **Acceptance:** React boots, Firebase initialized, `.env` configured, Tailwind functional.

### T-002 · Authentication & Security Rules
- **Status:** DONE
- **Why:** Lock down the system to Basechan staff.
- **Acceptance:** Google Sign-In only. Automatic rejection & signout for non-`@basechaninternational.com` accounts. Firestore rules configured to enforce domain boundary.

## Milestone 2: The Excel Engine
### T-003 · SheetJS Parser Utility
- **Status:** DONE
- **Why:** Translate the legacy Excel format to our NoSQL Data Model.
- **Acceptance:** Pure TS function takes a `.xlsx` buffer and returns valid `CommissionRate` arrays. Auto-calculates `DIFF`.

### T-004 · Firestore Batch Uploader
- **Status:** DONE
- **Why:** Safe upload of hundreds of records.
- **Acceptance:** Chunks writes into arrays of 500 (450 chunk size). Uses composite IDs to overwrite/update existing records safely.

## Milestone 3: The Intelligence Dashboard
### T-005 · Master Data Table
- **Status:** DONE
- **Why:** The core capability.
- **Acceptance:** TanStack table renders Firestore data. Fast filtering by Uni, Intake, Level, and Aggregator.

### T-006 · Manual Edit Modal
- **Status:** DONE
- **Why:** Allow Admins to tweak individual rates without a full upload.
- **Acceptance:** Form updates Firestore directly, Table reflects change in real-time.
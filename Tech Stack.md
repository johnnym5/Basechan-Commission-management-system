# Tech Stack

| Layer | Choice | Version | Why | Rejected alternative | Why not |
|---|---|---|---|---|---|
| Frontend | React (Vite) + TS | 18+ | Fast compilation, static hosting, perfect for SPA. | Next.js | SSR/SEO is unnecessary for an internal admin tool. |
| Backend & DB | Firebase Firestore | v10 | Serverless NoSQL, real-time sync, requested by user. | PostgreSQL | User explicitly mandated Firebase. |
| Authentication | Firebase Auth | v10 | Native integration with Firestore security rules. | Auth0 / NextAuth | Keep within Firebase ecosystem. |
| Excel Parsing | SheetJS (`xlsx`) | 0.20+ | Industry standard for browser-side Excel parsing. | Cloud Functions | Unnecessary latency/cost; Admins have trusted browsers. |
| Table UI | TanStack Table | v8 | Handles thousands of rows and complex filtering client-side. | MUI DataGrid | Tanstack is headless and vastly more customizable. |
| Styling | Tailwind CSS | v3 | Rapid utility-class UI development. | CSS Modules | Slower iteration speed. |
| Hosting | Firebase Hosting | - | Single command deploy, native to stack. | Vercel | Keep everything in one GCP project. |

## Locked-in decisions
- **NoSQL Data Flattening:** Firestore does not do SQL `JOIN`s efficiently. We will denormalize some university data into the commission rate documents to allow single-query filtering.
```eof

```markdown:ARCHITECTURE.md
# Architecture

## Pattern
**Serverless Single Page Application (SPA)**. The browser acts as a thick client, communicating directly with Firebase Auth and Firestore.

## Component map
- **Frontend App:** React SPA hosted on Firebase Hosting.
- **Excel Parser Module:** A dedicated pure-TypeScript utility that takes the File ArrayBuffer, reads sheets (REAL, MASTER, etc.), normalizes the data, and returns an array of `CommissionRate` objects.
- **Firestore Batcher:** A utility to chunk Firestore writes (limit 500 per batch) to bulk-upload the parsed Excel data.
- **Master Data Table:** The primary UI component. Subscribes to Firestore, holds local state for rapid filtering.

## Primary data flow (Excel Import)
1. Admin logs in via Firebase Auth.
2. Admin uploads `MASTER COMMISSION SHEET.xlsx`.
3. → `SheetJS` parses the binary file strictly in the browser.
4. → `Parser Module` formats rows, auto-calculates `DIFF = Master - Agent`.
5. → `Firebase Batch Service` writes/overwrites documents in Firestore.
6. → `Master Data Table` listener detects Firestore changes and updates the UI instantly.

## Boundaries & rules
- **Zero backend logic:** All data transformation happens in the Admin's browser.
- **Security:** Firestore Rules will reject any write or read if the user's UID is not present in an `admins` whitelist collection.
```eof

```markdown:DATA_MODEL.md
# Data Model (Firestore NoSQL)

## Pattern & Strategy
Firestore requires data to be structured for *how it is queried*. Because Admins will want to filter by University, Intake, and Aggregator all at once, we will use a flat, top-level `rates` collection.

### Collection: `admins`
Used exclusively by Firebase Security Rules to verify who is allowed in.
- `Document ID`: Firebase Auth UID
- `email`: String (e.g., "admin@agency.com")

### Collection: `universities`
Maintains the master list of institutions.
- `Document ID`: Auto-generated or normalized name (e.g., "aberdeen_university")
- `name`: String
- `country`: String (Optional)
- `status`: String (`ACTIVE`, `TBC`, `NIL`)
- `lastUpdated`: Timestamp

### Collection: `rates`
This is the core collection. It is denormalized (contains the university name) so we don't have to fetch the `universities` collection just to render the table.

- `Document ID`: Composite string `[universityId]_[intake]_[aggregator]_[studyLevel]` (e.g., `aberdeen_jan2026_edvoy_UG`). *This prevents duplicates on re-upload.*
- `universityId`: Reference/String
- `universityName`: String (Denormalized for fast UI filtering)
- `intake`: String (e.g., "Jan 2026", "Sept 2026")
- `aggregator`: String (e.g., "SI-UK", "EDVOY")
- `studyLevel`: String (`FD`, `UG`, `PG`)
- `masterRate`: Number
- `agentRate`: Number
- `diffMargin`: Number (Pre-calculated during import)
- `isFlatFee`: Boolean
- `netOrGross`: String (`NET`, `GROSS`)

## Indexes Required
Firestore will require composite indexes for the filtering table. The agent must generate these when querying:
- `rates` collection: `intake` ASC, `studyLevel` ASC
- `rates` collection: `aggregator` ASC, `diffMargin` DESC
```eof

```markdown:SECURITY.md
# Security Architecture

## Authentication
- Firebase Auth (Email/Password). 
- Public sign-up MUST be disabled in the Firebase Console. Admins are manually created by the Super-Admin.

## Trust Boundaries
- The client browser is untrusted. Even though this is an internal app, we assume a malicious actor could intercept the Firebase config.
- **Defense:** Firestore Security Rules are the only barrier.

## Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is an admin
    function isAdmin() {
      return request.auth != null && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    // Lock down the admins collection
    match /admins/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Only manageable via Firebase Console manually
    }

    // Universal lock on all business data
    match /universities/{uniId} {
      allow read, write: if isAdmin();
    }
    
    match /rates/{rateId} {
      allow read, write: if isAdmin();
    }
  }
}
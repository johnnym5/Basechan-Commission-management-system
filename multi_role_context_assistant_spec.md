# Feature Implementation Spec: Multi-Role Context Assistant

**Status:** APPROVED FOR IMPLEMENTATION
**Target Architecture:** React (Vite) + TypeScript + Firebase/Firestore + Cloud Functions
**Mode:** BROWNFIELD (Integrate into existing application)

## 0. INSTRUCTIONS FOR THE EXECUTING AGENT
You are executing a highly specific architectural update. Read this entire document before modifying any files. 
*   **[SECURITY]** DO NOT implement an external LLM (OpenAI/Anthropic) for this feature. The Natural Language Processing (NLP) must be a **Deterministic Expert System** running locally in the browser to guarantee 0% hallucination on financial numbers, 0ms latency, and full offline capability.
*   **[SECURITY]** DO NOT rely on the client UI to hide data. Data isolation across roles MUST be enforced via `firestore.rules`.
*   **[RISK]** Admin bulk operations (e.g., migrating intakes) MUST use the **Command-to-Confirmation** staging pattern. DO NOT execute bulk writes directly from chat input.
*   **[RISK]** Undo/Redo MUST be implemented as Event-Sourced Compensating Transactions. Do not use simple local state reversions.

---

## 1. ARCHITECTURAL OVERVIEW

We are replacing/augmenting a static card grid with a **Hybrid Conversational Directory**.
*   **The UI:** An omnibox chat interface that dynamically renders text responses, inline action chips, and mini-tables. Users can seamlessly toggle between `Chat`, `Grid`, and `Table` views.
*   **The Brain:** A deterministic NLP parser (`textParser.ts`) that handles fuzzy matching (typos), entity extraction (Country, Level, School), and intent recognition locally.
*   **The Context Engine:** Search results are dynamically scored and injected with conversational alerts based on the user's `Role` (Agent, Staff, Admin) and `GlobalDirectives` (Focus Schools, Restricted Routes).

---

## 2. ROLE & TRUST BOUNDARIES

You must enforce strict data and intent separation based on the authenticated user's role.

| Role | Permitted Data | Blocked Data | Permitted Intents |
| :--- | :--- | :--- | :--- |
| **AGENT** | Payouts, Focus Status, Intakes | Aggregator routing, other agent tiers | `Search`, `CalculateDeal`, `CompareRates`, `GenerateDealSheet` |
| **STAFF** | Aggregators, Routing Guidelines | Commission payouts | `Search`, `ViewRouting`, `SubmissionRules` |
| **ADMIN** | All Data | None | `Search`, `StageWrite`, `ExecuteWrite`, `Undo/Redo`, `TimeTravel` |

---

## 3. DATA MODELS TO IMPLEMENT

Add these to your centralized types (e.g., `src/types/index.ts` or split appropriately):

```typescript
export type UserRole = 'AGENT' | 'STAFF' | 'ADMIN';
export type ViewMode = 'chat' | 'grid' | 'table';

export interface GlobalDirectives {
  focusSchools: string[]; // Array of School IDs to boost
  restrictedRoutes: string[]; // Array of School IDs to warn against
  urgentIntakes: { schoolId: string; deadline: string }[];
}

export interface ParsedIntent {
  action: 'SEARCH' | 'CALCULATE' | 'COMPARE' | 'STAGE_WRITE' | 'BLOCK_UNAUTHORIZED';
  entities: {
    country?: string;
    level?: string;
    schoolId?: string;
    minPayout?: number;
  };
  didYouMean?: string; // For typo correction
  isSubjectiveQuery?: boolean; // True for "best", "top", "highest"
  stagedCommand?: StagedCommand;
}

export interface StagedCommand {
  id: string; // Idempotency key (UUID)
  type: 'MIGRATE_INTAKE' | 'RESTRICT_ROUTE' | 'UPDATE_PAYOUT';
  targetIds: string[];
  payload: any;
}

export interface AuditLog {
  id: string;
  commandId: string;
  adminId: string;
  timestamp: number;
  operation: string;
  previousState: any[]; // The exact documents before mutation
  newState: any[];
}
```

---

## 4. IMPLEMENTATION PHASES

### Phase 1: Offline Persistence & The NLP Engine
The app must work at education fairs with poor internet.
1.  **Firestore Offline Mode:** Initialize Firestore with `enableIndexedDbPersistence`. Handle the `failed-precondition` exception gracefully. Add a `[🌩️ Offline Mode - Local Cache]` badge to the UI if `navigator.onLine` is false.
2.  **Local NLP (`src/utils/textParser.ts`):** 
    *   Create a `KNOWN_VOCABULARY` array mapping canonical names to aliases.
    *   Implement `levenshteinDistance(a, b)`. Distance <= 2 flags `didYouMean`.
    *   Implement intent blocking: If `role === 'AGENT'` and query includes "aggregator", return `BLOCK_UNAUTHORIZED`.

### Phase 2: Smart Context & Recommendation Engine
Create `src/utils/recommendationEngine.ts`. Do not use LLMs for this.
```typescript
export function scoreAndSortRoutes(routes: University[], directives: GlobalDirectives): University[] {
  return routes.sort((a, b) => {
    let scoreA = a.commissionAmount || 0; // Agents care about money
    // Add weights
    if (directives.focusSchools.includes(a.id)) scoreA += 5000;
    if (directives.restrictedRoutes.includes(a.id)) scoreA -= 50000;
    
    let scoreB = b.commissionAmount || 0;
    if (directives.focusSchools.includes(b.id)) scoreB += 5000;
    if (directives.restrictedRoutes.includes(b.id)) scoreB -= 50000;
    
    return scoreB - scoreA;
  });
}
```

### Phase 3: The Conversational UI (`src/components/ConversationalView.tsx`)
1.  **Proactive Greeting:** On load, check `GlobalDirectives`. If a focus school exists, the first bot message must say: *"Welcome. Note that [School Name] is currently a Focus Route..."*
2.  **Wizard Slot-Filling:** If a query returns > 5 results, the bot must ask: *"Found X results. Do you want to narrow by [UG] or [PG]?"*
3.  **View Synchronization:** Ensure the Search Bar filters are shared in a common React Context so switching to `<CardGrid>` or `<MasterTable>` preserves the exact results found in the chat.

### Phase 4: Admin Staging & Time Travel
1.  **Command-to-Confirmation:** If an Admin types "Migrate UK to 2026", render a `<StagedCommandBox>` with a yellow warning border. Show affected count. Require a click to execute.
2.  **Time Travel (Preview Mode):** Before clicking execute, Admin clicks "Preview as Agent".
    *   *Implementation:* Wrap the main Data Context Provider. When in Preview Mode, inject the `stagedCommand.payload` over the live data array in memory only. Overlay a red banner: `[PREVIEW MODE: STAGED CHANGES]`.
3.  **Execution:** Use `writeBatch` in Firestore. 

### Phase 5: Event-Sourced Undo/Redo
1.  Before executing an Admin batch, read the *current* state of all affected documents and write them to a new `audit_logs` collection alongside the mutation.
2.  If Admin clicks `[Undo]`, fetch the `audit_log`, verify the current document states haven't diverged (to prevent race conditions), and batch-write the `previousState` back to the `universities` collection.

### Phase 6: Deal Sheet PDF Generator (Cloud Function)
1.  Do NOT generate PDFs containing financial data on the client (DOM-to-Image is easily spoofed).
2.  Create a Firebase Cloud Function `generateDealSheet`.
3.  Client passes `schoolId`, `studentCount`, `agentId`.
4.  Server reads official commission rate from DB, performs math, generates a secure PDF via `pdfkit` or similar, saves to Cloud Storage, and returns a signed download URL to the chat.

### Phase 7: Firestore Rules Hardening
Update `firestore.rules`.
```javascript
match /universities/{uniId} {
  allow read: if request.auth != null;
  allow write: if request.auth.token.role == 'ADMIN';
}

match /audit_logs/{logId} {
  // Append only. No one, not even Admin, can delete history.
  allow create, read: if request.auth.token.role == 'ADMIN';
  allow update, delete: if false; 
}
```

---

## 5. EXPECTED OUTPUT & VERIFICATION

When you have completed implementation, the system must demonstrate:
1.  **Typo Tolerance:** Typing "masn" suggests "George Mason University".
2.  **Role Isolation:** Agent typing "how to submit" gets blocked. Staff typing "highest payout" gets blocked.
3.  **Offline Support:** Disconnecting Wi-Fi still allows searching cached routes.
4.  **Admin Safety:** Typing "restrict Drew University" renders a staging box. Clicking "Undo" after execution perfectly restores the previous database state using compensating transactions.
5.  **Time Travel:** Staged changes can be previewed seamlessly without mutating the actual database.

**Execute this plan incrementally. Make small commits. Do not delete existing components; wrap them in the new `ViewMode` toggle state.**
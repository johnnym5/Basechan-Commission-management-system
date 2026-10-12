# Technical Specification: Firestore Read Optimization & Ultra-Low Quota Architecture

## 1. Executive Summary & Objective

The primary objective of this architecture is to eliminate the 3,500+ document read spike on application startup, reducing startup reads to **1 single billable Firestore read** (or 0 reads when serving directly from browser IndexedDB cache). This guarantees that Basechan CMS remains fast (<50ms startup), resilient in offline scenarios, and well within Firebase's 50,000 daily free tier read quota even under heavy daily usage across all user roles.

---

## 2. Root Cause & Architectural Baseline

Currently, `rateSyncService.ts` and `useCommissionRates.ts` execute an un-paginated `getDocsFromServer(collection('staff_rates'))` or `getDocsFromServer(collection('agent_rates'))` on app open. Because Firestore bills **1 read per document returned**, querying 3,500 individual rate documents incurs 3,500+ reads per page refresh.

Furthermore, `getDocsFromServer` explicitly bypasses browser IndexedDB cache, forcing a complete server re-download on every render.

---

## 3. The 3-Tier Optimization Strategy

To solve this permanently without breaking any existing dashboard features, filters, search, or Chat capabilities, the system implements three complementary architectural layers:

```
+-----------------------------------------------------------------------------------+
| LAYER 1: IndexedDB Cache-First Storage                                            |
| Loads rates instantly in <50ms from local browser storage (0 Firestore Reads)    |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| LAYER 2: Single Global Sync Timestamp Validation                                  |
| Queries 1 doc (`settings/system_config`) to check `ratesLastUpdatedAt` (1 Read) |
+-----------------------------------------------------------------------------------+
                                         |
                                         +---> If unchanged: STOP (Total = 1 Read)
                                         |
                                         +---> If changed: Fetch updated sheet
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| LAYER 3: Aggregated Sheet Buckets & Lazy Sheet Loading                            |
| Stores rates inside 15 sheet bucket docs (`rate_sheets/{sheetKey}`)               |
| Fetches only active default sheet (1 Read) & lazy-loads secondary sheets on demand |
+-----------------------------------------------------------------------------------+
```

### Layer 1: Aggregated Sheet Bucket Schema (`rate_sheets/{sheetKey}`)
Instead of storing 3,500 individual rate documents, rates are aggregated into **Sheet Bucket Documents** where all rates for a given intake sheet are stored as an array inside a single document payload.

* **Collection Name**: `rate_sheets`
* **Document ID**: `sheetKey` (e.g., `2026_AGENT_MASTER`, `SI-UK_Master_List`)
* **Document Structure**:
  ```json
  {
    "sheetKey": "2026_AGENT_MASTER",
    "sheetName": "2026 AGENT MASTER",
    "rateCount": 328,
    "updatedAt": "2026-10-12T11:30:00.000Z",
    "updatedBy": "admin@basechaninternational.com",
    "rates": [
      {
        "id": "aberdeen__sept_2026__si_uk__ug",
        "universityId": "aberdeen",
        "universityName": "University of Aberdeen",
        "country": "UK",
        "intake": "Sept 2026",
        "studyLevel": "UG",
        "aggregator": "SI-UK",
        "masterRate": 15,
        "agentRate": 12,
        "diffMargin": 3,
        "isFlatFee": false,
        "netOrGross": "NET",
        "guidance": "FOCUS"
      }
    ]
  }
  ```
* **Billing Impact**: Reading 1 sheet document with 328 rates = **1 billable read** (a 99.7% reduction).

### Layer 2: Lazy Sheet Loading (On-Demand Fetching)
* On app open, the system reads **only the active default intake sheet bucket** (e.g. `rate_sheets/2026_AGENT_MASTER`).
* Secondary intake sheets are fetched lazily only when the user selects or filters by them in the intake selector dropdown.

### Layer 3: Cache-First IndexedDB Local Storage & Global Sync Check
* Retained sheet buckets are saved in IndexedDB (`basechan_local_rate_sheets_v1`).
* On app open or page refresh, the app loads from IndexedDB immediately (**0 reads**).
* It checks a single lightweight document `settings/system_config` containing `ratesLastUpdatedAt`.
* If `ratesLastUpdatedAt` matches local sync timestamp, no further server requests are made (**Total: 1 Read**).

---

## 4. Key Service Updates & Component Flow

1. **`src/services/rateSyncService.ts`**:
   * Refactored to implement `syncRateSheetsCacheFirst(scope)`.
   * Reads from IndexedDB first, checks global timestamp doc, fetches updated or active sheet bucket document when required.

2. **`src/services/rateReadModels.ts`**:
   * Updates batch write and rate creation methods to automatically update the corresponding `rate_sheets/{sheetKey}` bucket document whenever a rate is added, edited, or deleted.

3. **`src/hooks/useCommissionRates.ts`**:
   * Calls `syncRateSheetsCacheFirst()`, exposing flat rates transparently to components so all UI tables, search bars, filters, and Chat continue to function seamlessly without any UI breaking changes.

---

## 5. Verification & Testing Plan

### Automated Testing
* **Vitest Suite**: Run `npm test` to ensure all 222+ unit tests continue to pass 100%.
* **Build Check**: Run `npm run build` to verify 0 TypeScript or Vite compilation errors.

### Manual Verification
* **Firestore Read Count**: Open app and verify in Network tab/Firebase Console that startup reads dropped from ~3,500 reads down to **1 read**.
* **Functional Verification**: Verify all rate searching, filtering, editing, and chat features work without regression.

# Quota Retry and Mode Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve local functionality during Firestore quota lockout and return to online mode only after a scheduled probe confirms access and local reconciliation succeeds.

**Architecture:** Keep a centralized network mode state machine distinguishing online, offline, quota-limited, and recovering. Quota mode suppresses routine Firestore listeners/reads/writes and schedules a 12-hour probe; the Pacific reset estimate informs copy/scheduling but never proves recovery. A successful probe revalidates access, refreshes local snapshots, and then resumes normal traffic.

**Tech Stack:** React, TypeScript, Firebase Firestore, IndexedDB, Vitest, fake timers.

**Spec:** `docs/superpowers/specs/2026-10-19-system-audit-remediation-roadmap-design.md`

## Global Constraints

- Local reads remain available in offline and quota-limited modes.
- Quota mode is distinct from connectivity loss; preserve separate status and user-facing copy.
- Probe cadence is every 12 hours while quota remains exhausted; do not probe early from navigation/chat actions.
- Firebase reset time is approximate Pacific time and must handle PST/PDT; it is not a guarantee that quota has reset.
- If offline when a probe is due, wait for `online` rather than issuing a failed request loop.
- Keep pending local writes and stable operation IDs through quota failures.

## Review Focus

- Firestore `resource-exhausted` maps to quota mode while permission errors remain authorization errors.
- Browser offline at due time defers probe until online.
- Pacific daylight-saving transition computes the correct next reset estimate.
- Successful connectivity probe with denied role does not restore privileged online mode.
- Successful probe followed by cache reconciliation failure retains recovery state and local data.

---

### Task 1: Model and test network modes and quota classification

**Files:**
- Modify: existing network-status/quota utility discovered via `rg "quota|offline|networkMode|resource-exhausted" src`
- Test: adjacent network-status/quota tests
- Reference: `src/services/localRateDatabase.ts`, `src/services/rateSyncService.ts`

**Interfaces:**
- Define `NetworkMode = 'online' | 'offline' | 'quota-limited' | 'recovering'` (extend existing enum if present).
- Central `classifyFirestoreFailure(error)` returns quota only for Firestore resource exhaustion/quota codes; permission-denied and connectivity errors retain distinct classifications.
- Pacific reset helper accepts an injected `Date` and returns the next estimated reset instant without assuming it has restored service.

- [ ] **Step 1: Add failing tests** for quota classification, permission/network distinction, Pacific standard/daylight offsets, and reset estimate after midnight Pacific.
- [ ] **Step 2: Run focused utility tests**; confirm the fixed UTC offset and generic error mapping fail.
- [ ] **Step 3: Implement typed mode classification and DST-aware reset estimation** with `Intl.DateTimeFormat` or an already-deployed timezone utility; avoid a new dependency unless required.
- [ ] **Step 4: Run focused tests**; expect classifications and DST-boundary estimates to pass.

### Task 2: Gate Firestore activity during quota lockout

**Files:**
- Modify: `src/hooks/useCommissionRates.ts`, `src/services/rateSyncService.ts`, existing subscription/read/write services found during implementation
- Test: `src/hooks/useCommissionRates.test.ts` and relevant service tests

**Interfaces:**
- Central gate exposes current mode and next probe time to listeners, refresh controls, and write sync.
- In quota-limited mode, no routine Firestore listener/refresh occurs; local snapshot remains the displayed source.
- Pending queue operations are marked quota-paused and preserve their operation IDs.

- [ ] **Step 1: Add failing tests** proving quota failure stops listeners and subsequent UI refreshes, local snapshot continues rendering, and queue IDs remain unchanged.
- [ ] **Step 2: Run the focused hook/service tests**; confirm repeated listener or read attempts are observable before the gate.
- [ ] **Step 3: Implement a shared quota gate** and connect subscription lifecycle, explicit refresh, and pending-write sync to it.
- [ ] **Step 4: Run the focused tests**; expect no Firestore requests while quota-locked except scheduled probes.

### Task 3: Schedule recovery probes and reconcile before resume

**Files:**
- Modify: network mode hook/provider, `src/services/rateSyncService.ts`, pending-write sync hook from local-first plan
- Test: network mode hook tests with fake timers

**Interfaces:**
- `scheduleQuotaProbe(nextAt)` persists/maintains the next 12-hour probe across component remounts/reloads using the existing local settings store.
- Probe waits for both due time and online connectivity; successful probe runs role/access validation then local catch-up before setting mode to online.
- Failed quota probe reschedules by 12 hours; connectivity failure defers until online; permission failure routes to access-denied handling.

- [ ] **Step 1: Add failing fake-timer tests** for 12-hour cadence, reload persistence, offline deferral, quota reschedule, role denial, and successful catch-up order.
- [ ] **Step 2: Run focused tests**; confirm mode currently flips or probes at the wrong times.
- [ ] **Step 3: Implement the scheduler/recovery transition** and ensure listeners/queue worker start only after revalidation and catch-up.
- [ ] **Step 4: Run focused hook/service tests**; expect the state sequence quota-limited → recovering → online only on full success.

### Task 4: Present concise mode status through Activity Center

**Files:**
- Modify: existing Activity Center/notification UI and network-state indicator components
- Test: associated component tests

- [ ] **Step 1: Add tests** for green online, red offline, gray quota-limited status and an auto-dismissing top notification that identifies the actual mode.
- [ ] **Step 2: Implement the status mapping**; put persistent details and retry estimate in Activity Center, avoid blocking modals for quota state.
- [ ] **Step 3: Verify** the notification does not claim quota is equivalent to offline and users can continue local work.

### Task 5: Integrated quota recovery verification

- [ ] **Step 1: Run focused network, rate hook, and pending-write tests.**
- [ ] **Step 2: Run** `npm test -- --run` with stable worker limit.
- [ ] **Step 3: Inspect Firestore call sites** to confirm quota mode only permits the scheduled probe.
- [ ] **Step 4: Run** `git diff --check` and record that actual Firebase quota reset timing remains service-controlled.

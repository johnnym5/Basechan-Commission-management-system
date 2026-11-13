# Year-Based Rate Dataset Lifecycle and Isolation

**Date:** 2026-11-13
**Status:** Draft for user review
**Scope:** Dataset ownership, visibility, mutation isolation, migration, and cleanup for rate data.

## Goal

Let Admins manage rate data in year-based datasets. A dataset such as **2027** may contain January, September, and any other intake imported for that year. Admins may enable multiple datasets together. Normal rate views combine enabled datasets and identify the dataset for every rate. Disabling or editing one dataset must never expose, overwrite, or delete records from another dataset.

The feature replaces sheet-name/intake matching as the main data lifecycle boundary. Intake sheets remain useful categories inside a dataset.

## Confirmed user requirements

- Datasets group rates by a year or user-defined year label, not by one intake.
- A 2027 dataset can contain Jan 2027, Sept 2027, and other 2027 imports.
- Admins can enable several datasets at once, for example 2026 and 2027.
- Normal pages combine enabled datasets; disabled datasets are hidden from normal views.
- Each rate card and its detail modal identify the owning dataset.
- A dataset’s edits, imports, role projections, packages, and cleanup must be isolated from other datasets.
- Admins need to disable/lock an old dataset, re-enable it later, or permanently delete it.
- The existing mock data must be assignable to a dataset and safely retired before real 2027 data is used.

## Current behavior and observed purge gap

Rates currently have `intake` and optional `sourceSheet`, but no dataset identifier. The rate ID is generated from university, intake, aggregator, and study level. Therefore, the current data model cannot distinguish ownership by dataset if two datasets contain the same route identity.

The Sheet Manager’s “Purge All Sheets” builds its target list from rate-derived sheet names, `sheet_settings`, and the default intake, then calls `deleteSheets`. That function queries rate documents by `sourceSheet` and `intake` in the canonical and role-projection paths, plus matching sheet/lifecycle settings. It does not delete the newer published package log, and it cannot find documents whose sheet/intake metadata does not match a listed name. “Delete Offline Data” clears local cached data; it is a different operation from deleting the cloud dataset. These controls do not currently represent a complete, durable dataset boundary.

The current package heads and logs are role-scoped but not dataset-scoped. Dataset work must make their scope explicit; filtering the UI alone is insufficient.

## Recommended architecture

Store rate-owned data under a Firestore dataset namespace. Keep a small top-level registry document per dataset for lifecycle metadata, while rates, role projections, dataset settings, overrides, and package history use dataset-specific subcollections.

Illustrative layout:

```text
rate_datasets/{datasetId}
  rates/{rateId}
  staff_rates/{opaqueRateId}
  agent_rates/{opaqueRateId}
  organization_agent_rates/{organizationId}/rates/{opaqueRateId}
  agent_rate_overrides/{uid}/rates/{opaqueRateId}
  sheet_settings/{sheetId}
  intake_lifecycles/{intakeId}
  package_heads/{roleScope}
  packages/{roleScope}/entries/{packageId}
    chunks/{chunkId}
```

The exact collection nesting may follow Firestore path constraints discovered during planning, but every rate and package path must include a stable dataset ID. Shared university identity records remain global: deleting one year’s rate data must not delete a university still used by another dataset.

Each `CommissionRate`, Staff projection, Agent projection, local operation, import batch, package manifest, package delta, and audit event carries `datasetId`. Rate document IDs remain unique within a dataset namespace. This permits the same university/intake/route identity in different years without collisions.

Each dataset registry record includes at least:

- `id`, `label` (for example `2027`), and `year` where applicable;
- `enabled`: whether the dataset participates in normal Admin/Staff/Agent rate views;
- `locked`: whether mutations/imports/package publication are allowed;
- `createdAt`, `createdBy`, `updatedAt`, and migration/cleanup state;
- dataset-scoped default intake and intake lifecycle references/settings.

`enabled` and `locked` are separate controls. Disabling a dataset hides it from normal rate pages and makes it read-only. Locking an enabled dataset keeps it visible but read-only. An Admin may re-enable or unlock it through the dataset manager. Disabled data remains available to Admins from the dataset-management/archive view, not mixed into the normal rate table.

## Views and imports

- The normal rate view loads the union of enabled datasets for the current role and marks each rate with its dataset label. Dataset filters can narrow the union without changing ownership.
- Every rate card and rate detail modal shows the dataset label. Admin edit/detail flows retain the exact dataset ID, including when multiple datasets contain the same school and intake.
- A create/import flow requires an explicit target dataset. A workbook can contain multiple intakes, but all imported rows go to the selected dataset unless a later design explicitly adds row-level dataset mapping. Intake text does not silently determine dataset ownership.
- If the selected dataset is locked or disabled before an operation publishes, the write is rejected locally and by Firestore rules. Pending local operations remain recoverable and clearly indicate which dataset is locked.
- Dataset-scoped defaults, sheet visibility, lifecycles, agent-rate projections, organization/personal overrides, and exports must not cross dataset boundaries.

## Package synchronization and local cache

- Package heads, immutable package manifests/chunks, cursors, and audit entries are scoped by both dataset and role. A change in dataset cannot advance or replace another dataset’s cursor.
- The Admin basket groups pending changes by dataset. A single upload can batch selected changes from one dataset into independently publishable packages. It must never create a package spanning datasets; selection across datasets is partitioned by dataset and reports each result independently.
- Successful dataset packages are acknowledged locally; failed or ambiguous packages remain associated with their dataset and stable package ID for safe retry.
- Local IndexedDB stores materialized rates and cursors by UID, role, access scope, organization, and dataset. The visible rate view combines only enabled dataset caches. Role changes and Agent organization changes cannot reuse incompatible data.
- Staff/Agent package variants preserve the current role restrictions. Staff cannot receive Admin rates. Agents receive only eligible Agent rates and never master rate, margin, or route-default fields.
- Checkpoints are dataset- and role-scoped. A new device downloads an authorized checkpoint for each enabled dataset and replays packages after that dataset’s cursor. Retention for one dataset cannot prune another dataset’s history.

## Dataset lifecycle and permanent deletion

The Settings area gains a Dataset Manager. Each dataset card shows its label, enabled/locked state, intake count, rate counts, and actions to enable/disable, lock/unlock, inspect, or delete. It is separate from the existing intake/sheet manager because a dataset can contain many intake sheets.

Permanent deletion is a deliberate, separately confirmed action. The Admin first disables and locks the dataset. The UI shows a preview of owned records and requires explicit confirmation. Cleanup is resumable and reports progress; it removes all dataset-owned canonical rates, role projections, overrides, sheet/lifecycle settings, packages/chunks, checkpoints, cursors, and associated local cache entries. The dataset registry is removed only after its owned data is verified empty. Global university identity documents and records belonging to other datasets are not deleted.

Firestore client deletion is not a single atomic operation across arbitrarily many documents. The cleanup process therefore needs deterministic collection enumeration, bounded deletes, a durable progress marker, idempotent retries, and a final empty verification. If any path cannot be enumerated or deleted, the dataset remains disabled/locked and the UI reports incomplete cleanup rather than claiming success.

The current “Purge All Sheets” action must be relabeled or narrowed so it cannot imply it deletes the whole database. It may remain as an intake-level operation inside one selected dataset, after its scope and impact are explicit. “Delete Offline Data” remains a local-cache operation and must be labeled separately.

## Migration and rollout

Existing records have no reliable `datasetId`; assignment must be explicit and reviewable.

1. Add a migration preview that reads legacy canonical rates, role projections, settings, overrides, and package state. Show record counts grouped by source sheet/intake and identify rows whose ownership is ambiguous.
2. Let an Admin map legacy sheet/intake groups to a dataset, with row-level exceptions for ambiguous or mixed groups. Do not infer dataset only from intake year or sheet name.
3. Create a protected migration snapshot/export and a resumable migration manifest. Copy records into namespaced locations without deleting legacy data.
4. Validate source/destination counts, IDs, role projections, and package baseline/checkpoint state. Surface duplicate identities and rows with no valid dataset assignment for Admin resolution.
5. Cut readers and writers over to dataset-scoped paths only after validation. Create a baseline checkpoint per migrated dataset/role; legacy package history without reliable dataset ownership is not replayed into a new dataset stream.
6. Keep the original legacy data intact during a rollback window. A separate verified cleanup can remove legacy mock records and unscoped package history after the Admin confirms the migrated datasets are correct.

Imports created after cutover always target a dataset explicitly. Existing pending local changes without `datasetId` are not silently assigned or published; migration presents them for explicit assignment or discard.

## Firestore security

- Admins may read all dataset metadata and data. Only Admins may create datasets, change lifecycle flags, write rate packages, or start permanent cleanup.
- Staff and Agents may read only enabled datasets and their role-safe subcollections. Agents remain limited to authorized rate projections and override layers.
- Locked/disabled status is enforced on all write paths, not just in UI controls. Rules must prevent package publication and direct legacy writes from bypassing a locked dataset.
- Client-side filtering is not a security boundary. Rules and service-side validation must agree on `datasetId`, dataset state, and role scope.
- Legacy collection access is tightened or removed only after migration and rollback requirements are met.

## Acceptance criteria

- An Admin can create a 2027 dataset and import January and September 2027 rates into it without mixing them into 2026 data.
- Enabling 2026 and 2027 together shows both datasets; each visible rate card and its detail modal identify the owning dataset.
- Disabling 2027 hides its records from normal views; enabling 2026 does not overwrite, delete, or change 2027 records.
- A locked dataset remains visible if enabled but rejects local edits, imports, direct writes, and package publication.
- The same school/intake/route can exist in two datasets without ID collision or cross-dataset edit/delete behavior.
- Staff and Agent dataset views expose only their authorized role projections.
- Dataset migration presents assignment preview and validates the copy before legacy cleanup is available.
- Deleting a dataset removes all of its owned package and rate data through a resumable, verifiable operation without deleting shared universities or another dataset.
- A failed delete remains clearly incomplete and can be retried safely.

## Out of scope

- Automatic assignment of every legacy record based on guessed year semantics.
- Cloud Functions, callable APIs, or hosted server workers.
- Cross-dataset writes or package transactions.
- Deleting shared university identity records as a side effect of deleting a year.
- Treating a hidden/disabled dataset as deleted.

## Known risks and planning questions

- This is a broad migration across imports, admin editing, role projections, dashboards, exports, local IndexedDB, package delivery, Firestore rules, and cleanup. Planning should inventory direct reads/writes before implementation.
- Existing tests and tools may assume root-level `rates`, `staff_rates`, `agent_rates`, or one global package head. A compatibility bridge and staged rollout are required.
- Firestore rules cannot recursively delete a dataset; cleanup must enumerate every supported child collection and be resumable.
- The exact dataset selection UI for multi-dataset views and the legacy migration mapping interaction should be detailed during implementation planning. The safety requirements above are fixed: ownership is explicit, migration is reviewable, and disabled datasets are read-only.

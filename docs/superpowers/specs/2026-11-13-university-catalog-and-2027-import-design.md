# University Catalog and January 2027 Import Design

## Goal

Prepare a clean workbook and an admin-only catalog import path so the full known university list can be loaded without inventing rate records for schools that do not yet have rates. Import the actual January 2027 commission routes from the supplied rate workbook. Keep the live database unchanged until the prepared workbook has been reviewed and a separate replacement operation is authorized.

## Source workbook findings

- `Basechan_Commission_Directory_Admin_2026-11-12.xlsx` contains 1,797 rate rows across 15 country tabs and 349 distinct university-country entries.
- `Jan 2027 Commission Master.xlsx` contains 370 rows, all for Jan 2027, split between CRIZAC (182), KC OVERSEAS (138), and UAP (50). It has 122 distinct university-country entries, both UG and PG levels, no blank rate values, no blank notes, and no duplicate route keys.
- 84 Jan 2027 universities match the existing directory by normalized name and country. The remaining 38 are confirmed by the user as new universities and must be added to the catalog under the names supplied in the Jan 2027 workbook.

## Approved design

### Prepared workbook

Create a new import workbook; do not edit either source workbook. It contains:

1. **University Catalog** — one row per unique normalized name-country pair from the directory plus the 38 confirmed new universities, for 387 catalog entries total. Preserve the display name and country from the existing directory for matches; use the Jan 2027 workbook's spelling and country for the 38 new schools.
2. **Jan 2027 Rates** — the 370 actual route rows from the Jan 2027 source. Preserve university identity, country, intake, study level, aggregator, guidance, rate type, rate values, and notes from that source. Do not carry any old 2026 rates into this tab.

Catalog-only universities have no rate row. Do not create placeholder routes or zero-rate records for them. Rate values, type/currency, and notes on the Jan 2027 tab come from the Jan 2027 workbook; fields needed to identify each route stay with their source values. The parser recalculates the app's derived margin from the imported master and agent values rather than trusting a stale spreadsheet formula.

### App parser and import flow

- Extend workbook parsing to recognize the two tab roles independently: catalog rows create university catalog records; rate rows create only actual commission routes.
- Show separate preview counts for catalog entries and rate routes, and block upload when the required headers are missing, a row has an invalid identity, or duplicate route keys conflict.
- Upsert catalog entries idempotently by stable normalized name-country identity into a new Admin-only Firestore collection. Do not put unrated catalog-only schools into the existing `universities` collection, which is readable by non-admin users.
- Upload rate rows through the existing rate-write path and tag them with the Admin-selected target dataset. Do not hard-code the dataset document ID.
- Add Admin catalog entries as selectable university suggestions when creating a rate in the Admin rate editor. Once a real route is created, existing rate-write behavior may publish that school through the current rate/read-model paths.
- Keep import error reporting truthful if one part succeeds and another fails. Re-importing the workbook must not duplicate catalog records or route records.
- Add Firestore rules that allow only Admins to read/write the private catalog collection. Staff and Agents continue to see only rate records they are authorized to access.

## Out of scope

- Do not clear, delete, or migrate any live Firestore data in this work.
- Do not modify the supplied source workbooks.
- Do not create placeholder rates for catalog-only universities.
- Do not change Staff/Agent rate visibility or add catalog-only universities to their views.

## Acceptance criteria

- The prepared workbook has exactly 387 unique catalog entries and 370 Jan 2027 route rows, with no legacy rates copied into the new rate tab.
- The importer recognizes catalog-only entries without generating rates and imports the 370 actual rates with notes and route identity intact.
- Re-importing the workbook is idempotent.
- Admin can find a catalog-only school when adding a route; Staff and Agents cannot read or see catalog-only records.
- No live Firestore data is cleared as part of preparing or importing this workbook.

## Review gate

The user reviews this written design before an implementation plan is written. Workbook creation and code implementation begin only after the design and subsequent implementation plan are approved.

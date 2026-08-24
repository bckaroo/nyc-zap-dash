# ZAP Public Dashboard — MVP Brief

**Date:** 2026-08-16  
**Status:** Internal planning artifact; no publication authorized  
**Task:** `task-*zap-dashboard*`

## Product and Audience

The dashboard is a public reference companion to the curated ZAP Newsletter. Its primary audience is NYC planners, land-use attorneys, developers, journalists, community-board members, and civically engaged residents who need a quick view of active zoning applications without manually searching ZAP.

The core user need is: “Show me what is active, where it is, what review stage it has reached, and where I can verify it in the official record.” The dashboard should identify itself as an application tracker, not an official City product or an editorial endorsement.

## MVP Capabilities

- Summary counts by borough and public-review status.
- Search by project name/brief and applicant.
- Filters for borough, status, community district, and flood-zone flag.
- Sortable application table with latest milestone, applicant, CEQR fields, and official ZAP link.
- Detail view with the available project brief and source fields.
- Responsive desktop/mobile presentation and a visible “data last refreshed” timestamp.
- Plain-language source, methodology, limitations, and unofficial-product disclaimer.

Not in v1: accounts, user submissions, alerts, comments, personalized views, a public write API, or editorial scoring.

## Data Sources and Boundaries

Primary source: NYC Department of City Planning ZAP data distributed through NYC OpenData. The existing local SQLite database (`zap-applications.db`, table `zap_applications`) remains the staging/history layer. The existing exporter produces a static JSON snapshot for the dashboard.

Useful existing fields include project identifiers, name/brief, borough, community district, public status, applicant, CEQR fields, flood-zone flags, milestone dates, and first/last-seen dates. Every record should link to the official ZAP project page.

Before publication, validate the snapshot against the current source schema and document that records may lag, contain source-data omissions, or change after refresh. The public bundle must exclude local paths, operational metadata, credentials, recipient information, unpublished editorial notes, and fields not required by the interface.

## Architecture Recommendation

Keep v1 as the existing static HTML/CSS/JavaScript application generated from SQLite to JSON:

`NYC OpenData → existing ingestion/SQLite → export script → static JSON + dashboard → static host`

This is the recommended architecture because it has no public database or API attack surface, costs little to operate, can be cached, and does not alter the newsletter pipeline. A framework or hosted database is unnecessary until usage demonstrates a need for server-side search, accounts, high-frequency refresh, or substantially larger datasets.

Recommended refresh for launch: run with the newsletter cadence. Move to daily only after the export and deployment steps are automated and monitored.

## Deployment, Privacy, and Governance

- Keep the prototype unpublished until Andrew approves the host and public identity.
- Prefer an existing approved static host/domain. GitHub Pages is the reversible fallback if a public repository and its branding are acceptable.
- Publish only data already present in the official public source; minimize fields to those needed for the product.
- Add an “Unofficial tracker; verify with NYC Planning” disclaimer, source attribution, last-refresh time, and contact/correction path.
- Do not add analytics for MVP unless Andrew selects a privacy-appropriate option and approves its policy implications.
- Use HTTPS, no secrets in the bundle, dependency-free frontend where practical, and an explicit rollback path (remove/replace static files).
- Confirm whether VHB/client branding, review, accessibility, records-retention, or communications approval applies before launch.

## Milestones

1. **Scope gate (current):** approve host, public name/owner, record inclusion policy, and refresh cadence.
2. **Data/privacy QA:** regenerate snapshot; inspect exposed fields; validate counts, links, timestamps, disclaimer, and methodology.
3. **Product QA:** keyboard/accessibility check plus desktop/mobile/browser review; resolve defects.
4. **Staging review:** place the build on a non-public or access-limited preview and obtain owner approval.
5. **Launch:** publish static assets, verify the production URL, and document rollback.
6. **Operate:** monitor refresh failures and broken source links; review scope after 30 days of real use.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Stale or incomplete source data | Show refresh time and source caveat; retain official links. |
| Users mistake tracker for an official City product | Prominent unofficial-product disclaimer and neutral branding. |
| Private/operational fields leak into JSON | Allowlist export fields and inspect the final bundle before every launch. |
| Static deployment silently stops refreshing | Start at newsletter cadence; log export/deploy result and alert on failure. |
| Scope expands into a bespoke web platform | Hold v1 to static search/filter/detail; revisit architecture only with evidence. |
| Accessibility or mobile usability defects | Run keyboard, contrast, responsive, and screen-reader-oriented checks before launch. |
| Branding/employer-policy conflict | Obtain explicit ownership/branding/communications decision before public release. |

## Decisions Required from Andrew

1. **Host:** approved existing static site/domain (recommended) or GitHub Pages fallback.
2. **Identity/ownership:** “ZAP Dashboard” (recommended neutral v1 name), and whether it is personal, newsletter, or VHB-branded.
3. **Coverage:** all tracked active records (recommended) or only newsletter-vetted records.
4. **Refresh:** newsletter cadence (recommended for launch) or daily.

## Next Concrete Action

Andrew answers the four-item scope gate above. Once answered, the next internal action is a final allowlist-based data export and accessibility/privacy QA pass against the existing static prototype. No deployment should occur during that pass.

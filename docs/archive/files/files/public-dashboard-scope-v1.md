# ZAP Public Dashboard — Scope v1

**Date:** 2026-06-04  
**Owner:** Xiaozhu  
**Source task:** `task-*zap-dashboard*`  
**Project:** ZAP Newsletter

## Goal

Create a public-facing ZAP dashboard that turns the existing newsletter dataset into a scannable civic intelligence product: current land-use applications, borough distribution, public-review status, recent milestones, and links back to official ZAP project records.

The dashboard should complement the newsletter rather than replace it. The newsletter remains the editorial digest; the dashboard becomes the searchable, always-current public reference layer.

## Current Data Baseline

Database: `projects/newsroom/zap-newsletter/zap-applications.db`

Table: `zap_applications`

Current snapshot checked 2026-06-04:

| Metric | Value |
|---|---:|
| Tracked records | 102 |
| Boroughs represented | 5 |
| Public statuses | 3 |
| Brooklyn records | 28 |
| Queens records | 21 |
| Staten Island records | 20 |
| Manhattan records | 18 |
| Bronx records | 15 |

Status distribution:

| Status | Count |
|---|---:|
| In Public Review | 45 |
| Filed | 42 |
| Noticed | 15 |

Useful fields already available:

- `id`, `project_id`, `project_name`, `project_brief`
- `borough`, `community_district`
- `public_status`, `ulurp_non`
- `ceqr_number`, `ceqr_type`, `eas_eis`
- `primary_applicant`, `applicant_type`
- `flood_zone_a`, `flood_zone_shadedx`
- `milestone_date`, `certified_referred`
- `first_seen_date`, `last_updated_date`, `newsletter_included`

## MVP Product Shape

### Primary View

A dense dashboard table of applications with:

- project name
- borough and community district
- public status
- latest milestone date
- applicant
- CEQR number/type when available
- flood-zone flags
- official ZAP link

### Summary Layer

Above the table:

- total active tracked applications
- applications by public status
- applications by borough
- most recent milestone date
- count of projects flagged in flood zone A or shaded X

### Filters

Minimum useful filter set:

- borough
- public status
- community district
- applicant keyword
- text search across project name and brief
- flood-zone flag

### Detail Drawer

For each row:

- project brief
- applicant details
- CEQR fields
- timeline fields currently available in the database
- official source link: `https://zap.planning.nyc.gov/projects/{id}`

## Recommended Tech Stack

Start with a static HTML/JS dashboard generated from SQLite into JSON.

Rationale:

- lowest operational risk
- no public API surface needed for v1
- easy to host as a static artifact
- uses the existing SQLite database without changing the newsletter pipeline
- reversible if the product later needs Next.js, authentication, or richer data sync

Suggested pipeline:

1. Query `zap_applications`.
2. Export `files/public-dashboard-data.json`.
3. Render `files/public-dashboard/index.html`.
4. Host static folder or mirror to the chosen public destination.

## MVP Build Steps

1. Add a data export script that produces JSON from `zap_applications`.
2. Build a static dashboard shell with summary cards, filters, table, and detail drawer.
3. Add links to official ZAP records.
4. Run visual QA at desktop and mobile widths.
5. Decide hosting destination before publishing externally.

## Open Decisions

- Hosting destination: existing site/static host, Google Drive publish workaround, GitHub Pages, or another VHB-approved location.
- Public copy/branding: "ZAP Weekly", "Zoning Watch", or a neutral civic-data brand.
- Refresh cadence: same as newsletter cron, daily, or manual while in prototype.
- Whether public dashboard should include only newsletter-vetted projects or every tracked record.

## Recommendation

Build v1 as an internal static prototype first, using all tracked records. Keep it unpublished until Andrew chooses the hosting and branding path. This creates a visible artifact without making an external-facing commitment.

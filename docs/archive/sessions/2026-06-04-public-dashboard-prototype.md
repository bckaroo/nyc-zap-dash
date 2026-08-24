# 2026-06-04 — Public Dashboard Prototype

## Summary

Built the internal static prototype for the ZAP public dashboard described in `files/public-dashboard-scope-v1.md`.

## Work Completed

- Added `files/export-public-dashboard-data.py` to export `zap_applications` from `zap-applications.db`.
- Generated `files/public-dashboard-data.json` with 102 records, summary metrics, borough/status counts, flood-zone flags, and official ZAP project URLs.
- Built `files/public-dashboard/index.html`, `app.js`, and `styles.css` using plain HTML/CSS/JS.
- Included summary metrics, borough/status breakdowns, filters, dense table, detail drawer, and official ZAP links.
- Captured desktop and mobile screenshots after serving the static folder locally.

## Verification

- `python3 projects/newsroom/zap-newsletter/files/export-public-dashboard-data.py`
- JSON validation with `python3 -m json.tool`
- Content checks for dashboard data path, filters, detail panel, and official links
- Playwright render check at `1440x920` and `390x844`; both loaded 102 table rows and displayed the total metric as `102`

## Notes

This remains internal/static only. No external publishing or messaging was performed.

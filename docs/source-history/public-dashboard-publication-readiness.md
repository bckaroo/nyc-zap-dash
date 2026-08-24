# ZAP Public Dashboard — Publication Readiness

**Date:** 2026-06-05  
**Task:** `task-*zap-dashboard*`  
**Status:** Internal decision brief only; dashboard remains unpublished.

## Current Artifact

The internal static dashboard prototype is ready for a hosting and branding decision:

- Prototype: `projects/newsroom/zap-newsletter/files/public-dashboard/index.html`
- Data export: `projects/newsroom/zap-newsletter/files/export-public-dashboard-data.py`
- Static data bundle: `projects/newsroom/zap-newsletter/files/public-dashboard-data.json`
- Local preview command:

```bash
cd projects/newsroom/zap-newsletter/files/public-dashboard
python3 -m http.server 8765
```

## Publication Gate

Do not publish until Andrew decides:

1. Hosting destination.
2. Public name / branding.
3. Refresh cadence.
4. Whether v1 includes all tracked ZAP records or only newsletter-vetted records.

## Hosting Options

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| Static host / existing website | Clean public URL, normal analytics path, durable | Requires access to hosting account and deployment target | Best default if Andrew has a preferred site |
| GitHub Pages | Fast, free, simple static deployment | Public repo or GitHub Pages setup needed; branding may feel technical unless custom domain added | Good prototype-public path |
| Google Drive / Docs workaround | Quick sharing | Unpolished, weak URL/analytics, not ideal for a public data product | Avoid except for private review |
| Keep internal only | No publication risk | Does not satisfy public-facing task | Use only while branding/hosting is undecided |

## Branding Options

| Name | Positioning | Notes |
|---|---|---|
| ZAP Dashboard | Neutral, literal, tied to source data | Recommended for v1 because it is clear and low-risk |
| Zoning Watch NYC | More editorial/public-facing | Better if this becomes a broader civic-data product |
| Land Use Tracker NYC | Plain-language civic utility | Good if audience includes non-planners |

## Recommended v1 Decision

Use **ZAP Dashboard** as the v1 public name, publish as a static site on Andrew's preferred host or GitHub Pages, and refresh manually or on the newsletter cadence until the public workflow is proven.

For the first public cut, include **all tracked active records** and label the product as an "application tracker" rather than implying editorial endorsement. The newsletter can remain the curated digest.

## Pre-Publish Checklist

- [ ] Andrew confirms hosting destination.
- [ ] Andrew confirms public name / branding.
- [ ] Run `python3 projects/newsroom/zap-newsletter/files/export-public-dashboard-data.py`.
- [ ] Preview locally at desktop and mobile widths.
- [ ] Confirm official ZAP links resolve.
- [ ] Confirm no private notes, drafts, credentials, or local file paths are exposed in the dashboard bundle.
- [ ] Decide analytics approach, if any.
- [ ] Publish static `files/public-dashboard/` plus the required data JSON at the chosen destination.

## Do Not Do Autonomously

- Do not publish, upload, or share externally.
- Do not create a public repository.
- Do not connect analytics or a custom domain.
- Do not change newsletter delivery or cron behavior.

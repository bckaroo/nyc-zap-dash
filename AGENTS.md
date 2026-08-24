## DevOS

This repository is the canonical code home for **ZapDash** (`PROJ-002`) in
DevOS. Track implementation work in DevOS before starting it, use the
registered repository path rather than creating parallel copies, and cite the
relevant `DEV-###` identifier in commits. The active queue owns the work;
human approval is required before a task moves to `DONE`.

## Product boundary

ZapDash is the public-facing dashboard and the maintained implementation of
the ZAP newsletter data pipeline. Its weekly collector and draft generator
produce review-only output: no workflow may send email without an explicit
human approval action.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

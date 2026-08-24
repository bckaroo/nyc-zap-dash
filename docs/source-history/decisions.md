# Decisions — ZAP Newsletter

## DEC-001: NYC OpenData ZAP API as Data Source (2026-03)

**Context:** NYC zoning and land use change tracking needed reliable, authoritative data.  
**Decision:** Pull zoning application data from NYC OpenData ZAP API and CSV feed.  
**Rationale:** NYC OpenData provides authoritative source for ZAP (Zoning Application Portal) data. API access enables automated, regular updates without manual data entry.  
**Who decided:** Andrew  

**Consequences:** Data pipeline from NYC OpenData → SQLite → HTML generation → email delivery.

---

## DEC-002: Crain-Style HTML Formatting (2026-03)

**Context:** The newsletter needed professional, readable formatting for delivery to subscribers.  
**Decision:** Adopt Crain-style HTML formatting, grouped by borough with clear section headers.  
**Rationale:** Professional formatting increases readability and credibility. Borough grouping provides logical organization for NYC-focused readers.  
**Who decided:** Andrew  

**Consequences:** Newsletter is delivered as formatted HTML email with Crain-style aesthetics.

---

## DEC-003: Thursday 7:00 AM ET Delivery (2026-03)

**Context:** Newsletter delivery needed consistent timing for reader habits.  
**Decision:** Schedule delivery for Thursday at 7:00 AM ET.  
**Rationale:** Thursday delivery captures mid-week zoning activity and arrives before weekend reading. Morning delivery suits professional readers checking email at start of workday.  
**Who decided:** Andrew  

**Consequences:** Cron job delivers newsletter Thursday mornings. Delivery has experienced routing instability requiring model configuration changes.

---

## DEC-004: Database-Backed Pipeline (2026-03)

**Context:** Newsletter generation needed persistent storage to avoid duplicate items and track changes over time.  
**Decision:** Use SQLite database as intermediary between ZAP API and HTML generation.  
**Rationale:** SQLite provides persistent storage, deduplication, and historical tracking. The database enables comparison across weeks and efficient incremental updates.  
**Who decided:** Andrew  

**Consequences:** Pipeline: NYC OpenData → ZAP API → SQLite → HTML → email. Database tracks all zoning applications over time.
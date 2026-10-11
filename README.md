# Nigeria University Scholarships Service

An Express API starter for discovering and maintaining scholarship opportunities relevant to Nigerian university students for the configured academic session. Default session: **2026/2027**.

## Important accuracy note

This is a discovery and review service, not a claim that a crawler can reliably identify *every* scholarship online. University scholarship notices are published across many sites and formats. The crawler only checks the official sources in `src/sources.js`, extracts scholarship-related links, and saves them as candidates. A candidate is **not verified or automatically safe to publish** merely because it was discovered. Add individual university scholarship pages and approved feeds to the registry, then verify eligibility, academic session, application URL, deadline and status from the primary source.

Missing deadlines do not mean applications are open. Do not publish an opportunity as `open` unless the primary source supports that status.

## Requirements

- Node.js 20+
- npm
- A long random admin API key

## Run locally

```bash
cp .env.example .env
# Edit .env and set ADMIN_API_KEY to a long random secret
npm install
npm start
```

Health check: `GET http://localhost:3080/health`

## Endpoints

### Public
- `GET /health`
- `GET /api/scholarships` — defaults to `CURRENT_ACADEMIC_SESSION`
- `GET /api/scholarships?session=2026/2027&status=open`
- `GET /api/scholarships?q=engineering&level=undergraduate`
- `GET /api/scholarships/:id`
- `GET /api/sources`
- `GET /api/crawl-runs`

### Admin (send `x-admin-api-key: <ADMIN_API_KEY>`)
- `POST /api/admin/crawl` — run discovery crawl
- `POST /api/admin/sources` — add a verified source URL
- `PATCH /api/admin/sources/:id` — enable/disable or edit source metadata
- `POST /api/admin/scholarships` — create/update a scholarship record
- `PATCH /api/admin/scholarships/:id/verification` — verify or change status

Example create:
```bash
curl -X POST http://localhost:3080/api/admin/scholarships \\
  -H 'content-type: application/json' \\
  -H 'x-admin-api-key: YOUR_SECRET' \\
  -d '{
    "title":"Example University Scholarship",
    "provider":"Example Foundation",
    "universityName":"Example University",
    "academicSession":"2026/2027",
    "studyLevels":["undergraduate"],
    "status":"review_required",
    "sourceUrl":"https://example.edu.ng/scholarships",
    "sourceName":"Example University official scholarship page",
    "verificationNotes":"Needs manual verification before publishing."
  }'
```

## Data model and statuses

- Scholarship record is session-specific (`academicSession`).
- Source URL/name/type, retrieval timestamps, raw excerpt and verification notes preserve provenance.
- `open`, `upcoming`, `closed`, `suspended`, `unconfirmed`, `review_required`, `archived`.
- `verified_at` is set only through the admin verification endpoint with `verified: true`.
- Never infer `open` from a missing deadline.
- Keep overseas-only scholarships out of a Nigeria-based university list unless product requirements explicitly include Nigerians studying abroad.

## Add more university sources

Add source pages to `src/sources.js` or use the admin endpoint. Prefer:
1. Official university scholarship/financial-aid pages.
2. Official university newsroom/admissions pages.
3. Government or foundation pages that name participating Nigerian universities.
4. Reputable news only for discovery; verify the original notice before publishing.

Only crawl pages where permitted by site terms and `robots.txt`; respect rate limits and copyright. Do not bypass logins, paywalls or anti-bot controls. For broader discovery, connect a licensed search API or official feeds rather than scraping search engine result pages.

## Production checklist

- Put behind HTTPS and a reverse proxy.
- Use a secret manager for `ADMIN_API_KEY`; rotate it.
- Restrict CORS to the actual frontend origin.
- Add rate limiting and audit logs for admin mutations.
- Add scheduled crawl orchestration (cron/worker) and alerting.
- Back up the SQLite database; move to PostgreSQL if running multiple replicas.
- Add a moderation UI and immutable verification history before public launch.
- Configure a real contact address in the crawler user-agent.
- Test source pages and parsing after source layout changes.
- Use a proper SSRF-safe source fetcher before allowing untrusted users to add URLs (DNS/IP checks and redirect validation are not fully implemented in this starter).

## Initial official source registry

- National Universities Commission: https://www.nuc.edu.ng/
- Federal Ministry of Education: https://education.gov.ng/
- Federal Scholarships Board: https://education.gov.ng/federal-scholarships-board/

The registry is intentionally small and should be expanded to individual university pages as each is confirmed.

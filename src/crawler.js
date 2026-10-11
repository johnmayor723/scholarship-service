const cheerio = require("cheerio");
const config = require("./config");
const db = require("./db");
const { idFor, isoNow, classifyStatus } = require("./utils");

const SCHOLARSHIP_RE = /\bscholarship(s)?\b|\bbursary\b|\bstudentship\b|\baward scheme\b/i;
const SESSION_RE = /\b(2026\s*[\/-]\s*2027|2026\s*[-–]\s*2027|2026\/27|2027\s*[\/-]\s*2028)\b/i;

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.fetchTimeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "MySchoolPlacementScholarshipBot/1.0 (+contact: admin@myschoolplacement.com)",
        "Accept": "text/html,application/xhtml+xml"
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }
    return await response.text();
  } finally { clearTimeout(timer); }
}

function normalizeUrl(href, base) {
  try {
    const u = new URL(href, base);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    u.hash = "";
    return u.href;
  } catch { return null; }
}

function extractCandidates(html, pageUrl, source) {
  const $ = cheerio.load(html);
  const candidates = [];
  $("a").each((_, el) => {
    const title = $(el).text().replace(/\s+/g, " ").trim();
    const href = normalizeUrl($(el).attr("href"), pageUrl);
    if (!title || title.length < 12 || !href || !SCHOLARSHIP_RE.test(title)) return;
    const parentText = $(el).parent().text().replace(/\s+/g, " ").trim();
    const context = `${title}. ${parentText}`.slice(0, 1800);
    const sessionMatch = SESSION_RE.test(context);
    // Keep candidates for review even if session text isn't on the link itself;
    // the target page will be crawled in a later pass.
    candidates.push({
      title: title.slice(0, 300),
      url: href,
      context,
      sessionMatch,
      sourceName: source.name,
      sourceUrl: pageUrl,
      sourceType: source.type || "official"
    });
  });
  return [...new Map(candidates.map(c => [c.url, c])).values()];
}

function upsertCandidate(candidate, session) {
  const now = isoNow();
  const isCurrent = candidate.sessionMatch;
  const status = classifyStatus({
    text: candidate.context,
    applicationUrl: candidate.url,
    sessionMatch: isCurrent
  });
  const id = idFor(candidate.title, candidate.sourceName, session);
  const existing = db.prepare("SELECT id, verified_at FROM scholarships WHERE id = ?").get(id);
  db.prepare(`
    INSERT INTO scholarships (
      id, title, provider, university_name, description, academic_session,
      source_url, source_name, source_type, status, last_checked_at,
      discovered_at, updated_at, raw_excerpt, verification_notes
    ) VALUES (
      @id, @title, @provider, @university_name, @description, @academic_session,
      @source_url, @source_name, @source_type, @status, @last_checked_at,
      @discovered_at, @updated_at, @raw_excerpt, @verification_notes
    )
    ON CONFLICT(id) DO UPDATE SET
      last_checked_at=excluded.last_checked_at,
      updated_at=excluded.updated_at,
      raw_excerpt=excluded.raw_excerpt,
      status=CASE
        WHEN scholarships.verified_at IS NOT NULL THEN scholarships.status
        ELSE excluded.status
      END
  `).run({
    id,
    title: candidate.title,
    provider: candidate.sourceName,
    university_name: null,
    description: candidate.context,
    academic_session: session,
    source_url: candidate.url,
    source_name: candidate.sourceName,
    source_type: candidate.sourceType,
    status: isCurrent ? status : "review_required",
    last_checked_at: now,
    discovered_at: now,
    updated_at: now,
    raw_excerpt: candidate.context,
    verification_notes: isCurrent
      ? "Discovered by source crawler. Verify the target page, current session, deadline, eligibility and application portal before marking verified."
      : "Scholarship-related link discovered, but the current session was not confirmed from this page. Review required."
  });
  return existing ? 0 : 1;
}

async function seedSources() {
  const insert = db.prepare(`
    INSERT INTO source_registry(name,url,type,enabled,trust_level,notes,created_at)
    VALUES(@name,@url,@type,1,@trustLevel,@notes,@createdAt)
    ON CONFLICT(url) DO UPDATE SET name=excluded.name, notes=excluded.notes
  `);
  const sources = require("./sources");
  const tx = db.transaction(() => sources.forEach(s => insert.run({
    ...s, createdAt: isoNow()
  })));
  tx();
}

async function crawlAll() {
  await seedSources();
  const startedAt = isoNow();
  const run = db.prepare("INSERT INTO crawl_runs(started_at,status) VALUES(?,?)").run(startedAt, "running");
  const runId = run.lastInsertRowid;
  const sources = db.prepare("SELECT * FROM source_registry WHERE enabled=1 ORDER BY id").all();
  let candidatesFound = 0;
  let checked = 0;
  const errors = [];
  for (const source of sources) {
    try {
      const html = await fetchHtml(source.url);
      const candidates = extractCandidates(html, source.url, source);
      candidatesFound += candidates.length;
      candidates.forEach(c => upsertCandidate(c, config.currentSession));
      db.prepare(`UPDATE source_registry SET last_checked_at=?,last_status=?,last_error=NULL WHERE id=?`)
        .run(isoNow(), "ok", source.id);
    } catch (error) {
      const message = String(error.message || error).slice(0, 500);
      errors.push(`${source.name}: ${message}`);
      db.prepare(`UPDATE source_registry SET last_checked_at=?,last_status=?,last_error=? WHERE id=?`)
        .run(isoNow(), "error", message, source.id);
    }
    checked += 1;
    await new Promise(resolve => setTimeout(resolve, config.crawlDelayMs));
  }
  db.prepare(`UPDATE crawl_runs SET finished_at=?,status=?,sources_checked=?,candidates_found=?,error_summary=? WHERE id=?`)
    .run(isoNow(), errors.length ? (checked === errors.length ? "failed" : "partial") : "completed",
      checked, candidatesFound, errors.join("\n") || null, runId);
  return { runId, startedAt, finishedAt: isoNow(), sourcesChecked: checked, candidatesFound, errors };
}

module.exports = { crawlAll, seedSources, extractCandidates };
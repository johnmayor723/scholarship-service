const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const db = require("./db");
const config = require("./config");
const { crawlAll, seedSources } = require("./crawler");
const { seedKnownCurrentSessionRecord } = require("./seed");
const { safeJson, isoNow } = require("./utils");
const nigeriaScholarshipsRoutes = require("./nigeriaScholarshipsRoutes");

const app = express();
app.use(helmet());
app.use(cors({ origin: config.corsOrigin === "*" ? "*" : config.corsOrigin.split(",").map(s => s.trim()) }));
app.use(express.json({ limit: "1mb" }));

function requireAdmin(req, res, next) {
  if (!config.adminApiKey) return res.status(503).json({
    success: false, error: "Admin endpoints are disabled until ADMIN_API_KEY is configured."
  });
  const provided = req.get("x-admin-api-key");
  if (!provided || provided !== config.adminApiKey) return res.status(401).json({
    success: false, error: "Unauthorized"
  });
  next();
}

function serialize(row) {
  if (!row) return row;
  return {
    ...row,
    studyLevels: safeJson(row.study_levels),
    eligibleNationalities: safeJson(row.eligible_nationalities),
    eligibleLocations: safeJson(row.eligible_locations),
    fieldsOfStudy: safeJson(row.fields_of_study),
    source: { name: row.source_name, type: row.source_type, url: row.source_url },
    study_levels: undefined,
    eligible_nationalities: undefined,
    eligible_locations: undefined,
    fields_of_study: undefined,
    source_name: undefined,
    source_type: undefined,
    source_url: undefined,
    raw_excerpt: undefined
  };
}

app.get("/health", (_req, res) => res.json({
  success: true, service: "nigeria-university-scholarships-service",
  session: config.currentSession, timestamp: isoNow()
}));

app.get("/api/scholarships", (req, res) => {
  const session = String(req.query.session || config.currentSession);
  const status = req.query.status ? String(req.query.status) : null;
  const q = req.query.q ? `%${String(req.query.q).slice(0, 120)}%` : null;
  const level = req.query.level ? `%${String(req.query.level).slice(0, 80)}%` : null;
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);
  const offset = Math.max(Number(req.query.offset || 0), 0);
  const clauses = ["academic_session = @session"];
  const params = { session, limit, offset };
  if (status) { clauses.push("status = @status"); params.status = status; }
  if (q) { clauses.push("(title LIKE @q OR provider LIKE @q OR description LIKE @q OR fields_of_study LIKE @q)"); params.q = q; }
  if (level) { clauses.push("(study_levels LIKE @level OR eligibility LIKE @level)"); params.level = level; }
  const where = clauses.join(" AND ");
  const total = db.prepare(`SELECT COUNT(*) AS count FROM scholarships WHERE ${where}`).get(params).count;
  const rows = db.prepare(`SELECT * FROM scholarships WHERE ${where}
    ORDER BY CASE status WHEN 'open' THEN 1 WHEN 'upcoming' THEN 2 WHEN 'unconfirmed' THEN 3
    WHEN 'review_required' THEN 4 WHEN 'closed' THEN 5 ELSE 6 END, deadline IS NULL, deadline ASC
    LIMIT @limit OFFSET @offset`).all(params);
  res.json({ success: true, data: rows.map(serialize), meta: { session, total, limit, offset } });
});

app.get("/api/scholarships/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM scholarships WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: "Scholarship not found" });
  res.json({ success: true, data: serialize(row), meta: { session: config.currentSession } });
});

app.get("/api/sources", (_req, res) => {
  const rows = db.prepare(`SELECT id,name,url,type,enabled,trust_level,notes,last_checked_at,last_status,last_error
    FROM source_registry ORDER BY trust_level,name`).all();
  res.json({ success: true, data: rows, meta: { count: rows.length } });
});

app.use("/api/nigeria-scholarships", nigeriaScholarshipsRoutes);

app.get("/api/crawl-runs", (_req, res) => {
  const rows = db.prepare("SELECT * FROM crawl_runs ORDER BY id DESC LIMIT 20").all();
  res.json({ success: true, data: rows, meta: { count: rows.length } });
});

app.post("/api/admin/crawl", requireAdmin, async (_req, res) => {
  try {
    const result = await crawlAll();
    res.json({ success: true, data: result, meta: { session: config.currentSession } });
  } catch (error) {
    res.status(500).json({ success: false, error: "Crawl failed", meta: { message: error.message } });
  }
});

app.post("/api/admin/sources", requireAdmin, (req, res) => {
  const { name, url, type = "official", trustLevel = "primary", notes = "" } = req.body || {};
  if (!name || !url) return res.status(400).json({ success: false, error: "name and url are required" });
  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ success: false, error: "Invalid URL" }); }
  if (!["http:", "https:"].includes(parsed.protocol)) return res.status(400).json({ success: false, error: "Only HTTP(S) URLs are allowed" });
  try {
    const info = db.prepare(`INSERT INTO source_registry(name,url,type,enabled,trust_level,notes,created_at)
      VALUES(?,?,?,1,?,?,?)`).run(name.slice(0,200), parsed.href, type, trustLevel, String(notes).slice(0,1000), isoNow());
    res.status(201).json({ success: true, data: db.prepare("SELECT * FROM source_registry WHERE id=?").get(info.lastInsertRowid) });
  } catch (error) {
    res.status(409).json({ success: false, error: "Could not add source; URL may already exist", meta: { message: error.message } });
  }
});

app.patch("/api/admin/sources/:id", requireAdmin, (req, res) => {
  const allowed = ["name", "type", "enabled", "trust_level", "notes"];
  const updates = Object.entries(req.body || {}).filter(([key]) => allowed.includes(key));
  if (!updates.length) return res.status(400).json({ success: false, error: "No editable fields supplied" });
  const set = updates.map(([key]) => `${key} = ?`).join(", ");
  const values = updates.map(([key, value]) => key === "enabled" ? (value ? 1 : 0) : String(value).slice(0, 1000));
  const result = db.prepare(`UPDATE source_registry SET ${set} WHERE id=?`).run(...values, Number(req.params.id));
  if (!result.changes) return res.status(404).json({ success: false, error: "Source not found" });
  res.json({ success: true, data: db.prepare("SELECT * FROM source_registry WHERE id=?").get(Number(req.params.id)) });
});

app.post("/api/admin/scholarships", requireAdmin, (req, res) => {
  const body = req.body || {};
  const required = ["title", "academicSession", "sourceUrl"];
  const missing = required.filter(k => !body[k]);
  if (missing.length) return res.status(400).json({ success: false, error: `Required fields: ${missing.join(", ")}` });
  try {
    const id = body.id || require("./utils").idFor(body.title, body.provider || "", body.academicSession);
    const now = isoNow();
    db.prepare(`INSERT INTO scholarships
      (id,title,provider,university_name,description,academic_session,study_levels,eligible_nationalities,
       eligible_locations,fields_of_study,benefits,eligibility,application_url,deadline,status,source_url,
       source_name,source_type,source_published_at,last_checked_at,verified_at,verification_notes,
       discovered_at,updated_at,raw_excerpt)
      VALUES(@id,@title,@provider,@university_name,@description,@academic_session,@study_levels,@eligible_nationalities,
       @eligible_locations,@fields_of_study,@benefits,@eligibility,@application_url,@deadline,@status,@source_url,
       @source_name,@source_type,@source_published_at,@last_checked_at,@verified_at,@verification_notes,
       @discovered_at,@updated_at,@raw_excerpt)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title,provider=excluded.provider,university_name=excluded.university_name,
       description=excluded.description,study_levels=excluded.study_levels,eligible_nationalities=excluded.eligible_nationalities,
       eligible_locations=excluded.eligible_locations,fields_of_study=excluded.fields_of_study,benefits=excluded.benefits,
       eligibility=excluded.eligibility,application_url=excluded.application_url,deadline=excluded.deadline,status=excluded.status,
       source_url=excluded.source_url,source_name=excluded.source_name,source_type=excluded.source_type,
       source_published_at=excluded.source_published_at,last_checked_at=excluded.last_checked_at,
       verified_at=excluded.verified_at,verification_notes=excluded.verification_notes,updated_at=excluded.updated_at,raw_excerpt=excluded.raw_excerpt`)
      .run({
        id, title: String(body.title).slice(0,300), provider: body.provider || null,
        university_name: body.universityName || null, description: body.description || null,
        academic_session: body.academicSession,
        study_levels: JSON.stringify(body.studyLevels || []),
        eligible_nationalities: JSON.stringify(body.eligibleNationalities || ["Nigerian"]),
        eligible_locations: JSON.stringify(body.eligibleLocations || ["Nigeria"]),
        fields_of_study: JSON.stringify(body.fieldsOfStudy || []),
        benefits: body.benefits || null, eligibility: body.eligibility || null,
        application_url: body.applicationUrl || null, deadline: body.deadline || null,
        status: body.status || "review_required", source_url: body.sourceUrl,
        source_name: body.sourceName || null, source_type: body.sourceType || "official",
        source_published_at: body.sourcePublishedAt || null, last_checked_at: now,
        verified_at: body.verifiedAt || null, verification_notes: body.verificationNotes || "Manually entered; verify before publication.",
        discovered_at: now, updated_at: now, raw_excerpt: body.rawExcerpt || null
      });
    res.status(201).json({ success: true, data: serialize(db.prepare("SELECT * FROM scholarships WHERE id=?").get(id)) });
  } catch (error) {
    res.status(400).json({ success: false, error: "Invalid scholarship data", meta: { message: error.message } });
  }
});

app.patch("/api/admin/scholarships/:id/verification", requireAdmin, (req, res) => {
  const { status, verificationNotes, verified } = req.body || {};
  const allowedStatuses = ["upcoming", "open", "closed", "suspended", "unconfirmed", "review_required", "archived"];
  if (status && !allowedStatuses.includes(status)) return res.status(400).json({ success: false, error: "Invalid status" });
  const row = db.prepare("SELECT id FROM scholarships WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: "Scholarship not found" });
  const now = isoNow();
  db.prepare(`UPDATE scholarships SET status=COALESCE(?,status), verification_notes=COALESCE(?,verification_notes),
    verified_at=CASE WHEN ?=1 THEN ? WHEN ?=0 THEN NULL ELSE verified_at END, updated_at=? WHERE id=?`)
    .run(status || null, verificationNotes || null, verified === true ? 1 : verified === false ? 0 : -1,
      now, verified === true ? 1 : verified === false ? 0 : -1, now, req.params.id);
  res.json({ success: true, data: serialize(db.prepare("SELECT * FROM scholarships WHERE id=?").get(req.params.id)) });
});

app.use((req, res) => res.status(404).json({ success: false, error: "Route not found" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, error: "Internal server error" });
});

seedSources().then(() => {
  seedKnownCurrentSessionRecord();
  app.listen(config.port, () => console.log(`Scholarship API listening on :${config.port}; session=${config.currentSession}`));
}).catch(error => {
  console.error("Failed to initialize sources", error);
  process.exit(1);
});

module.exports = app;
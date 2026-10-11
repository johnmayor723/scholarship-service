const crypto = require("node:crypto");

function idFor(title, provider, session) {
  return crypto.createHash("sha256")
    .update(`${title || ""}|${provider || ""}|${session || ""}`.toLowerCase())
    .digest("hex").slice(0, 24);
}

function isoNow() { return new Date().toISOString(); }

function safeJson(value, fallback = []) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function classifyStatus({ deadline, text = "", applicationUrl, sessionMatch = true }) {
  const lower = `${text} ${deadline || ""}`.toLowerCase();
  if (!sessionMatch) return "archived";
  if (/suspend(ed)?|cancel(l)?ed|withdrawn/.test(lower)) return "suspended";
  if (deadline) {
    const date = new Date(deadline);
    if (!Number.isNaN(date.valueOf()) && date < new Date()) return "closed";
  }
  if (/applications? (are )?open|apply now|now accepting applications|application portal is open/.test(lower)) {
    return "open";
  }
  if (/will open|opens? in october|commence in october|opening soon|upcoming/.test(lower)) {
    return "upcoming";
  }
  // A missing deadline is not evidence that a scholarship is open.
  return applicationUrl ? "unconfirmed" : "review_required";
}

module.exports = { idFor, isoNow, safeJson, classifyStatus };
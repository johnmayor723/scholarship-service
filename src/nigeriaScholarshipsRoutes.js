const express = require("express");
const { compiledAt, scholarships } = require("./nigeriaScholarships.data");

const router = express.Router();

// Deliberately not the crawler/regex pipeline (crawler.js) and not gated behind
// /api/admin/scholarships verification — this returns the researched snapshot as-is.
router.get("/", (_req, res) => {
  res.json({
    success: true,
    data: scholarships,
    meta: {
      count: scholarships.length,
      compiledAt,
      note: "Manually researched snapshot, not live-crawled. Re-verify applicationUrl/deadline against the primary source before telling a student to apply."
    }
  });
});

module.exports = router;

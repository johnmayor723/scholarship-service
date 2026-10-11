require("dotenv").config();

module.exports = {
  port: Number(process.env.PORT || 3080),
  env: process.env.NODE_ENV || "development",
  currentSession: process.env.CURRENT_ACADEMIC_SESSION || "2026/2027",
  databasePath: process.env.DATABASE_PATH || "./data/scholarships.sqlite",
  adminApiKey: process.env.ADMIN_API_KEY || "",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  fetchTimeoutMs: Number(process.env.FETCH_TIMEOUT_MS || 15000),
  maxPagesPerSource: Number(process.env.MAX_PAGES_PER_SOURCE || 3),
  crawlDelayMs: Number(process.env.CRAWL_DELAY_MS || 1200)
};
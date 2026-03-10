require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const { handleMessage } = require("./router");
const { LOG_FILE } = require("./logger");

const app = express();
const PORT = process.env.PORT || 3000;

// Track server start time and request metrics
const serverStartTime = Date.now();
const requestMetrics = { total: 0, byIntent: {}, avgResponseTime: 0, responseTimes: [] };

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/**
 * POST /api/route
 * Body: { "message": "user's message here" }
 * Returns: { intent, confidence, persona, emoji, response, responseTime }
 */
app.post("/api/route", async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({
      error: "A non-empty 'message' string is required in the request body.",
    });
  }

  const startTime = Date.now();
  try {
    const result = await handleMessage(message.trim());
    const responseTime = Date.now() - startTime;

    // Track metrics
    requestMetrics.total++;
    requestMetrics.byIntent[result.intent] = (requestMetrics.byIntent[result.intent] || 0) + 1;
    requestMetrics.responseTimes.push(responseTime);
    if (requestMetrics.responseTimes.length > 100) requestMetrics.responseTimes.shift();
    requestMetrics.avgResponseTime = Math.round(
      requestMetrics.responseTimes.reduce((a, b) => a + b, 0) / requestMetrics.responseTimes.length
    );

    return res.json({ ...result, responseTime });
  } catch (error) {
    console.error("Error handling message:", error.message);
    return res.status(500).json({
      error: "An internal error occurred while processing your request.",
    });
  }
});

/**
 * POST /chat
 * Alias for /api/route — matches assignment spec endpoint
 * Body: { "message": "user's message here" }
 * Returns: { intent, confidence, response }
 */
app.post("/chat", async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({
      error: "A non-empty 'message' string is required in the request body.",
    });
  }

  const startTime = Date.now();
  try {
    const result = await handleMessage(message.trim());
    const responseTime = Date.now() - startTime;

    requestMetrics.total++;
    requestMetrics.byIntent[result.intent] = (requestMetrics.byIntent[result.intent] || 0) + 1;
    requestMetrics.responseTimes.push(responseTime);
    if (requestMetrics.responseTimes.length > 100) requestMetrics.responseTimes.shift();

    return res.json({
      intent: result.intent,
      confidence: result.confidence,
      response: result.response,
      responseTime,
    });
  } catch (error) {
    console.error("Error handling message:", error.message);
    return res.status(500).json({
      error: "An internal error occurred while processing your request.",
    });
  }
});

/**
 * GET /api/health
 * Health-check endpoint with uptime and metrics
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    totalRequests: requestMetrics.total,
  });
});

/**
 * GET /api/history
 * Returns the last 100 entries from route_log.jsonl
 */
app.get("/api/history", (req, res) => {
  try {
    if (!fs.existsSync(LOG_FILE)) return res.json({ entries: [] });
    const lines = fs.readFileSync(LOG_FILE, "utf8").split("\n").filter(Boolean);
    const entries = lines.slice(-100).map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
    return res.json({ entries });
  } catch (err) {
    console.error("Failed to read history:", err.message);
    return res.json({ entries: [] });
  }
});

/**
 * GET /api/stats
 * Returns session analytics: request counts, intent distribution, response times
 */
app.get("/api/stats", (req, res) => {
  const avgTime = requestMetrics.responseTimes.length > 0
    ? Math.round(requestMetrics.responseTimes.reduce((a, b) => a + b, 0) / requestMetrics.responseTimes.length)
    : 0;

  // Also calculate from log file for persistent stats
  let logStats = { code: 0, data: 0, writing: 0, career: 0, unclear: 0, total: 0 };
  try {
    if (fs.existsSync(LOG_FILE)) {
      const lines = fs.readFileSync(LOG_FILE, "utf8").split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.intent && logStats[entry.intent] !== undefined) {
            logStats[entry.intent]++;
            logStats.total++;
          }
        } catch { /* skip malformed lines */ }
      }
    }
  } catch { /* ignore read errors */ }

  res.json({
    session: {
      totalRequests: requestMetrics.total,
      byIntent: requestMetrics.byIntent,
      avgResponseTime: avgTime,
    },
    allTime: logStats,
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Intent Router API running at http://localhost:${PORT}`);
  console.log(`📡 POST /chat       — Send a message for classification and routing`);
  console.log(`📡 POST /api/route  — Same endpoint (alternate path)`);
  console.log(`📊 GET  /api/stats  — Session analytics & intent distribution`);
  console.log(`📋 GET  /api/history — Request log history`);
  console.log(`❤️  GET  /api/health — Health check\n`);
});

module.exports = app;

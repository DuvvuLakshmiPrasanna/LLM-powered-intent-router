const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "..", "route_log.jsonl");

/**
 * Appends a structured log entry to route_log.jsonl.
 * Each entry is a single JSON object on its own line (JSON Lines format).
 */
function logRouteDecision({ intent, confidence, userMessage, finalResponse }) {
  const entry = {
    timestamp: new Date().toISOString(),
    intent,
    confidence,
    user_message: userMessage,
    final_response: finalResponse,
  };

  const line = JSON.stringify(entry) + "\n";
  fs.appendFileSync(LOG_FILE, line, "utf-8");
}

module.exports = { logRouteDecision, LOG_FILE };

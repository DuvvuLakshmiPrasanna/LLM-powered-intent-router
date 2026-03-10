require("dotenv").config();

const { handleMessage } = require("./router");
const { parseClassifierResponse } = require("./classifier");
const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "..", "route_log.jsonl");

const TEST_MESSAGES = [
  // Clear code intent
  { msg: "how do i sort a list of objects in python?", expected: "code" },
  { msg: "explain this sql query for me", expected: "code" },
  { msg: "fxi thsi bug pls: for i in range(10) print(i)", expected: "code" },

  // Clear writing intent
  { msg: "This paragraph sounds awkward, can you help me fix it?", expected: "writing" },
  { msg: "Rewrite this sentence to be more professional.", expected: "writing" },
  { msg: "My boss says my writing is too verbose.", expected: "writing" },

  // Clear career intent
  { msg: "I'm preparing for a job interview, any tips?", expected: "career" },
  { msg: "I'm not sure what to do with my career.", expected: "career" },
  { msg: "How do I structure a cover letter?", expected: "career" },

  // Clear data intent
  { msg: "what's the average of these numbers: 12, 45, 23, 67, 34", expected: "data" },
  { msg: "what is a pivot table", expected: "data" },

  // Unclear / ambiguous
  { msg: "Help me make this better.", expected: "unclear" },
  { msg: "hey", expected: "unclear" },
  { msg: "Can you write me a poem about clouds?", expected: "unclear" },
  {
    msg: "I need to write a function that takes a user id and returns their profile, but also i need help with my resume.",
    expected: "unclear",
  },

  // Manual override test
  { msg: "@code Fix this bug in my JavaScript", expected: "code" },
  { msg: "@career What skills should I learn next?", expected: "career" },
];

// Unit tests for parseClassifierResponse
function testParser() {
  console.log("═══ Parser Unit Tests ═══\n");
  let passed = 0;
  let failed = 0;

  const tests = [
    {
      name: "Valid JSON",
      input: '{"intent": "code", "confidence": 0.95}',
      expected: { intent: "code", confidence: 0.95 },
    },
    {
      name: "JSON wrapped in markdown",
      input: '```json\n{"intent": "data", "confidence": 0.8}\n```',
      expected: { intent: "data", confidence: 0.8 },
    },
    {
      name: "Invalid JSON string",
      input: "I think the intent is code",
      expected: { intent: "unclear", confidence: 0.0 },
    },
    {
      name: "Empty string",
      input: "",
      expected: { intent: "unclear", confidence: 0.0 },
    },
    {
      name: "Invalid intent label",
      input: '{"intent": "cooking", "confidence": 0.9}',
      expected: { intent: "unclear", confidence: 0.9 },
    },
    {
      name: "Confidence out of range",
      input: '{"intent": "code", "confidence": 1.5}',
      expected: { intent: "code", confidence: 0.0 },
    },
    {
      name: "Missing confidence",
      input: '{"intent": "writing"}',
      expected: { intent: "writing", confidence: 0.0 },
    },
    {
      name: "JSON with extra whitespace",
      input: '  { "intent" : "career" , "confidence" : 0.88 }  ',
      expected: { intent: "career", confidence: 0.88 },
    },
  ];

  for (const t of tests) {
    const result = parseClassifierResponse(t.input);
    const pass =
      result.intent === t.expected.intent &&
      Math.abs(result.confidence - t.expected.confidence) < 0.01;
    if (pass) {
      console.log(`  ✅ ${t.name}`);
      passed++;
    } else {
      console.log(
        `  ❌ ${t.name}: expected ${JSON.stringify(t.expected)}, got ${JSON.stringify(result)}`
      );
      failed++;
    }
  }

  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

async function testIntegration() {
  console.log("═══ Integration Tests (Live LLM) ═══\n");

  // Clear log file before test run
  if (fs.existsSync(LOG_FILE)) {
    fs.unlinkSync(LOG_FILE);
  }

  let passed = 0;
  let failed = 0;
  const results = [];

  // Pace requests to stay within free-tier rate limits (15s gap = safe for 10 RPM with 2 calls/test)
  const REQUEST_DELAY_MS = 30000;

  for (let i = 0; i < TEST_MESSAGES.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
    const { msg, expected } = TEST_MESSAGES[i];
    const num = `[${i + 1}/${TEST_MESSAGES.length}]`;

    try {
      const result = await handleMessage(msg);
      const match = result.intent === expected;

      const status = match ? "✅" : "⚠️";
      console.log(
        `  ${status} ${num} Intent: ${result.intent} (expected: ${expected}) | Confidence: ${(result.confidence * 100).toFixed(0)}%`
      );
      console.log(`       Message: "${msg.substring(0, 70)}${msg.length > 70 ? "..." : ""}"`);
      console.log(
        `       Response: "${result.response.substring(0, 80)}${result.response.length > 80 ? "..." : ""}"\n`
      );

      if (match) passed++;
      else failed++;

      results.push({ msg, expected, actual: result.intent, confidence: result.confidence, match });
    } catch (error) {
      console.log(`  ❌ ${num} Error: ${error.message}`);
      console.log(`       Message: "${msg}"\n`);
      failed++;
      results.push({ msg, expected, actual: "ERROR", confidence: 0, match: false });
    }
  }

  // Verify log file
  console.log("═══ Log File Verification ═══\n");
  if (fs.existsSync(LOG_FILE)) {
    const lines = fs.readFileSync(LOG_FILE, "utf-8").trim().split("\n");
    let validLines = 0;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.intent && entry.confidence !== undefined && entry.user_message && entry.final_response) {
          validLines++;
        }
      } catch {
        console.log(`  ❌ Invalid JSON line in log file`);
      }
    }
    console.log(`  ✅ Log file has ${validLines} valid entries out of ${lines.length} lines\n`);
  } else {
    console.log("  ❌ Log file not found\n");
  }

  // Summary
  console.log("═══ Summary ═══\n");
  console.log(`  Total: ${TEST_MESSAGES.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`  Accuracy: ${((passed / TEST_MESSAGES.length) * 100).toFixed(1)}%\n`);

  return failed === 0;
}

async function main() {
  console.log("\n🧪 LLM Intent Router — Test Suite\n");
  console.log("─".repeat(60) + "\n");

  // Run parser unit tests first (no API calls needed)
  const parserOk = testParser();

  // Check if OPENAI_API_KEY is set before running integration tests
  if (!process.env.OPENAI_API_KEY) {
    console.log("⚠️  OPENAI_API_KEY not set. Skipping integration tests.");
    console.log("   Set it in .env to run the full test suite.\n");
    process.exit(parserOk ? 0 : 1);
  }

  // Run integration tests
  const integrationOk = await testIntegration();

  process.exit(parserOk && integrationOk ? 0 : 1);
}

main();

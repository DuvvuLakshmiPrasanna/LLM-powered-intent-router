const { getGroqClient } = require("./groqClient");

// Valid intent labels the classifier can return
const VALID_INTENTS = ["code", "data", "writing", "career", "unclear"];

// The classifier system prompt – instructs the LLM to return structured JSON only
const CLASSIFIER_SYSTEM_PROMPT = `You are a precise intent classification engine. Classify the user message into exactly one of these labels: code, data, writing, career, unclear.

DEFINITIONS (read carefully):
- "code": Programming, debugging, software bugs, code review, algorithms, software architecture, CLI tools, APIs, web dev, mobile dev, version control, anything involving writing or fixing source code.
- "data": Data analysis, statistics, math calculations, datasets, spreadsheets, CSV, SQL queries, pivot tables, averages, charts, business intelligence, data visualization, interpreting numbers or trends.
- "writing": ANY form of written content creation or improvement — this includes: proofreading, grammar fixes, rewriting sentences, improving style, writing essays, emails, blog posts, articles, creative writing, poetry, storytelling, cover letter CONTENT (vs career advice), fiction, scripts, copywriting. If the user wants text produced or improved, it is "writing".
- "career": Career strategy, job search tactics, interview preparation advice (not code interviews), resume strategy, professional networking, salary negotiation, LinkedIn optimization, workplace relationships, switching careers, professional development goals.
- "unclear": Too short to classify (under 5 words with no domain signal), genuinely ambiguous across multiple categories, or a casual greeting/chitchat that fits no domain.

CLASSIFICATION RULES:
1. Respond ONLY with a single JSON object — no markdown, no explanation, no extra text whatsoever.
2. The JSON must have exactly two keys: "intent" (string) and "confidence" (float 0.0–1.0).
3. Strong domain signals → confidence 0.85–0.99.
4. Moderate signals or slight ambiguity → confidence 0.6–0.84.
5. Weak signals, multiple possible intents → confidence 0.4–0.59, pick most likely.
6. No discernible domain → "unclear" with confidence 0.1–0.35.
7. A request to WRITE or CREATE text (poem, story, email, blog post, paragraph) is ALWAYS "writing", never "unclear".
8. A request to FIX code or debug is ALWAYS "code", even if phrased informally or with typos.
9. Override prefixes like @code, @data, @writing, @career must be stripped before classification — classify the underlying message.

FEW-SHOT EXAMPLES (input → output):
"how do I sort a list in Python?" → {"intent":"code","confidence":0.97}
"fix this bug: for i in range(10) print(i)" → {"intent":"code","confidence":0.99}
"write a React component that fetches data" → {"intent":"code","confidence":0.96}
"what is the average of 12, 45, 23?" → {"intent":"data","confidence":0.98}
"explain what a pivot table is" → {"intent":"data","confidence":0.93}
"my sales data shows a spike in Q3, why?" → {"intent":"data","confidence":0.88}
"can you proofread this paragraph?" → {"intent":"writing","confidence":0.97}
"write me a poem about clouds" → {"intent":"writing","confidence":0.97}
"write a short story about space" → {"intent":"writing","confidence":0.96}
"help me write a professional email to my boss" → {"intent":"writing","confidence":0.95}
"my essay introduction sounds weak" → {"intent":"writing","confidence":0.92}
"tips for a job interview" → {"intent":"career","confidence":0.95}
"how do I negotiate my salary?" → {"intent":"career","confidence":0.96}
"should I put my GPA on my resume?" → {"intent":"career","confidence":0.94}
"hey" → {"intent":"unclear","confidence":0.15}
"what do you think?" → {"intent":"unclear","confidence":0.2}
"I need help" → {"intent":"unclear","confidence":0.25}`;


/**
 * Sleeps for the given number of milliseconds.
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Classifies the user's intent by making a lightweight LLM call.
 * Retries automatically on 429 rate-limit errors with exponential backoff.
 *
 * @param {string} message - The user's input message
 * @param {number} [retries=3] - Number of retry attempts
 * @returns {Promise<{intent: string, confidence: number}>}
 */
async function classifyIntent(message, retries = 3) {
  const groq = getGroqClient();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await groq.chat.completions.create({
        model: process.env.CLASSIFIER_MODEL || "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: CLASSIFIER_SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
        temperature: 0,
        max_tokens: 60,
        response_format: { type: "json_object" },
      });

      const raw = (result.choices[0]?.message?.content ?? "").trim();
      if (!raw) return { intent: "unclear", confidence: 0.0 };
      return parseClassifierResponse(raw);
    } catch (error) {
      const is429 = error.status === 429 || (error.message && error.message.includes("429"));
      if (is429 && attempt < retries) {
        const waitMs = attempt * 15000; // 15s, 30s
        console.error(`Classifier rate limited (429). Retrying in ${waitMs / 1000}s... (attempt ${attempt}/${retries})`);
        await sleep(waitMs);
        continue;
      }
      console.error("Classifier LLM call failed:", error.message);
      return { intent: "unclear", confidence: 0.0 };
    }
  }
  return { intent: "unclear", confidence: 0.0 };
}

/**
 * Parses the raw LLM response into structured intent data.
 * Gracefully handles malformed JSON by defaulting to 'unclear'.
 *
 * @param {string} raw - The raw string response from the LLM
 * @returns {{intent: string, confidence: number}}
 */
function parseClassifierResponse(raw) {
  try {
    // Try to extract JSON from the response (handles markdown-wrapped JSON too)
    let jsonStr = raw;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    // Validate the intent field
    const intent = VALID_INTENTS.includes(parsed.intent)
      ? parsed.intent
      : "unclear";

    // Validate the confidence field
    let confidence = parseFloat(parsed.confidence);
    if (isNaN(confidence) || confidence < 0 || confidence > 1) {
      confidence = 0.0;
    }

    return { intent, confidence };
  } catch {
    // If JSON parsing fails completely, default to unclear
    return { intent: "unclear", confidence: 0.0 };
  }
}

module.exports = { classifyIntent, parseClassifierResponse, VALID_INTENTS };

const { getGroqClient } = require("./groqClient");
const { classifyIntent } = require("./classifier");
const { logRouteDecision } = require("./logger");
const prompts = require("./prompts.json");

// Confidence threshold – below this, treat as 'unclear'
const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD || "0.7");

// Manual override prefix pattern: @code, @data, @writing, @career
const OVERRIDE_REGEX = /^@(code|data|writing|career)\s+/i;

/**
 * Detects manual intent override from message prefix (e.g., "@code Fix this bug").
 *
 * @param {string} message - The user's raw message
 * @returns {{ override: string|null, cleanMessage: string }}
 */
function detectOverride(message) {
  const match = message.match(OVERRIDE_REGEX);
  if (match) {
    return {
      override: match[1].toLowerCase(),
      cleanMessage: message.slice(match[0].length).trim(),
    };
  }
  return { override: null, cleanMessage: message };
}

/**
 * Routes the message to the appropriate expert persona and generates a response.
 *
 * @param {string} message - The original user message
 * @param {{intent: string, confidence: number}} intentData - Classified intent data
 * @returns {Promise<string>} - The final generated response
 */
async function routeAndRespond(message, intentData) {
  const groq = getGroqClient();
  let { intent, confidence } = intentData;

  // Apply confidence threshold: if below threshold, treat as unclear
  if (intent !== "unclear" && confidence < CONFIDENCE_THRESHOLD) {
    intent = "unclear";
  }

  // Get the system prompt for the resolved intent
  const persona = prompts[intent] || prompts["unclear"];
  const systemPrompt = persona.systemPrompt;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await groq.chat.completions.create({
        model: process.env.GENERATION_MODEL || "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      });

      return (result.choices[0]?.message?.content ?? "").trim() ||
        "I'm sorry, I encountered an error while generating a response. Please try again.";
    } catch (error) {
      const is429 = error.status === 429 || (error.message && error.message.includes("429"));
      if (is429 && attempt < 3) {
        const waitMs = attempt * 15000;
        console.error(`Generation rate limited (429). Retrying in ${waitMs / 1000}s... (attempt ${attempt}/3)`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      console.error("Generation LLM call failed:", error.message);
      return "I'm sorry, I encountered an error while generating a response. Please try again.";
    }
  }
  return "I'm sorry, I encountered an error while generating a response. Please try again."; 
}

/**
 * Full pipeline: classify intent, route to expert, generate response, and log.
 *
 * @param {string} message - The user's raw input
 * @returns {Promise<{intent: string, confidence: number, response: string, persona: string}>}
 */
async function handleMessage(message) {
  // Step 1: Check for manual override
  const { override, cleanMessage } = detectOverride(message);

  let intentData;
  let actualMessage = message;

  if (override) {
    // Manual override: skip classification
    intentData = { intent: override, confidence: 1.0 };
    actualMessage = cleanMessage;
  } else {
    // Step 2: Classify intent via LLM
    intentData = await classifyIntent(message);
  }

  // Step 3: Route and generate response
  const finalResponse = await routeAndRespond(actualMessage, intentData);

  // Resolve effective intent (after threshold check)
  const effectiveIntent =
    intentData.intent !== "unclear" && intentData.confidence < CONFIDENCE_THRESHOLD
      ? "unclear"
      : intentData.intent;

  const persona = prompts[effectiveIntent] || prompts["unclear"];

  // Step 4: Log the routing decision
  logRouteDecision({
    intent: effectiveIntent,
    confidence: intentData.confidence,
    userMessage: message,
    finalResponse,
  });

  return {
    intent: effectiveIntent,
    confidence: intentData.confidence,
    persona: persona.label,
    emoji: persona.emoji,
    response: finalResponse,
  };
}

module.exports = { routeAndRespond, handleMessage, detectOverride };

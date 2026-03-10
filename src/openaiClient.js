const OpenAI = require("openai");

let openaiClient = null;

/**
 * Returns a singleton OpenAI client instance.
 * Supports OpenAI, Google Gemini, and any OpenAI-compatible provider via BASE_URL.
 */
function getOpenAIClient() {
  if (!openaiClient) {
    const config = {
      apiKey: process.env.OPENAI_API_KEY,
    };

    // Support custom base URL for alternative providers (e.g., Google Gemini)
    if (process.env.OPENAI_BASE_URL) {
      config.baseURL = process.env.OPENAI_BASE_URL;
    }

    openaiClient = new OpenAI(config);
  }
  return openaiClient;
}

module.exports = { getOpenAIClient };

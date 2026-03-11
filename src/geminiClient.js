const { GoogleGenerativeAI } = require("@google/generative-ai");

let genAI = null;

/**
 * Returns a singleton Google Generative AI client instance.
 */
function getGeminiClient() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

/**
 * Returns a Gemini generative model instance for the given model name.
 * @param {string} modelName - e.g. "gemini-2.5-flash"
 */
function getGeminiModel(modelName) {
  return getGeminiClient().getGenerativeModel({ model: modelName });
}

module.exports = { getGeminiClient, getGeminiModel };

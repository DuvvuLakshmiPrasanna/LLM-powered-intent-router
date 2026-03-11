const Groq = require("groq-sdk");

let groqClient = null;

/**
 * Returns a singleton Groq client instance.
 */
function getGroqClient() {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

module.exports = { getGroqClient };

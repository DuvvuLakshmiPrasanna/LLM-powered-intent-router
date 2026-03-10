require("dotenv").config();

const readline = require("readline");
const { handleMessage } = require("./router");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const DIVIDER = "─".repeat(60);

console.log("\n🧭 LLM Intent Router — Interactive CLI");
console.log(DIVIDER);
console.log("Type a message to classify and route to an AI expert.");
console.log("Prefix with @code, @data, @writing, or @career to override.");
console.log('Type "exit" or "quit" to leave.\n');

function prompt() {
  rl.question("You: ", async (input) => {
    const message = input.trim();

    if (!message) {
      prompt();
      return;
    }

    if (message.toLowerCase() === "exit" || message.toLowerCase() === "quit") {
      console.log("\nGoodbye! 👋\n");
      rl.close();
      process.exit(0);
    }

    try {
      console.log("\n⏳ Classifying and routing...\n");
      const result = await handleMessage(message);

      console.log(DIVIDER);
      console.log(
        `${result.emoji} Intent: ${result.intent} | Confidence: ${(result.confidence * 100).toFixed(0)}% | Persona: ${result.persona}`
      );
      console.log(DIVIDER);
      console.log(`\n${result.response}\n`);
      console.log(DIVIDER + "\n");
    } catch (error) {
      console.error(`\n❌ Error: ${error.message}\n`);
    }

    prompt();
  });
}

prompt();

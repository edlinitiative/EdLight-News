/**
 * Test LLM connectivity with current .env configuration.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

import { callLLM } from "@edlight-news/generator";

async function main() {
  console.log("=== LLM Configuration ===");
  console.log("LLM_PROVIDER:", process.env.LLM_PROVIDER || "(not set → defaults to gemini)");
  console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "SET" : "NOT SET");
  console.log("GROQ_API_KEY:", process.env.GROQ_API_KEY ? "SET" : "NOT SET");
  console.log("MISTRAL_API_KEY:", process.env.MISTRAL_API_KEY ? "SET" : "NOT SET");
  console.log("OPENROUTER_API_KEY:", process.env.OPENROUTER_API_KEY ? "SET" : "NOT SET");

  // Try default provider
  console.log("\n=== Test: Default provider ===");
  try {
    const result = await callLLM('Return a JSON object: {"status":"ok"}', { maxOutputTokens: 100 });
    console.log("✅ Default LLM call succeeded:", result.slice(0, 100));
  } catch (err: any) {
    console.log("❌ Default LLM call FAILED:", err.message?.slice(0, 200));
  }

  // Try each free provider
  for (const provider of ["groq", "mistral", "openrouter"] as const) {
    console.log(`\n=== Test: ${provider} ===`);
    try {
      const result = await callLLM('Return a JSON object: {"status":"ok"}', { provider, maxOutputTokens: 100 });
      console.log(`✅ ${provider} succeeded:`, result.slice(0, 100));
    } catch (err: any) {
      console.log(`❌ ${provider} FAILED:`, err.message?.slice(0, 200));
    }
  }

  process.exit(0);
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });

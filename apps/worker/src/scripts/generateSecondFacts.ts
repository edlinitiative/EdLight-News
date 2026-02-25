import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import * as fs from "fs";
import { callGemini } from "@edlight-news/generator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

const seedPath = path.resolve(__dirname, "../data/haiti_history_seed.json");

async function main() {
  const raw = fs.readFileSync(seedPath, "utf-8");
  const existingEntries = JSON.parse(raw);
  
  // Count how many entries exist for each day
  const dayCounts: Record<string, number> = {};
  for (const entry of existingEntries) {
    dayCounts[entry.monthDay] = (dayCounts[entry.monthDay] || 0) + 1;
  }

  const daysNeedingSecondFact: string[] = [];
  const daysInMonth: Record<number, number> = {
    1: 31, 2: 29, 3: 31, 4: 30, 5: 31, 6: 30,
    7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31
  };

  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= daysInMonth[m]; d++) {
      const md = `${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
      if ((dayCounts[md] || 0) < 2) {
        daysNeedingSecondFact.push(md);
      }
    }
  }

  console.log(`Days needing a second fact: ${daysNeedingSecondFact.length}`);

  // We will process in batches of 10
  const batchSize = 10;
  const newEntries = [];

  for (let i = 0; i < daysNeedingSecondFact.length; i += batchSize) {
    const batch = daysNeedingSecondFact.slice(i, i + batchSize);
    console.log(`Processing batch ${i / batchSize + 1} / ${Math.ceil(daysNeedingSecondFact.length / batchSize)}: ${batch.join(", ")}`);

    // Get the existing facts for these days so the LLM doesn't duplicate them
    const existingFactsForBatch = existingEntries.filter((e: any) => batch.includes(e.monthDay));
    const existingContext = existingFactsForBatch.map((e: any) => `- ${e.monthDay}: ${e.title_fr} (${e.year})`).join("\n");

    const prompt = `
You are an expert in Haitian history. I need you to generate a SECOND, DIFFERENT historical fact for the following days of the year:
${batch.join(", ")}

Here are the facts that ALREADY EXIST for these days. DO NOT duplicate these events. Find a DIFFERENT significant event for each day:
${existingContext}

For each day, provide a significant event in Haitian history that happened on that day (or around that time if an exact day is hard to find, but try to be as accurate as possible).
Return the result as a JSON array of objects matching this exact schema:
[
  {
    "monthDay": "MM-DD",
    "year": 1804, // The year the event happened
    "title_fr": "Title of the event in French",
    "summary_fr": "A 2-3 sentence summary of the event in French.",
    "student_takeaway_fr": "A 1-sentence takeaway for a student in French.",
    "tags": ["independence", "culture", "education", "politics", "science", "military", "economy", "literature", "art", "religion", "sports", "disaster", "diplomacy", "resistance", "revolution"], // Choose 1-3 relevant tags from this list
    "sources": [
      { "label": "Wikipedia - Event Name", "url": "https://en.wikipedia.org/wiki/..." }
    ],
    "confidence": "medium",
    "createdBy": "seed"
  }
]

Ensure the output is valid JSON. Do not include markdown formatting like \`\`\`json. Just the raw JSON array.
`;

    try {
      const responseText = await callGemini(prompt);
      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch (e) {
        // Try to strip markdown if it was included
        const cleaned = responseText.replace(/^\`\`\`json\n/, "").replace(/\n\`\`\`$/, "");
        parsed = JSON.parse(cleaned);
      }
      
      if (Array.isArray(parsed)) {
        newEntries.push(...parsed);
        console.log(`Successfully generated ${parsed.length} entries.`);
      } else {
        console.error("Response was not an array:", parsed);
      }
    } catch (err) {
      console.error(`Failed to generate batch ${batch.join(", ")}:`, err);
    }

    // Save progress after each batch
    const combined = [...existingEntries, ...newEntries];
    // Sort by monthDay
    combined.sort((a, b) => a.monthDay.localeCompare(b.monthDay));
    fs.writeFileSync(seedPath, JSON.stringify(combined, null, 2));
    
    // Sleep a bit to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log("Finished generating second entries.");
}

main().catch(console.error);

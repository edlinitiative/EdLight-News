import * as fs from "fs";
import path from "path";

const seedPath = path.resolve(__dirname, "../data/haiti_history_seed.json");
const raw = fs.readFileSync(seedPath, "utf-8");
const entries = JSON.parse(raw);

const validTags = [
  "independence", "culture", "education", "politics", "science", 
  "military", "economy", "literature", "art", "religion", 
  "sports", "disaster", "diplomacy", "resistance", "revolution"
];

for (const entry of entries) {
  if (entry.tags) {
    entry.tags = entry.tags.filter((tag: string) => validTags.includes(tag));
    if (entry.tags.length === 0) {
      entry.tags = ["politics"]; // default fallback
    }
  }
  if (entry.confidence && !["high", "medium"].includes(entry.confidence)) {
    entry.confidence = "medium";
  }
}

fs.writeFileSync(seedPath, JSON.stringify(entries, null, 2));
console.log("Fixed tags and confidence values.");

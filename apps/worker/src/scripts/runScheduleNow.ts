import { scheduleIgPost } from "../jobs/scheduleIgPost.js";

async function main() {
  console.log("Running scheduleIgPost...");
  const result = await scheduleIgPost();
  console.log("Result:", JSON.stringify(result, null, 2));
}
main().catch(console.error);

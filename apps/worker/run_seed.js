import dotenv from "dotenv";
import { execSync } from "child_process";
import fs from "fs";

const envConfig = dotenv.parse(fs.readFileSync("/workspaces/EdLight-News/.env"));
const env = { ...process.env, ...envConfig };

// Fix private key
if (env.FIREBASE_PRIVATE_KEY) {
    env.FIREBASE_PRIVATE_KEY = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n").replace(/^["']|["']$/g, "");
}

execSync("pnpm seed:haiti-history-almanac", {
    cwd: "/workspaces/EdLight-News/apps/worker",
    env: env,
    stdio: "inherit"
});

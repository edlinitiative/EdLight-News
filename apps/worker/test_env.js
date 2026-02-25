import dotenv from "dotenv";
dotenv.config({ path: "/workspaces/EdLight-News/.env" });
let pk = process.env.FIREBASE_PRIVATE_KEY;
console.log("Original:", repr(pk));
pk = pk.replace(/\\n/g, "\n");
pk = pk.replace(/^["']|["']$/g, "");
console.log("Processed:", repr(pk));
function repr(s) { return JSON.stringify(s); }

import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });
import { getStorage } from "firebase-admin/storage";
import { getApp } from "@edlight-news/firebase";

async function main() {
  const bucket = getStorage(getApp()).bucket(process.env.FIREBASE_STORAGE_BUCKET);
  const [files] = await bucket.getFiles({ prefix: "ig_posts/" });
  const folders = new Set(files.map((f) => f.name.split("/").slice(0, 2).join("/")));
  console.log("Total files in ig_posts/:", files.length);
  console.log("Total post folders:", folders.size);
  files.slice(0, 8).forEach((f) => console.log(" ", f.name));
}
main().catch(console.error);

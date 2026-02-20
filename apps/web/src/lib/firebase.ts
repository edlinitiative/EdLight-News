/**
 * Re-export firebase admin for server components.
 * This file ensures firebase-admin is only imported on the server side.
 */
export { getDb, getApp } from "@edlight-news/firebase";

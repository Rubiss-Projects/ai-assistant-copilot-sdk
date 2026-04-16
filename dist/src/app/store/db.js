import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";
const CONFIG_DIR = process.env.AI_ASSISTANT_CONFIG_DIR
    ? resolve(process.env.AI_ASSISTANT_CONFIG_DIR)
    : resolve(homedir(), ".ai-assistant");
const STATE_DIR = resolve(CONFIG_DIR, "state");
const DB_PATH = resolve(STATE_DIR, "ops.db");
let db = null;
export function getDb() {
    if (db)
        return db;
    if (!existsSync(STATE_DIR)) {
        mkdirSync(STATE_DIR, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    db.pragma("foreign_keys = ON");
    return db;
}
export function closeDb() {
    if (db) {
        db.close();
        db = null;
    }
}

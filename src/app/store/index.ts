// Import migration definitions so they register themselves
import "./migrations/v001-initial-tables.js";

export { getDb, closeDb } from "./db.js";
export { runMigrations } from "./migrations.js";

import { getDb } from "./db.js";

interface Migration {
  version: number;
  name: string;
  up: () => void;
}

const migrations: Migration[] = [];

export function defineMigration(version: number, name: string, up: () => void): void {
  migrations.push({ version, name, up });
}

export function runMigrations(): void {
  const db = getDb();

  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    db.prepare("SELECT version FROM migrations").all().map((r: any) => r.version)
  );

  const pending = migrations
    .filter((m) => !applied.has(m.version))
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    console.log(`[migrations] Applying v${String(migration.version).padStart(3, "0")}: ${migration.name}`);
    db.transaction(() => {
      migration.up();
      db.prepare("INSERT INTO migrations (version, name) VALUES (?, ?)").run(
        migration.version,
        migration.name
      );
    })();
  }

  if (pending.length > 0) {
    console.log(`[migrations] Applied ${pending.length} migration(s).`);
  }
}

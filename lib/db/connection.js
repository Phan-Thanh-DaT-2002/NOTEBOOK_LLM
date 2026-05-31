import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { runMigrations } from './migrate.js';

const DB_DIR = path.join(process.cwd(), 'data');

// Ensure parent directories exist
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'database.sqlite');

let db;

if (process.env.NODE_ENV === 'production') {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
} else {
  // Prevent multiple connections during hot reloading in Next.js dev mode
  if (!global._sqliteDb) {
    global._sqliteDb = new Database(DB_PATH);
    global._sqliteDb.pragma('journal_mode = WAL');
    global._sqliteDb.pragma('foreign_keys = ON');
    runMigrations(global._sqliteDb);
  }
  db = global._sqliteDb;
}

export function getDb() {
  return db;
}

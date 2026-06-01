import fs from 'fs';
import path from 'path';

export function runMigrations(db) {
  // Create migrations log table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      run_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = path.join(process.cwd(), 'lib', 'db', 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.error(`Migrations directory not found at: ${migrationsDir}`);
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const isRun = db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(file);
    
    if (!isRun) {
      console.log(`[DB] Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      try {
        const runMigration = db.transaction(() => {
          const alreadyRun = db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(file);
          if (alreadyRun) return;

          db.exec(sql);
          db.prepare('INSERT OR IGNORE INTO _migrations (name) VALUES (?)').run(file);
        });
        runMigration();
        console.log(`[DB] Migrated successfully: ${file}`);
      } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          console.log(`[DB] Migration ${file} was already run by another worker.`);
        } else {
          console.error(`[DB] Migration failed on ${file}:`, err);
          throw err;
        }
      }
    }
  }
}

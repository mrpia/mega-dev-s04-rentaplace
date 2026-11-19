import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DB_PATH, ROOT } from './config.ts';
import type { Listing } from './types.ts';
export function openDatabase(path = DB_PATH): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  for (const name of readdirSync(join(ROOT, 'db/migrations')).filter(n => n.endsWith('.sql')).sort()) {
    if (db.prepare('SELECT name FROM schema_migrations WHERE name = ?').get(name)) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(readFileSync(join(ROOT, 'db/migrations', name), 'utf8'));
      db.prepare('INSERT INTO schema_migrations VALUES (?, ?)').run(name, '2026-06-01T00:00:00.000Z');
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); db.close(); throw e; }
  }
  return db;
}
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}
export function decodeListing(row: any): Listing {
  return { ...row, amenities: JSON.parse(row.amenities), photos: JSON.parse(row.photos), holiday_dates: JSON.parse(row.holiday_dates ?? '[]') };
}
export function listingBySlug(db: DatabaseSync, slug: string): Listing | undefined {
  const row = db.prepare('SELECT * FROM listings WHERE slug = ?').get(slug);
  return row ? decodeListing(row) : undefined;
}

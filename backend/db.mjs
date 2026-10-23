import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function openDatabase(databasePath = process.env.DATABASE_PATH || path.join(import.meta.dirname, 'data', 'thenurab.sqlite')) {
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      discount_price REAL NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '[]',
      size TEXT NOT NULL DEFAULT '[]',
      category TEXT NOT NULL DEFAULT '',
      in_stock INTEGER NOT NULL DEFAULT 1,
      images TEXT NOT NULL DEFAULT '[]',
      created TEXT NOT NULL,
      updated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS banner (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created TEXT NOT NULL,
      updated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      telegram_username TEXT NOT NULL DEFAULT '',
      telegram_id TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL DEFAULT '',
      block INTEGER NOT NULL DEFAULT 0,
      address TEXT NOT NULL DEFAULT '',
      created TEXT NOT NULL,
      updated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user TEXT NOT NULL DEFAULT '',
      total_price REAL NOT NULL DEFAULT 0,
      items TEXT NOT NULL DEFAULT '[]',
      phone TEXT NOT NULL DEFAULT '',
      telegram_username TEXT NOT NULL DEFAULT '',
      delivery_address TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new',
      notification_status TEXT NOT NULL DEFAULT 'pending',
      created TEXT NOT NULL,
      updated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      password_scheme TEXT NOT NULL,
      created TEXT NOT NULL,
      updated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS legacy_imports (
      source TEXT PRIMARY KEY,
      imported_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created DESC);
    CREATE INDEX IF NOT EXISTS idx_users_created ON user(created DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
  `);
  const orderColumns = new Set(db.prepare('PRAGMA table_info(orders)').all().map((column) => column.name));
  if (!orderColumns.has('notification_status')) {
    db.exec("ALTER TABLE orders ADD COLUMN notification_status TEXT NOT NULL DEFAULT 'pending'");
  }
  return db;
}

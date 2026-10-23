import { randomBytes, scryptSync } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../db.mjs';

const backendDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  process.loadEnvFile(path.join(backendDir, '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const email = process.argv[2]?.trim();
const password = process.env.ADMIN_PASSWORD;
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('Usage: npm run create-admin -- admin@example.com (set ADMIN_PASSWORD in backend/.env first).');
}
if (!password || password.length < 12) {
  throw new Error('Set ADMIN_PASSWORD to a password with at least 12 characters in backend/.env.');
}

const db = openDatabase();
const salt = randomBytes(16).toString('hex');
const hash = scryptSync(password, salt, 64).toString('hex');
const timestamp = new Date().toISOString();
db.prepare(`
  INSERT INTO admins (id,email,password_hash,password_scheme,created,updated)
  VALUES (?, ?, ?, 'scrypt', ?, ?)
`).run(randomBytes(10).toString('hex').slice(0, 15), email, `${salt}:${hash}`, timestamp, timestamp);
db.close();
console.log('Admin account created.');

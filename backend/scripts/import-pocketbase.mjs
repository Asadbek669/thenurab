import { copyFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../db.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(root, '..');
const sourcePath = path.resolve(process.env.POCKETBASE_DB || path.join(backendDir, 'pb_data', 'data.db'));
const storagePath = path.resolve(process.env.POCKETBASE_STORAGE || path.join(backendDir, 'pb_data', 'storage'));
const databasePath = path.resolve(process.env.DATABASE_PATH || path.join(backendDir, 'data', 'thenurab.sqlite'));
const uploadsPath = path.resolve(process.env.UPLOADS_DIR || path.join(backendDir, 'uploads'));

if (!existsSync(sourcePath)) throw new Error(`Legacy PocketBase database not found: ${sourcePath}`);
const source = new DatabaseSync(sourcePath, { readOnly: true });
const destination = openDatabase(databasePath);
const sourceKey = `${sourcePath}:${storagePath}`;
if (destination.prepare('SELECT 1 FROM legacy_imports WHERE source = ?').get(sourceKey)) {
  console.log('PocketBase data was already imported; no changes made.');
  source.close();
  destination.close();
  process.exit(0);
}

for (const table of ['products', 'banner', 'user', 'orders', 'admins']) {
  if (destination.prepare(`SELECT count(*) AS count FROM "${table}"`).get().count !== 0) {
    throw new Error(`Destination table "${table}" is not empty; refusing to mix legacy and new data.`);
  }
}

const collectionIds = Object.fromEntries(
  source.prepare('SELECT name, id FROM _collections WHERE name IN (?, ?)').all('products', 'banner').map((row) => [row.name, row.id]),
);
const copiedFiles = [];
function copyLegacyImage(collection, recordId, filename) {
  if (!filename) return;
  if (typeof filename !== 'string' || path.basename(filename) !== filename || filename.includes('..')) {
    throw new Error(`Unsafe legacy image name in ${collection}/${recordId}.`);
  }
  const sourceFile = path.join(storagePath, collectionIds[collection], recordId, filename);
  if (!existsSync(sourceFile)) throw new Error(`Legacy image is missing: ${collection}/${recordId}/${filename}`);
  const targetDir = path.join(uploadsPath, collection, recordId);
  const targetFile = path.join(targetDir, filename);
  if (existsSync(targetFile)) throw new Error(`Destination image already exists: ${collection}/${recordId}/${filename}`);
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(sourceFile, targetFile);
  copiedFiles.push(targetFile);
}

const products = source.prepare('SELECT * FROM products ORDER BY created').all();
const banners = source.prepare('SELECT * FROM banner ORDER BY created').all();
const users = source.prepare('SELECT * FROM user ORDER BY created').all();
const orders = source.prepare('SELECT * FROM orders ORDER BY created').all();
const superusers = source.prepare('SELECT * FROM _superusers ORDER BY created').all();

try {
  for (const product of products) {
    const images = JSON.parse(product.images || '[]');
    for (const filename of images) copyLegacyImage('products', product.id, filename);
  }
  for (const banner of banners) copyLegacyImage('banner', banner.id, banner.image);

  destination.exec('BEGIN IMMEDIATE');
  const insertProduct = destination.prepare(`
    INSERT INTO products (id,title,price,discount_price,description,color,size,category,in_stock,images,created,updated)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  for (const row of products) {
    insertProduct.run(row.id, row.title, row.price, row.discount_price, row.description, row.color || '[]', row.size || '[]',
      row.category, row.in_stock ? 1 : 0, row.images || '[]', row.created, row.updated);
  }
  const insertBanner = destination.prepare(`
    INSERT INTO banner (id,title,image,url,is_active,created,updated) VALUES (?,?,?,?,?,?,?)
  `);
  for (const row of banners) {
    insertBanner.run(row.id, row.title, row.image, row.url, row.is_active ? 1 : 0, row.created, row.updated);
  }
  const insertUser = destination.prepare(`
    INSERT INTO user (id,name,telegram_username,telegram_id,phone,block,address,created,updated)
    VALUES (?,?,?,?,?,?,?,?,?)
  `);
  for (const row of users) {
    insertUser.run(row.id, row.name, row.telegram_username, row.telegram_id, row.phone, row.block ? 1 : 0, row.address || '', row.created, row.updated);
  }
  const insertOrder = destination.prepare(`
    INSERT INTO orders (id,user,total_price,items,phone,telegram_username,delivery_address,status,created,updated)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `);
  for (const row of orders) {
    insertOrder.run(row.id, row.user, row.total_price, row.items || '[]', row.phone, row.telegram_username,
      row.delivery_address, row.status, row.created, row.updated);
  }
  const insertAdmin = destination.prepare(`
    INSERT INTO admins (id,email,password_hash,password_scheme,created,updated) VALUES (?,?,?,?,?,?)
  `);
  for (const row of superusers) {
    if (!/^\$2[aby]\$/.test(row.password || '')) {
      throw new Error(`Unsupported password hash for legacy administrator ${row.email}; refusing to import an unusable login.`);
    }
    insertAdmin.run(row.id, row.email, row.password, 'bcrypt', row.created, row.updated);
  }
  destination.prepare('INSERT INTO legacy_imports (source, imported_at) VALUES (?, ?)').run(sourceKey, new Date().toISOString());
  destination.exec('COMMIT');
} catch (error) {
  try {
    destination.exec('ROLLBACK');
  } catch {
    // The transaction may not have started.
  }
  for (const file of copiedFiles) {
    try {
      unlinkSync(file);
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') throw cleanupError;
    }
  }
  throw error;
} finally {
  source.close();
  destination.close();
}

console.log(`Imported ${products.length} products, ${banners.length} banners, ${users.length} users, ${orders.length} orders, ${superusers.length} admins.`);
console.log(`Copied ${copiedFiles.length} image files into ${uploadsPath}.`);

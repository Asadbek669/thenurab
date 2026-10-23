import { createHash, createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { openDatabase } from './db.mjs';
import { createTelegramClient } from './telegram-bot.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(here, '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const uploadsDir = path.resolve(process.env.UPLOADS_DIR || path.join(here, 'uploads'));
const allowedOrigins = new Set((process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((origin) => origin.trim()).filter(Boolean));
const sessionDuration = 12 * 60 * 60 * 1000;
const id = () => randomBytes(10).toString('hex').slice(0, 15);
const now = () => new Date().toISOString();
const toJson = (value, fallback = []) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    throw new Error(`Maʼlumotlar bazasidagi JSON maydonini o‘qib bo‘lmadi: ${error.message}`);
  }
};
const bool = (value) => value === true || value === 1 || value === 'true' || value === '1';
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const safeFileName = (name) => typeof name === 'string' && /^[\w.-]+$/.test(name) && name !== '.' && name !== '..';

function publicRecord(table, row) {
  if (!row) return null;
  const result = { ...row, _collection: table };
  for (const field of ['color', 'size', 'images', 'items']) {
    if (typeof result[field] === 'string' && ['color', 'size', 'images', 'items'].includes(field)) {
      result[field] = toJson(result[field], field === 'images' || field === 'items' ? [] : []);
    }
  }
  for (const field of ['in_stock', 'is_active', 'block']) {
    if (field in result) result[field] = Boolean(result[field]);
  }
  return result;
}

function parseInput(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      throw Object.assign(new Error('JSON ko‘rinishidagi maydon noto‘g‘ri formatda.'), { status: 400 });
    }
  }
  return value;
}

function parseTelegramInitData(initData, token) {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  const userText = params.get('user');
  const currentTime = Math.floor(Date.now() / 1000);
  if (!receivedHash || !userText || !Number.isFinite(authDate) || authDate > currentTime + 60 || currentTime - authDate > 86400) {
    throw Object.assign(new Error('Telegram kirish maʼlumotlari yaroqsiz yoki eskirgan.'), { status: 401 });
  }

  const checkString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(token).digest();
  const expectedHash = createHmac('sha256', secretKey).update(checkString).digest();
  let supplied;
  try {
    supplied = Buffer.from(receivedHash, 'hex');
  } catch {
    supplied = Buffer.alloc(0);
  }
  if (supplied.length !== expectedHash.length || !timingSafeEqual(supplied, expectedHash)) {
    throw Object.assign(new Error('Telegram identifikatsiyasini tasdiqlab bo‘lmadi.'), { status: 401 });
  }

  let user;
  try {
    user = JSON.parse(userText);
  } catch {
    throw Object.assign(new Error('Telegram foydalanuvchi maʼlumotlari noto‘g‘ri.'), { status: 400 });
  }
  if (!user?.id || typeof user.first_name !== 'string' || !user.first_name.trim()) {
    throw Object.assign(new Error('Telegram foydalanuvchi ID yoki ismi topilmadi.'), { status: 400 });
  }
  return user;
}

function bearerToken(req) {
  const match = /^Bearer ([A-Za-z0-9_-]+)$/.exec(req.get('Authorization') || '');
  return match?.[1] || '';
}

function adminFromRequest(req, db) {
  const token = bearerToken(req);
  if (!token) return null;
  const session = db.prepare(`
    SELECT admins.id, admins.email, sessions.expires_at
    FROM sessions JOIN admins ON admins.id = sessions.admin_id
    WHERE sessions.token_hash = ?
  `).get(hashToken(token));
  if (!session || session.expires_at <= Date.now()) {
    if (session) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
    return null;
  }
  return session;
}

function requireAdmin(req, res, next) {
  const admin = adminFromRequest(req, req.app.locals.db);
  if (!admin) return res.status(401).json({ message: 'Admin tizimiga qayta kiring.' });
  req.admin = admin;
  return next();
}

function passwordMatches(admin, password) {
  if (admin.password_scheme === 'bcrypt') return bcrypt.compareSync(password, admin.password_hash);
  if (admin.password_scheme === 'scrypt') {
    const [salt, expectedHex] = admin.password_hash.split(':');
    if (!salt || !expectedHex) return false;
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  return false;
}

async function saveImage(file, collection, recordId, uploads) {
  if (!file || file.mimetype !== 'image/webp') {
    throw Object.assign(new Error('Rasm WEBP formatida bo‘lishi kerak.'), { status: 400 });
  }
  const filename = `${randomUUID().replaceAll('-', '')}.webp`;
  const directory = path.join(uploads, collection, recordId);
  await mkdir(directory, { recursive: true });
  await sharp(file.buffer, { limitInputPixels: 20_000_000 }).webp({ quality: 88 }).toFile(path.join(directory, filename));
  return filename;
}

async function removeUnusedImages(collection, recordId, before, after, uploads) {
  const keep = new Set(after);
  for (const filename of before) {
    if (keep.has(filename) || !safeFileName(filename)) continue;
    const fullPath = path.join(uploads, collection, recordId, filename);
    try {
      await unlink(fullPath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

const multipartUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 10, fileSize: 10 * 1024 * 1024 },
}).fields([{ name: 'images', maxCount: 10 }, { name: 'image', maxCount: 1 }]);

function parseBody(req) {
  const body = { ...req.body };
  for (const [key, value] of Object.entries(body)) body[key] = parseInput(value);
  return body;
}

function validateProduct(body) {
  const title = String(body.title || '').trim();
  const price = Number(body.price);
  const discount = Number(body.discount_price || 0);
  if (!title) throw Object.assign(new Error('Mahsulot nomi kiritilishi kerak.'), { status: 400 });
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(discount) || discount < 0) {
    throw Object.assign(new Error('Mahsulot narxini tekshiring.'), { status: 400 });
  }
  const images = Array.isArray(body.images) ? body.images : [];
  if (images.length > 10) throw Object.assign(new Error('Mahsulot uchun ko‘pi bilan 10 ta rasm yuklang.'), { status: 400 });
  return {
    title,
    price,
    discount_price: discount,
    description: String(body.description || ''),
    color: JSON.stringify(Array.isArray(body.color) ? body.color : body.color ? [body.color] : []),
    size: JSON.stringify(Array.isArray(body.size) ? body.size : body.size ? [body.size] : []),
    category: String(body.category || ''),
    in_stock: bool(body.in_stock) ? 1 : 0,
    images: JSON.stringify(images),
  };
}

function validateBanner(body) {
  const title = String(body.title || '').trim();
  if (!title) throw Object.assign(new Error('Banner nomi kiritilishi kerak.'), { status: 400 });
  return {
    title,
    image: String(body.image || ''),
    url: String(body.url || ''),
    is_active: bool(body.is_active) ? 1 : 0,
  };
}

export function createApp({
  db = openDatabase(),
  uploads = uploadsDir,
  origins = allowedOrigins,
  telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '',
  telegramGroupId = process.env.TELEGRAM_GROUP_ID || '',
  telegramClient = createTelegramClient(telegramBotToken, telegramGroupId),
} = {}) {
  const app = express();
  app.locals.db = db;
  app.locals.telegramClient = telegramClient;
  const loginAttempts = new Map();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const origin = req.get('Origin');
    if (origin && !origins.has(origin)) return res.status(403).json({ message: 'Bu manbadan API so‘rovlariga ruxsat yo‘q.' });
    if (origin) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Allow-Credentials', 'true');
      res.set('Vary', 'Origin');
    }
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/files/:collection/:recordId/:filename', async (req, res, next) => {
    try {
      const { collection, recordId, filename } = req.params;
      if (!['products', 'banner'].includes(collection) || !/^[\w-]{1,80}$/.test(recordId) || !safeFileName(filename)) {
        return res.status(404).json({ message: 'Rasm topilmadi.' });
      }
      const directory = path.resolve(uploads, collection, recordId);
      const filePath = path.resolve(directory, filename);
      if (!filePath.startsWith(`${directory}${path.sep}`)) return res.status(404).json({ message: 'Rasm topilmadi.' });
      res.set('Cache-Control', 'public, max-age=86400');
      return res.sendFile(filePath, (error) => {
        if (error && !res.headersSent) next(error);
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/admin/login', (req, res) => {
    const address = req.ip;
    const attempt = loginAttempts.get(address) || { count: 0, resetAt: Date.now() + 15 * 60 * 1000 };
    if (attempt.resetAt <= Date.now()) {
      attempt.count = 0;
      attempt.resetAt = Date.now() + 15 * 60 * 1000;
    }
    if (attempt.count >= 10) return res.status(429).json({ message: 'Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.' });
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');
    const admin = db.prepare('SELECT * FROM admins WHERE email = ? COLLATE NOCASE').get(email);
    if (!admin || !passwordMatches(admin, password)) {
      attempt.count += 1;
      loginAttempts.set(address, attempt);
      return res.status(401).json({ message: 'Email yoki parol noto‘g‘ri.' });
    }

    loginAttempts.delete(address);
    const token = randomBytes(32).toString('base64url');
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    db.prepare('INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)').run(hashToken(token), admin.id, Date.now() + sessionDuration);
    return res.json({ admin: { email: admin.email }, accessToken: token });
  });
  app.get('/api/admin/session', requireAdmin, (req, res) => res.json({ admin: { email: req.admin.email } }));
  app.post('/api/admin/logout', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(bearerToken(req)));
    return res.sendStatus(204);
  });

  app.post('/api/telegram/profile', (req, res, next) => {
    try {
      if (!telegramBotToken) return res.status(503).json({ message: 'Telegram bot token serverda sozlanmagan.' });
      const telegramUser = parseTelegramInitData(String(req.body?.initData || ''), telegramBotToken);
      const telegramId = String(telegramUser.id);
      const existing = db.prepare('SELECT * FROM user WHERE telegram_id = ?').get(telegramId);
      if (existing?.block) return res.status(403).json({ message: 'Foydalanuvchi bloklangan.' });
      const fullName = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ').trim();
      const profile = {
        id: existing?.id || id(),
        name: fullName,
        telegram_id: telegramId,
        telegram_username: String(telegramUser.username || ''),
        address: typeof req.body.address === 'string' ? req.body.address.trim() : existing?.address || '',
        phone: typeof req.body.phone === 'string' ? req.body.phone.trim() : existing?.phone || '',
      };
      const timestamp = now();
      db.prepare(`
        INSERT INTO user (id, name, telegram_username, telegram_id, address, phone, block, created, updated)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
        ON CONFLICT(telegram_id) DO UPDATE SET
          name=excluded.name, telegram_username=excluded.telegram_username,
          address=excluded.address, phone=excluded.phone, updated=excluded.updated
      `).run(profile.id, profile.name, profile.telegram_username, profile.telegram_id, profile.address, profile.phone, existing?.created || timestamp, timestamp);
      return res.json({ profile });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/orders', async (req, res, next) => {
    let order;
    let profile;
    let items;
    try {
      if (!telegramBotToken || !telegramClient || !telegramGroupId) {
        return res.status(503).json({ message: 'Telegram bot va buyurtmalar guruhi serverda sozlanmagan.' });
      }
      const telegramUser = parseTelegramInitData(String(req.body?.initData || ''), telegramBotToken);
      const telegramId = String(telegramUser.id);
      const existing = db.prepare('SELECT * FROM user WHERE telegram_id = ?').get(telegramId);
      if (existing?.block) return res.status(403).json({ message: 'Foydalanuvchi bloklangan.' });

      const phone = String(req.body?.phone || '').trim();
      const address = String(req.body?.address || '').trim();
      if (!/^[+\d][\d\s().-]{6,24}$/.test(phone)) {
        return res.status(400).json({ message: 'Telefon raqamini to‘g‘ri kiriting.' });
      }
      if (address.length < 5 || address.length > 500) {
        return res.status(400).json({ message: 'Yetkazib berish manzilini to‘liq kiriting.' });
      }
      if (!Array.isArray(req.body?.items) || req.body.items.length < 1 || req.body.items.length > 50) {
        return res.status(400).json({ message: 'Savatchadagi mahsulotlar yaroqsiz.' });
      }

      let totalPrice = 0;
      items = req.body.items.map((requested) => {
        if (!requested || typeof requested.productId !== 'string' || !Number.isInteger(requested.quantity) || requested.quantity < 1 || requested.quantity > 99) {
          throw Object.assign(new Error('Mahsulot soni yoki ID yaroqsiz.'), { status: 400 });
        }
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(requested.productId);
        if (!product || !product.in_stock) {
          throw Object.assign(new Error(`Mahsulot mavjud emas: ${product?.title || 'tanlangan mahsulot'}.`), { status: 400 });
        }
        const sizes = toJson(product.size);
        const colors = toJson(product.color);
        const size = String(requested.size || '');
        const color = String(requested.color || '');
        if ((sizes.length && !sizes.includes(size)) || (colors.length && !colors.includes(color))) {
          throw Object.assign(new Error(`${product.title}: tanlangan o‘lcham yoki rang mavjud emas.`), { status: 400 });
        }
        const unitPrice = product.discount_price > 0 && product.discount_price < product.price
          ? product.discount_price
          : product.price;
        const lineTotal = unitPrice * requested.quantity;
        totalPrice += lineTotal;
        return {
          product_id: product.id,
          title: product.title,
          quantity: requested.quantity,
          unit_price: unitPrice,
          line_total: lineTotal,
          size,
          color,
        };
      });

      const timestamp = now();
      const fullName = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ').trim();
      profile = {
        id: existing?.id || id(),
        name: fullName,
        telegram_id: telegramId,
        telegram_username: String(telegramUser.username || ''),
        address,
        phone,
        created: existing?.created || timestamp,
        updated: timestamp,
      };
      order = {
        id: id(),
        user: profile.id,
        total_price: totalPrice,
        items: JSON.stringify(items),
        phone,
        telegram_username: profile.telegram_username,
        delivery_address: address,
        status: 'new',
        notification_status: 'pending',
        created: timestamp,
        updated: timestamp,
      };

      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(`
          INSERT INTO user (id,name,telegram_username,telegram_id,phone,block,address,created,updated)
          VALUES (?,?,?,?,?,0,?,?,?)
          ON CONFLICT(telegram_id) DO UPDATE SET
            name=excluded.name, telegram_username=excluded.telegram_username,
            phone=excluded.phone, address=excluded.address, updated=excluded.updated
        `).run(profile.id, profile.name, profile.telegram_username, profile.telegram_id, phone, address, profile.created, profile.updated);
        db.prepare(`
          INSERT INTO orders (id,user,total_price,items,phone,telegram_username,delivery_address,status,notification_status,created,updated)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)
        `).run(order.id, order.user, order.total_price, order.items, order.phone, order.telegram_username,
          order.delivery_address, order.status, order.notification_status, order.created, order.updated);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    } catch (error) {
      return next(error);
    }

    try {
      const message = await telegramClient.sendOrder(order, profile, items);
      db.prepare('UPDATE orders SET notification_status = ?, updated = ? WHERE id = ?')
        .run('sent', now(), order.id);
      return res.status(201).json({
        order: { id: order.id, total_price: order.total_price, status: order.status, notification_status: 'sent' },
        message_id: message.message_id,
      });
    } catch (error) {
      console.error('Buyurtma bazaga yozildi, Telegram guruhiga yuborish amalga oshmadi:', error.message);
      db.prepare('UPDATE orders SET notification_status = ?, updated = ? WHERE id = ?')
        .run('failed', now(), order.id);
      return res.status(201).json({
        order: { id: order.id, total_price: order.total_price, status: order.status, notification_status: 'failed' },
        warning: 'Buyurtma saqlandi, ammo Telegram guruhiga yuborilmadi. Admin bilan bog‘laning.',
      });
    }
  });

  app.get('/api/collections/:collection/records', (req, res, next) => {
    try {
      const { collection } = req.params;
      if (collection === 'products' || collection === 'banner') {
        const order = req.query.sort === '-created' ? 'DESC' : 'ASC';
        const activeOnly = collection === 'banner' && req.query.filter === 'is_active = true';
        const rows = db.prepare(`SELECT * FROM "${collection}" ${activeOnly ? 'WHERE is_active = 1' : ''} ORDER BY created ${order}`).all();
        return res.json(rows.map((row) => publicRecord(collection, row)));
      }
      if (!['orders', 'user'].includes(collection)) return res.status(404).json({ message: 'Kolleksiya topilmadi.' });
      if (!adminFromRequest(req, db)) return res.status(401).json({ message: 'Admin tizimiga kiring.' });
      const rows = db.prepare(`SELECT * FROM "${collection}" ORDER BY created DESC`).all();
      return res.json(rows.map((row) => publicRecord(collection, row)));
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/collections/:collection/records/:recordId', (req, res) => {
    const { collection, recordId } = req.params;
    if (!['products', 'banner'].includes(collection)) return res.status(404).json({ message: 'Kolleksiya topilmadi.' });
    const row = db.prepare(`SELECT * FROM "${collection}" WHERE id = ?`).get(recordId);
    return row ? res.json(publicRecord(collection, row)) : res.status(404).json({ message: 'Yozuv topilmadi.' });
  });

  app.post('/api/collections/:collection/records', requireAdmin, multipartUpload, async (req, res, next) => {
    try {
      const collection = req.params.collection;
      if (!['products', 'banner'].includes(collection)) return res.status(404).json({ message: 'Kolleksiya topilmadi.' });
      const recordId = id();
      const body = parseBody(req);
      const incomingFiles = req.files || {};
      const savedFiles = [];
      try {
        const uploadsToSave = collection === 'products' ? incomingFiles.images || [] : incomingFiles.image || [];
        for (const file of uploadsToSave) savedFiles.push(await saveImage(file, collection, recordId, uploads));
        const values = collection === 'products'
          ? validateProduct({ ...body, images: [...(Array.isArray(body.keepImages) ? body.keepImages : []), ...savedFiles] })
          : validateBanner({ ...body, image: savedFiles[0] || '' });
        if (collection === 'banner' && !values.image) throw Object.assign(new Error('Banner rasmi yuklanishi kerak.'), { status: 400 });
        values.created = now();
        values.updated = values.created;
        const columns = ['id', ...Object.keys(values)];
        const placeholders = columns.map(() => '?').join(', ');
        db.prepare(`INSERT INTO "${collection}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${placeholders})`)
          .run(recordId, ...Object.values(values));
        const created = db.prepare(`SELECT * FROM "${collection}" WHERE id = ?`).get(recordId);
        return res.status(201).json(publicRecord(collection, created));
      } catch (error) {
        await removeUnusedImages(collection, recordId, savedFiles, [], uploads);
        throw error;
      }
    } catch (error) {
      return next(error);
    }
  });

  app.put('/api/collections/:collection/records/:recordId', requireAdmin, multipartUpload, async (req, res, next) => {
    try {
      const collection = req.params.collection;
      const { recordId } = req.params;
      if (!['products', 'banner'].includes(collection)) return res.status(404).json({ message: 'Kolleksiya topilmadi.' });
      const current = db.prepare(`SELECT * FROM "${collection}" WHERE id = ?`).get(recordId);
      if (!current) return res.status(404).json({ message: 'Yozuv topilmadi.' });
      const old = publicRecord(collection, current);
      const body = parseBody(req);
      const incomingFiles = req.files || {};
      const uploaded = [];
      let updatedInDatabase = false;
      try {
        const imageFiles = collection === 'products' ? incomingFiles.images || [] : incomingFiles.image || [];
        for (const file of imageFiles) {
          file.filename = await saveImage(file, collection, recordId, uploads);
          uploaded.push(file.filename);
        }
        let values;
        if (collection === 'products') {
          const keepImages = Object.hasOwn(body, 'keepImages') ? toJson(body.keepImages) : old.images;
          values = validateProduct({ ...old, ...body, images: [...keepImages, ...uploaded] });
        } else {
          values = validateBanner({ ...old, ...body, image: uploaded[0] || (Object.hasOwn(body, 'image') ? body.image : old.image) });
        }
        values.updated = now();
        const assignments = Object.keys(values).map((field) => `"${field}" = ?`).join(', ');
        db.prepare(`UPDATE "${collection}" SET ${assignments} WHERE id = ?`).run(...Object.values(values), recordId);
        updatedInDatabase = true;
        const updated = publicRecord(collection, db.prepare(`SELECT * FROM "${collection}" WHERE id = ?`).get(recordId));
        const before = collection === 'products' ? old.images : [old.image].filter(Boolean);
        const after = collection === 'products' ? updated.images : [updated.image].filter(Boolean);
        await removeUnusedImages(collection, recordId, before, after, uploads);
        return res.json(updated);
      } catch (error) {
        if (!updatedInDatabase) await removeUnusedImages(collection, recordId, uploaded, [], uploads);
        throw error;
      }
    } catch (error) {
      return next(error);
    }
  });

  app.delete('/api/collections/:collection/records/:recordId', requireAdmin, async (req, res, next) => {
    try {
      const collection = req.params.collection;
      const { recordId } = req.params;
      if (!['products', 'banner'].includes(collection)) return res.status(404).json({ message: 'Kolleksiya topilmadi.' });
      const row = db.prepare(`SELECT * FROM "${collection}" WHERE id = ?`).get(recordId);
      if (!row) return res.status(404).json({ message: 'Yozuv topilmadi.' });
      db.prepare(`DELETE FROM "${collection}" WHERE id = ?`).run(recordId);
      const images = collection === 'products' ? toJson(row.images) : [row.image].filter(Boolean);
      await removeUnusedImages(collection, recordId, images, [], uploads);
      return res.sendStatus(204);
    } catch (error) {
      return next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    if (res.headersSent) return;
    const status = Number.isInteger(error.status) ? error.status : error instanceof multer.MulterError ? 400 : 500;
    if (status >= 500) console.error('API so‘rovida xatolik:', error);
    const message = status >= 500 ? 'Serverda kutilmagan xatolik yuz berdi.' : error.message;
    return res.status(status).json({ message });
  });

  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await mkdir(uploadsDir, { recursive: true });
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  const app = createApp();
  const server = app.listen(port, host, () => {
    console.log(`THENURAB API listening on http://${host}:${port}`);
  });
  const telegramClient = app.locals.telegramClient;
  const abortController = new AbortController();
  if (telegramClient) {
    telegramClient.verifyConfiguration()
      .then((bot) => console.log(`Telegram bot configured: @${bot.username}`))
      .catch((error) => console.error(`Telegram bot sozlamasini tekshirib bo‘lmadi: ${error.message}`));
    telegramClient.startPolling({
      signal: abortController.signal,
      onError: (message) => console.log(message),
    }).catch((error) => console.error(`Telegram bot polling to‘xtadi: ${error.message}`));
  } else {
    console.warn('Telegram bot token sozlanmagan; /start va guruh bildirishnomalari ishlamaydi.');
  }

  const shutdown = () => {
    abortController.abort();
    server.close(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

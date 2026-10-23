import assert from 'node:assert/strict';
import { createHmac, scryptSync } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import sharp from 'sharp';
import { openDatabase } from '../db.mjs';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'thenurab-api-test-'));
process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
process.env.UPLOADS_DIR = path.join(tempDir, 'uploads');
const { createApp } = await import('../server.mjs');
const db = openDatabase(process.env.DATABASE_PATH);
const app = createApp({
  db,
  uploads: process.env.UPLOADS_DIR,
  origins: new Set(['http://localhost:5173']),
  telegramBotToken: 'test-bot-token',
  telegramGroupId: '-1001234567890',
  telegramClient: {
    async sendOrder(order, user, items) {
      if (failNotification) throw new Error('Telegram sendMessage failed');
      notifications.push({ order, user, items });
      return { message_id: 17 };
    },
  },
});
let server;
let baseUrl;
const notifications = [];
let failNotification = false;

before(async () => {
  const salt = 'test-admin-salt';
  const passwordHash = `${salt}:${scryptSync('correct horse battery staple', salt, 64).toString('hex')}`;
  const timestamp = new Date().toISOString();
  db.prepare(`
    INSERT INTO admins (id,email,password_hash,password_scheme,created,updated)
    VALUES ('testadmin000001', 'admin@example.com', ?, 'scrypt', ?, ?)
  `).run(passwordHash, timestamp, timestamp);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  db.close();
  await rm(tempDir, { recursive: true, force: true });
});

test('public reads work while customer and write routes require an admin session', async () => {
  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });

  const products = await fetch(`${baseUrl}/api/collections/products/records`);
  assert.equal(products.status, 200);
  assert.deepEqual(await products.json(), []);

  const orders = await fetch(`${baseUrl}/api/collections/orders/records`);
  assert.equal(orders.status, 401);

  const denied = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'wrong password' }),
  });
  assert.equal(denied.status, 401);

  const login = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'correct horse battery staple' }),
  });
  assert.equal(login.status, 200);
  const { accessToken } = await login.json();
  assert.match(accessToken, /^[A-Za-z0-9_-]{40,}$/);
  const authorization = { Authorization: `Bearer ${accessToken}` };

  const session = await fetch(`${baseUrl}/api/admin/session`, { headers: authorization });
  assert.equal(session.status, 200);
  const authorizedOrders = await fetch(`${baseUrl}/api/collections/orders/records`, { headers: authorization });
  assert.equal(authorizedOrders.status, 200);

  const forbiddenOrigin = await fetch(`${baseUrl}/api/collections/products/records`, {
    headers: { Origin: 'https://attacker.example' },
  });
  assert.equal(forbiddenOrigin.status, 403);

  const logout = await fetch(`${baseUrl}/api/admin/logout`, {
    method: 'POST',
    headers: authorization,
  });
  assert.equal(logout.status, 204);
  const expiredSession = await fetch(`${baseUrl}/api/admin/session`, { headers: authorization });
  assert.equal(expiredSession.status, 401);
});

test('admin can create and delete a product image without exposing the upload directory', async () => {
  const login = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'correct horse battery staple' }),
  });
  const { accessToken } = await login.json();
  const image = await sharp({
    create: { width: 8, height: 8, channels: 3, background: '#cc8844' },
  }).webp().toBuffer();
  const form = new FormData();
  form.append('title', 'Test product');
  form.append('price', '12000');
  form.append('discount_price', '0');
  form.append('in_stock', 'true');
  form.append('size', JSON.stringify(['M']));
  form.append('color', JSON.stringify(['Qora — #000000']));
  form.append('keepImages', '[]');
  form.append('images', new Blob([image], { type: 'image/webp' }), 'test.webp');

  const create = await fetch(`${baseUrl}/api/collections/products/records`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  assert.equal(create.status, 201);
  const product = await create.json();
  assert.equal(product.title, 'Test product');
  assert.deepEqual(product.size, ['M']);
  assert.equal(product.images.length, 1);

  const file = await fetch(`${baseUrl}/api/files/products/${product.id}/${product.images[0]}`);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'image/webp');
  assert.equal((await file.arrayBuffer()).byteLength > 0, true);

  const updateForm = new FormData();
  updateForm.append('title', 'Updated test product');
  updateForm.append('price', '14000');
  updateForm.append('keepImages', '[]');
  const update = await fetch(`${baseUrl}/api/collections/products/records/${product.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: updateForm,
  });
  assert.equal(update.status, 200);
  assert.deepEqual((await update.json()).images, []);
  const removedImage = await fetch(`${baseUrl}/api/files/products/${product.id}/${product.images[0]}`);
  assert.equal(removedImage.status, 404);

  const remove = await fetch(`${baseUrl}/api/collections/products/records/${product.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.equal(remove.status, 204);
  const missing = await fetch(`${baseUrl}/api/files/products/${product.id}/${product.images[0]}`);
  assert.equal(missing.status, 404);
});

test('Telegram profile route rejects unsigned initData', async () => {
  const response = await fetch(`${baseUrl}/api/telegram/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: 'not-configured' }),
  });
  assert.equal(response.status, 401);
});

test('Telegram-verified orders recalculate prices, persist the profile, and notify the group', async () => {
  const timestamp = new Date().toISOString();
  db.prepare(`
    INSERT INTO products
      (id,title,price,discount_price,description,color,size,category,in_stock,images,created,updated)
    VALUES ('orderproduct001','Coat',100000,80000,'','["Qora — #000000"]','["M","L"]','Ayollar uchun',1,'[]',?,?)
  `).run(timestamp, timestamp);

  const fields = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'test-query-id',
    user: JSON.stringify({ id: 7712345, first_name: 'Test', last_name: 'Customer', username: 'test_customer' }),
  });
  const checkString = [...fields.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update('test-bot-token').digest();
  fields.set('hash', createHmac('sha256', secret).update(checkString).digest('hex'));

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData: fields.toString(),
      phone: '+998 90 123 45 67',
      address: 'Toshkent, Amir Temur ko‘chasi 1',
      items: [{ productId: 'orderproduct001', quantity: 2, size: 'M', color: 'Qora — #000000' }],
    }),
  });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.order.total_price, 160000);
  assert.equal(result.order.notification_status, 'sent');
  assert.equal(result.message_id, 17);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].user.telegram_id, '7712345');
  assert.equal(notifications[0].items[0].title, 'Coat');
  assert.equal(notifications[0].items[0].line_total, 160000);

  const customer = db.prepare('SELECT * FROM user WHERE telegram_id = ?').get('7712345');
  assert.equal(customer.name, 'Test Customer');
  assert.equal(customer.address, 'Toshkent, Amir Temur ko‘chasi 1');
  const savedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.order.id);
  assert.equal(savedOrder.notification_status, 'sent');

  failNotification = true;
  const failedNotification = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData: fields.toString(),
      phone: '+998 90 123 45 67',
      address: 'Toshkent, Amir Temur ko‘chasi 1',
      items: [{ productId: 'orderproduct001', quantity: 1, size: 'M', color: 'Qora — #000000' }],
    }),
  });
  assert.equal(failedNotification.status, 201);
  const failedResult = await failedNotification.json();
  assert.equal(failedResult.order.notification_status, 'failed');
  assert.match(failedResult.warning, /Telegram guruhiga yuborilmadi/);
  assert.equal(db.prepare('SELECT notification_status FROM orders WHERE id = ?').get(failedResult.order.id).notification_status, 'failed');
  failNotification = false;
});

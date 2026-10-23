# THENURAB Node.js API

The backend uses Node.js 22.13 or newer, Express, SQLite (`node:sqlite`), and
local WEBP image files. PocketBase is no longer required to run the storefront.

## Local development

1. Install backend dependencies with `npm install` from this directory.
2. Copy `.env.example` to `.env`. Set `TELEGRAM_BOT_TOKEN`,
   `TELEGRAM_GROUP_ID`, and `TELEGRAM_WEBAPP_URL`. The bot must be added to the
   group and allowed to post messages. Keep `.env` private.
3. Import the local PocketBase data and media once:

   ```powershell
   npm run import:pocketbase
   ```

   The importer reads `pb_data/data.db` and `pb_data/storage` without changing
   them, refuses to mix data into non-empty tables, and records an idempotency
   marker after a successful import. Products, banners, users, orders,
   superuser bcrypt hashes, and referenced images are copied to `data/` and
   `uploads/`.
4. Run the API with `npm run dev`.
5. In `store-vite`, copy `.env.example` to `.env.local`, leave
   `VITE_API_URL=http://127.0.0.1:3000`, and start Vite with `npm run dev`.

The API listens on loopback by default for local development. On the VPS,
`apithe.fastora.uz` is routed through the external HTTPS ingress to port 3010;
the API binds to that port and the ingress handles TLS. Keep direct public
access to port 3010 blocked. Set `NODE_ENV=production` and `CORS_ORIGINS` to
the exact storefront origin(s). The production storefront defaults to
`https://apithe.fastora.uz`; override it at build time with `VITE_API_URL` when
deploying to a different API host.

## Admin accounts

The importer carries over local PocketBase superuser password hashes when
they use bcrypt, so existing local admin credentials continue to work. To add
another admin, set a strong `ADMIN_PASSWORD` in the private `.env`, then run:

```powershell
npm run create-admin -- admin@example.com
```

The API stores new admin passwords using scrypt and issues a short-lived,
opaque bearer session token. The storefront keeps it in tab-scoped
`sessionStorage`, allowing the GitHub Pages frontend to authenticate with the
separately hosted API without relying on third-party cookies. Admin data and
write routes require that token.

The bot polls Telegram updates and replies to `/start` with a Web App button.
Orders are accepted only with valid, recent Telegram Mini App `initData`; the
server rechecks product prices and selected variants, saves the customer and
order transactionally, then sends all order details to the configured group.
The admin order list shows the saved details and whether the group message was
sent. Telegram token/group/network failures are recorded as notification
failures and surfaced to the customer instead of discarding the order.

## Data and media

`DATABASE_PATH` and `UPLOADS_DIR` can override the defaults (`data/thenurab.sqlite`
and `uploads/`). Those runtime directories are git-ignored. Keep regular backups
of both the SQLite database and uploads directory.

The old PocketBase database and storage are retained unchanged as the read-only
import source and backup. Its hooks and migrations remain only for historical
reference; the new backend does not execute them. The VPS PocketBase service,
data, binary, service account, and dedicated Nginx host were removed.

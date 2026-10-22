# PocketBase setup

The migration in `pb_migrations` keeps product and banner reads public for the
storefront, while restricting their changes and all customer/order records to
PocketBase superusers. Run PocketBase with automatic migrations enabled after
updating the backend files.

Create an admin account once:

```powershell
.\pocketbase.exe superuser create admin@example.com "use-a-strong-password"
```

Telegram Mini App profile verification requires the bot token on the server.
Set `TELEGRAM_BOT_TOKEN` in the environment of the PocketBase process before
starting it; do not put the token in frontend code or a `VITE_` variable:

```powershell
$env:TELEGRAM_BOT_TOKEN = "your-bot-token"
.\pocketbase.exe serve
```

Open `/admin` and sign in with the PocketBase superuser account. Open `/profile`
inside the Telegram Mini App to load and update the verified Telegram profile.
The website must be configured as a Telegram Mini App for Telegram to provide
its signed `initData`.

For the frontend, copy `store-vite/.env.example` to `store-vite/.env.local` and
set `VITE_POCKETBASE_URL` to the publicly reachable PocketBase URL before
building. Telegram Mini Apps on phones cannot reach a PocketBase URL set to
`127.0.0.1`.

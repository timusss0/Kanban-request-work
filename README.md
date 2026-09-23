# Website Request Board

A simple ticket system: the boss creates a request via the **+ New request** button, then the request moves through three columns: **To do**, **In progress**, and **Done**. Built with plain HTML, CSS, and JavaScript, Vercel serverless API, and MySQL.

## Project structure

```
papan-request/
├── api/tickets.js      API (GET, POST, PATCH, DELETE) — automatically becomes a serverless function on Vercel
├── lib/db.js           MySQL connection
├── public/             Frontend (index.html, style.css, app.js)
├── schema.sql          Creates the tickets table
├── local-server.js     Server for trying it out locally
├── .env.example        Example environment variables
└── package.json
```

## 1. Set up the MySQL database

Vercel can't connect to MySQL on your laptop (XAMPP/localhost), so the online version needs a MySQL instance reachable from the internet. Common choices: TiDB Cloud Serverless (MySQL-compatible), Aiven for MySQL, Railway, or MySQL on an office hosting/VPS that allows remote connections. Some have free tiers — check the latest terms on each site.

Once the database is ready, run the contents of `schema.sql` via the provider's console/SQL editor, phpMyAdmin, or:

```bash
mysql -h HOST -P PORT -u USER -p DATABASE_NAME < schema.sql
```

## 2. Try it locally (optional)

Requires Node.js 20.6 or newer.

```bash
npm install
cp .env.example .env     # then fill in the values
npm run dev              # open http://localhost:3000
```

If using local MySQL (XAMPP), set `DB_SSL=false`.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repository (the `.env` file is already ignored by `.gitignore` — don't upload it).
2. On vercel.com, choose **Add New → Project**, then import that repository. Framework Preset: **Other**. Leave the build command and output directory at their defaults.
3. Open **Settings → Environment Variables**, then enter all the variables from `.env.example` with their values.
4. Click **Deploy**. If environment variables are added after deploying, do a **Redeploy** so they take effect.

## Environment variables

| Name | Description |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection details |
| `DB_SSL` | `true` for cloud MySQL, `false` for local |
| `DB_SSL_CA` | Optional. CA certificate (PEM) if the provider requires it, e.g. Aiven |
| `APP_PASSWORD` | Board access code. Share it with the boss. If left empty, anyone who knows the URL can modify the board |

## How to use

The boss opens the URL, enters the access code once (saved in the browser), then clicks **+ New request**. You move cards using the buttons on the card (**Start working**, **Mark done**, etc.) or by drag & drop on desktop. Click a card's title to view details, edit, or delete it. The board automatically checks for new requests every 30 seconds.

## API endpoints

| Method | URL | Body |
|---|---|---|
| GET | `/api/tickets` | – |
| POST | `/api/tickets` | `{ title, description?, priority?, deadline?, requested_by? }` |
| PATCH | `/api/tickets?id=1` | Fields to update, e.g. `{ status: "done" }` |
| DELETE | `/api/tickets?id=1` | – |

All requests use the header `x-app-key: <APP_PASSWORD>`. `priority` values: `low`, `medium`, `high`. `status` values: `todo`, `progress`, `done`.

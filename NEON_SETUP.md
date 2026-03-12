# Neon setup (database + auth)

Your app now uses **Neon** for both the database and authentication. Supabase is no longer used.

## 1. Create a Neon project

1. Go to [neon.tech](https://neon.tech) and sign up or log in.
2. Create a new project and copy the **connection string** (e.g. `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`).

## 2. Create tables in Neon

In the **Neon Console** → **SQL Editor**, run the full contents of **`neon_schema.sql`**. That creates:

- **users** – auth (email + password hash)
- **customers** – customer records and notes (notes in `customers.notes` jsonb)
- **transactions** – transaction history

## 3. Backend (API server)

The backend handles signup, login, and all API routes using Neon.

```bash
cd server
cp .env.example .env
```

Edit **`server/.env`**:

- **NEON_DATABASE_URL** – your Neon connection string.
- **AUTH_JWT_SECRET** – a long random string used to sign JWTs (e.g. run `openssl rand -base64 32` and paste the result).

Then:

```bash
npm install
npm run dev
```

The API runs at `http://localhost:3001` (signup, login, and all `/api/*` routes).

## 4. Frontend

- **VITE_API_URL** – optional; defaults to `http://localhost:3001`. Set this if your API runs elsewhere (e.g. in production).
- You can remove **VITE_SUPABASE_URL** and **VITE_SUPABASE_ANON_KEY**; they are no longer used.

Run the app as usual:

```bash
npm run dev
```

## 5. Run both in development

1. Terminal 1: `cd server && npm run dev` (API on port 3001).
2. Terminal 2: `npm run dev` (Vite app).

Then open the app: sign up and sign in go through your API; all data is stored in Neon.

## Optional: remove Supabase

If you no longer need Supabase:

- Delete `src/lib/supabase.ts` if nothing imports it.
- Run `npm uninstall @supabase/supabase-js` in the project root.

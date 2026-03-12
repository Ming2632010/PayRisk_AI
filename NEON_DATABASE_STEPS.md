# Neon database setup – step-by-step

You have two SQL files. **Use only one of the options below**, depending on whether your Neon database is new or already in use.

---

## Option A: Brand new database (no tables yet)

Use this if you are setting up Neon for the first time, or the project has no tables yet.

### 1. Open Neon SQL Editor

1. Go to [Neon Console](https://console.neon.tech).
2. Sign in and select your project (or create one).
3. In the left sidebar, click **SQL Editor** (or open it from the project dashboard).

### 2. Run the full schema

1. Open the file **`neon_schema.sql`** in your project (in the project root folder).
2. Copy **all** of its contents (the whole file).
3. In the Neon SQL Editor, paste the copied SQL.
4. Click **Run** (or press the shortcut to execute).
5. You should see a success message and no errors. This creates:
   - `users`
   - `customers`
   - `transactions` (already including `finish_date`, `due_date`, `paid_fully`, `paid_at`)

**You do not need to run `neon_migration_transactions.sql`** when you use the full schema. You’re done with the database for this step.

---

## Option B: Database already has tables (existing app)

Use this if you already ran an **older** version of `neon_schema.sql` (without the new transaction columns) and the app is already using this database.

### 1. Open Neon SQL Editor

1. Go to [Neon Console](https://console.neon.tech).
2. Sign in and select the same project you use for this app.
3. In the left sidebar, click **SQL Editor**.

### 2. Run only the migration

1. Open the file **`neon_migration_transactions.sql`** in your project.
2. Copy **all** of its contents (all 4 `ALTER TABLE` lines).
3. In the Neon SQL Editor, paste the copied SQL.
4. Click **Run**.
5. You should see success. This only **adds** four columns to the existing `transactions` table:
   - `finish_date`
   - `due_date`
   - `paid_fully`
   - `paid_at`

**Do not run the full `neon_schema.sql`** in this case (it would try to create tables that already exist; your data stays safe with the migration).

---

## Quick decision

| Situation | What to run |
|-----------|-------------|
| New project / no tables in Neon yet | **neon_schema.sql** (full file) |
| App already using Neon with `users`, `customers`, `transactions` | **neon_migration_transactions.sql** only |

---

## After running SQL

1. Make sure **`server/.env`** has:
   - `NEON_DATABASE_URL` (from Neon: Connection string / connection details).
   - `AUTH_JWT_SECRET` (e.g. from `openssl rand -base64 32`).
2. Restart your server (`npm run dev` in the `server` folder) so it uses the updated schema.

If you tell me whether your Neon DB is new or already has tables, I can say in one line which file to run.

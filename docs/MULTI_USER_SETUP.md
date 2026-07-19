# Multi-user setup (projects + memberships)

PhD Manager now uses **one project** (`My PhD`) with **memberships**. You (owner/student) invite supervisors by email. Data is gated by Supabase Auth + RLS — unsigned visitors no longer see or edit your database rows.

GitHub Pages hosting stays as-is.

## 1. Apply the database migration

Run migration `051_projects_memberships_auth.sql` against your Supabase project (SQL editor, or `supabase db push` if you use the CLI).

This will:

- Create `projects`, `profiles`, `project_members`, `project_invites`
- Attach existing rows to the default project `My PhD`
- Replace open “Allow all” RLS with membership checks

**After this migration, the app will not load data until you sign in.**

## 2. Enable Auth in Supabase

In the Supabase dashboard:

1. **Authentication → Providers → Email** — enable Email (magic link / OTP).
2. **Authentication → URL configuration**
   - **Site URL:** `https://laurensgm.github.io/phd/` (or your Pages URL)
   - **Redirect URLs** (add all you use):
     - `https://laurensgm.github.io/phd/login/`
     - `http://localhost:4321/phd/login/` (local Astro with base `/phd/`)
     - `http://localhost:4321/login/` if you run without base locally

3. Optional: turn off “Confirm email” friction if magic links alone are enough for your workflow (dashboard setting depends on Supabase version).

## 3. Claim ownership (you — first login)

1. Deploy / run the app with the new UI.
2. Open **Manager → Sign in** (or `/phd/login/`).
3. Enter **your** email → open the magic link.
4. On first sign-in, if the default project has no members yet, you are added as **owner**.

Then open **Manager → Members** and confirm you appear as owner.

## 4. Invite your two supervisors

1. Go to **Members**.
2. Enter each supervisor’s email, role **Supervisor**, submit.
3. Tell them:
   - Open `https://laurensgm.github.io/phd/login/`
   - Sign in with **that same email**
   - After the magic link, they join the project automatically

Pending invites show on the Members page until they accept.

## 5. Roles (current behaviour)

| Role | Can invite | Can read/write project data |
|------|------------|-----------------------------|
| `owner` / `student` | Yes | Yes |
| `supervisor` | No | Yes (same data access for now) |

Supervisor-only / read-only views can be tightened later without changing the project model.

## 6. Local development

Ensure `.env` has:

```
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_ANON_KEY=...
```

Sign in via magic link using a redirect URL allowed in Supabase.

## 7. Browser extension / edge functions

The browser extension still uses the anon key without a user session — after RLS, it will **not** read/write project data until you add signed-in support. Edge functions that use the **service role** key continue to work for server-side jobs.

## 8. Later: more students

Create additional rows in `projects` and memberships per PhD. Existing `project_id` columns and RLS are already structured for that; you mainly add UI to switch/create projects.

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

## 2. Enable Auth in Supabase (magic link)

Magic link login is part of the **Email** provider. There is usually **no separate “Magic Link” switch** — Email is on by default.

### A. Confirm Email is enabled

1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard) and select your PhD project.
2. In the left sidebar: **Authentication** → **Sign In / Providers** (sometimes labelled **Providers**).
3. Open **Email**.
4. Ensure **Enable Email provider** is **ON**.
5. Leave magic-link behaviour as default (the app uses `signInWithOtp`, which emails a link).

### B. Allow your site as a redirect target (required)

1. Still under **Authentication**, open **URL Configuration**.
2. Set **Site URL** to:
   ```
   https://laurensgm.github.io/phd/
   ```
3. Under **Redirect URLs**, add (one per line):
   ```
   https://laurensgm.github.io/phd/login/
   http://localhost:4321/phd/login/
   ```
4. Save.

Without these URLs, the email may send but clicking the link will fail or land in the wrong place.

### C. Email delivery note

On the free Supabase SMTP, magic-link emails can be slow, rate-limited (~2/hour), or land in spam. Check spam. For reliable delivery later, add custom SMTP (Resend, etc.) under Authentication → SMTP.

### D. What you should see on the login page

After deploying the latest frontend, open:

`https://laurensgm.github.io/phd/login/`

You should see:

- title **Sign in with email**
- an **Email** field
- button **Email magic link**

If you only see **Checking session…**, hard-refresh (or wait a few seconds). That spinner should clear and show the form.

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

## 9. Admin panel (roles & permissions)

After migration `053_role_permissions_admin.sql`:

- Default-project **owners** are marked `profiles.is_superadmin = true`
- Open **Admin** in the navbar (or avatar → Admin panel) → `/phd/admin/`
- Navbar turns **dark blue** on admin pages
- Edit the placeholder permission matrix (rows: superadmin / student / supervisor)

Permissions are stored but not yet enforced on every page — that comes next when you wire gates into features.


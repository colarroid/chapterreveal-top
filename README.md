# ReedArk Admin

The platform admin site for ReedArk, hosted on its own subdomain
(for example `admin.yourdomain.com`). It shares the main app's Supabase
project; the database, migrations and church-facing app live in the main
`Scripture` repo.

## Sections

- **Translations**: upload Bible translations (USFM, OSIS, Zefania XML,
  CSV/TSV, JSON or "Book 1:1 text" lines) and publish them to every church.
- Lyrics, Churches, Users: coming soon.

## Access

Only accounts listed in `public.platform_admins` can sign in. The database
enforces this too (row-level security on `translations` and the `bibles`
storage bucket), so the site's own checks aren't the only guard.

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'someone@example.com';
```

## Develop

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL and anon key
npm run dev                  # http://localhost:3021
npm test
```

## Shared code

`src/lib/scripture/books.ts` and `import.ts` are copies of the main app's
files, and `translations.ts` lists the main app's built-in translations.
Keep them in step when either side changes.

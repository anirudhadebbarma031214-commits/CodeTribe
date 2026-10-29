# CodeTribe

**Build in public. Find your people.**

CodeTribe is a responsive developer-project showcase where people publish GitHub projects, discover other makers, and message a project's creator. The frontend uses HTML, Tailwind CSS, custom CSS, and vanilla JavaScript. Supabase provides Google OAuth, Postgres, row-level security, and Realtime messaging.

## Features
- Public project feed with search, sorting, project descriptions, stack tags, screenshot previews, creator profiles, and GitHub links.
- Google sign-in through Supabase Auth.
- Authenticated project submission with validation and database-side checks.
- Direct messaging with history loading and Supabase Realtime updates.
- Responsive layout, accessible dialogs, reduced-motion support, and escaped user-generated content.
- Database access protected by Row Level Security (RLS).

## Repository structure
```text
CodeTribe/
├── index.html
├── styles.css
├── js/
│   ├── config.js
│   ├── auth.js
│   ├── database.js
│   ├── chat.js
│   └── app.js
├── supabase_schema.sql
└── README.md
```

## 1. Configure Supabase
1. Open the [Supabase Dashboard](https://supabase.com/dashboard) and create a project.
2. In Project Settings → API (or Connect), copy the Project URL and publishable key. The legacy anon key is also suitable for browser use.
3. Open `js/config.js` and replace `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY` with your project's values.
4. Never put a `service_role` or secret key in frontend JavaScript. The public key is intended for browsers; RLS protects the data.

## 2. Configure Google OAuth
### A. Google Cloud
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create/select a project, then open APIs & Services → OAuth consent screen. Set the app name, support email, and developer contact email.
3. If the consent screen is in Testing mode, add your Google account(s) as Test users. Public production sign-in may require publishing or verification depending on Google's current requirements.
4. Go to APIs & Services → Credentials → Create Credentials → OAuth client ID, and select **Web application**.
5. In Authorized redirect URIs, add the callback URL shown in Supabase Authentication → Sign In / Providers → Google. It usually looks like `https://<project-ref>.supabase.co/auth/v1/callback`. Use the exact Supabase value, not your website URL.
6. Create the OAuth client and copy its Client ID and Client secret.

Official guide: [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2).

### B. Supabase provider
1. In Supabase, open Authentication → Sign In / Providers → Google.
2. Enable Google and paste the Client ID and Client secret, then save.
3. Open Authentication → URL Configuration. Set Site URL to your deployment URL, for example `https://anirudhadebbarma031214-commits.github.io/CodeTribe/` if using GitHub Pages.
4. Add the exact deployed URL to Redirect URLs. Add your local development origin too, for example `http://localhost:5500/**` or `http://127.0.0.1:5500/**`.
5. Keep redirect URLs restricted to sites you control and use HTTPS in production.

See the current [Supabase Google Auth guide](https://supabase.com/docs/guides/auth/social-login/auth-google).

## 3. Set up database and Realtime
1. In Supabase Dashboard → SQL Editor → New query, paste the complete contents of `supabase_schema.sql` and run it.
2. It creates `public.users` (profile data linked to `auth.users`), `public.projects`, and `public.messages`, along with indexes, a profile sync trigger, RLS policies, and Realtime publication setup.
3. In Database → Tables, confirm the three tables exist and RLS is enabled. Do not turn RLS off.
4. In Database → Publications / Realtime settings, confirm `messages` is included in `supabase_realtime`. The SQL attempts to add it automatically.
5. New Google sign-ins create/update a public profile through the trigger. Users who signed in before the trigger existed may need to sign in again to synchronize their profile.

Messages are visible only to sender and recipient. The starter supports visitors initiating a message from a project's card and project owners replying after the visitor's first message. A full production inbox should use a dedicated conversations/participants schema and add abuse controls.

## 4. Run locally
You need a local HTTP server rather than opening `index.html` directly.

**VS Code Live Server:** Open the folder, start Live Server from `index.html`, and allow-list its local URL in Supabase Authentication → URL Configuration.

**Python:** from the repository folder run:
```bash
python -m http.server 5500
```
Then open [http://localhost:5500](http://localhost:5500) and allow-list `http://localhost:5500/**` in Supabase.

Without configured Supabase values, the UI loads but sign-in, database, submission, and chat functions remain unavailable.

## 5. Deploy with GitHub Pages
1. Push the files to the repository's `main` branch.
2. In GitHub → Settings → Pages, choose **Deploy from a branch**, select `main` and `/(root)`, then save.
3. Wait for deployment. The URL should be `https://anirudhadebbarma031214-commits.github.io/CodeTribe/`.
4. Set that as Supabase's Site URL and add it to Redirect URLs.
5. Test sign-in, project submission, feed loading, and chat with two separate accounts.

The Supabase URL and public anon/publishable key in `js/config.js` are visible in a public repository by design. Never commit OAuth client secrets, database passwords, service-role keys, or other secrets.

## 6. Git commands
If you have not cloned the repo yet:
```bash
git clone https://github.com/anirudhadebbarma031214-commits/CodeTribe.git
cd CodeTribe
# Copy the project files into this folder, preserving js/
git add index.html styles.css js/config.js js/auth.js js/database.js js/chat.js js/app.js supabase_schema.sql README.md .gitignore
git commit -m "Build CodeTribe developer community"
git push origin main
```

If you are starting from a new local folder instead:
```bash
git init
git branch -M main
git remote add origin https://github.com/anirudhadebbarma031214-commits/CodeTribe.git
git add .
git commit -m "Build CodeTribe developer community"
git push -u origin main
```
If the remote already has commits, clone it first or run `git pull --rebase origin main` before pushing. Do not force-push unless you intend to overwrite remote history.

## 7. Verification checklist
- [ ] Correct Supabase URL and public key are set in `js/config.js`.
- [ ] Google provider credentials saved; callback URL matches Supabase exactly.
- [ ] Site URL and local/deployed redirect URLs are allow-listed.
- [ ] SQL ran successfully and RLS is enabled on all tables.
- [ ] `messages` is in `supabase_realtime`.
- [ ] Google sign-in creates a row in `public.users`.
- [ ] Signed-in users can submit a GitHub repository and see it in the feed.
- [ ] A second account can message the project owner and receive realtime updates.
- [ ] Invalid project URLs and unauthenticated writes are rejected.
- [ ] No secret keys were committed.

## Notes and known limits
- Screenshots are referenced by URL; this starter does not upload image files. Consider Supabase Storage and moderation for uploads.
- URL validation checks format but does not prove a repository is active or owned by the submitter. A production release should validate GitHub URLs server-side and add rate limits, reporting, spam prevention, and moderation.
- Tailwind CDN is convenient for a no-build starter; compile Tailwind locally for a production build.
- Dashboard labels can change; consult [Supabase Realtime](https://supabase.com/docs/guides/realtime) and [GitHub Pages](https://docs.github.com/pages) for current instructions.

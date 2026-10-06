# Impact Newsletter

A private newsletter for a program that works with elementary students. Staff pull pictures and videos from a Dropbox folder, shape a short letter, and send families one link. The key in that link is how parents get in.

## What you get

- A staff dashboard for issues, photos, and the letter
- A draft button that writes from your notes and does not invent events
- A parent page at `/v/<key>`
- An optional family passphrase on top of the link
- Email HTML you can download, with a button to the private page
- Newsletters stored in Neon Postgres

Photos stay in Dropbox. The app stores the file reference and asks Dropbox for a short-lived link when a parent opens the page.

## Staff

Open `/admin`. The first visit creates the only open signup. After that, add more staff from Settings.

## Dropbox

Until a Dropbox app is connected, paste a shared file link on the issue. Those links have to already be reachable by anyone who has them.

To browse a private folder:

1. Create a Dropbox app with scopes `files.metadata.read`, `files.content.read`, and `account_info.read`.
2. Set the redirect URI to `https://<your-domain>/api/dropbox/callback`.
3. Add `DROPBOX_APP_KEY` and `DROPBOX_APP_SECRET` to the Vercel project.
4. Connect Dropbox from Settings.

Then put a folder path such as `/Impact/Field Day`, or a shared folder link, on the issue and choose Import folder.

## Environment

Copy `.env.example` to `.env.local`.

- `DATABASE_URL` is the Neon pooled connection string.
- `AUTH_SECRET` is a long random string. It signs staff sessions and encrypts the Dropbox refresh token and family links.
- `AI_GATEWAY_API_KEY` is for local drafts. On Vercel, the AI Gateway authenticates with the project.

The draft model defaults to `anthropic/claude-sonnet-5.5`.

## Scripts

```bash
npm run dev
npm test
npm run build
```

#!/usr/bin/env node
// One-time helper: get a Google refresh token with BOTH gmail.send + calendar.events
// scopes, using the bar's EXISTING OAuth client (the same GMAIL_CLIENT_ID/SECRET in Supabase).
//
// Usage (no npm install needed — uses built-in Node only, Node 18+):
//   1) In Google Cloud Console → APIs & Services → Credentials → open your OAuth client
//      → "Download JSON". Save it somewhere (e.g. ~/Downloads/client.json).
//   2) Run:   node scripts/get-google-refresh-token.mjs ~/Downloads/client.json
//      (or set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET env vars and run with no arg)
//   3) A browser opens → sign in as iggysbarevents@gmail.com → click Allow.
//   4) The terminal prints your new refresh token + the exact command to save it.
//
// Note: the redirect URI below (http://localhost:53682) is auto-allowed for "Desktop app"
// OAuth clients. If you get redirect_uri_mismatch, your client is a "Web application" — just
// add  http://localhost:53682  to its Authorized redirect URIs in the Console, then rerun.

import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { URL } from 'node:url';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events',
];
const PORT = 53682;
const REDIRECT = `http://localhost:${PORT}`;
const PROJECT_REF = 'nouxyrqpulkbjusriugx';

function loadCreds() {
  const fileArg = process.argv[2];
  if (fileArg && existsSync(fileArg)) {
    const j = JSON.parse(readFileSync(fileArg, 'utf8'));
    const c = j.installed || j.web || j;
    if (c.client_id && c.client_secret) return { id: c.client_id, secret: c.client_secret };
  }
  if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET) {
    return { id: process.env.GMAIL_CLIENT_ID, secret: process.env.GMAIL_CLIENT_SECRET };
  }
  console.error(
    '\nNeed the OAuth client credentials. Either:\n' +
      '  • pass the downloaded JSON:  node scripts/get-google-refresh-token.mjs client.json\n' +
      '  • or set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET env vars.\n'
  );
  process.exit(1);
}

const { id, secret } = loadCreds();

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: id,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  }).toString();

const server = createServer(async (req, res) => {
  const u = new URL(req.url, REDIRECT);
  const code = u.searchParams.get('code');
  const err = u.searchParams.get('error');
  if (err) {
    res.end(`Error: ${err}. Check the terminal.`);
    console.error(`\n❌ Google returned an error: ${err}`);
    server.close();
    process.exit(1);
  }
  if (!code) {
    res.end('Waiting for Google…');
    return;
  }
  res.end('✅ Got it — close this tab and head back to the terminal.');
  server.close();

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: REDIRECT,
      grant_type: 'authorization_code',
    }).toString(),
  });
  const data = await resp.json();

  if (!data.refresh_token) {
    console.error('\n❌ No refresh token came back. Response:', data);
    console.error(
      'Fix: revoke this app at https://myaccount.google.com/permissions then rerun (Google only sends a refresh token on first consent).\n'
    );
    process.exit(1);
  }

  console.log('\n✅ Success! Your new refresh token (has gmail.send + calendar.events):\n');
  console.log(data.refresh_token);
  console.log('\n👉 Save it to Supabase by pasting this:\n');
  console.log(`supabase secrets set GMAIL_REFRESH_TOKEN='${data.refresh_token}' --project-ref ${PROJECT_REF}\n`);
  console.log('(No Supabase CLI? Paste the token into the dashboard instead:');
  console.log(` https://supabase.com/dashboard/project/${PROJECT_REF}/settings/functions )\n`);
  process.exit(0);
});

server.listen(PORT, () => {
  console.log('\nOpening Google sign-in in your browser… (sign in as iggysbarevents@gmail.com, click Allow)');
  console.log(`If it doesn't open automatically, paste this into a browser:\n${authUrl}\n`);
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open';
  exec(`${opener} "${authUrl}"`);
});

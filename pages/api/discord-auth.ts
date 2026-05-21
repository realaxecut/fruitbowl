import { NextApiRequest, NextApiResponse } from 'next';
const { db } = require('../../lib/db');

const DISCORD_CLIENT_ID     = process.env.DISCORD_CLIENT_ID!;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;
const DISCORD_GUILD_ID      = process.env.DISCORD_GUILD_ID!;
const DISCORD_BOT_TOKEN     = process.env.DISCORD_BOT_TOKEN!;
const NEXT_PUBLIC_BASE_URL  = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// The single redirect URI registered in Discord dev portal
const REDIRECT_URI = `${NEXT_PUBLIC_BASE_URL}/api/discord-auth?action=callback`;

db.exec(`
  CREATE TABLE IF NOT EXISTS discord_links (
    wallet      TEXT PRIMARY KEY,
    discord_id  TEXT NOT NULL UNIQUE,
    username    TEXT NOT NULL,
    avatar      TEXT,
    in_guild    INTEGER NOT NULL DEFAULT 0,
    linked_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
`);

const stmtUpsert = db.prepare(`
  INSERT OR REPLACE INTO discord_links (wallet, discord_id, username, avatar, in_guild, linked_at, updated_at)
  VALUES (@wallet, @discord_id, @username, @avatar, @in_guild, @now, @now)
  ON CONFLICT(wallet) DO UPDATE SET
    discord_id = excluded.discord_id,
    username   = excluded.username,
    avatar     = excluded.avatar,
    in_guild   = excluded.in_guild,
    updated_at = excluded.updated_at
`);
const stmtGet         = db.prepare('SELECT * FROM discord_links WHERE wallet = ?');
const stmtUpdateGuild = db.prepare(
  'UPDATE discord_links SET in_guild = @in_guild, updated_at = @now WHERE wallet = @wallet'
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { action, wallet: walletQuery, code, state } = req.query as Record<string, string>;

  // ── GET ?action=status&wallet=xxx ────────────────────────────────────────
  if (action === 'status') {
    if (!walletQuery) return res.status(400).json({ error: 'wallet required' });
    const row = stmtGet.get(walletQuery) as any;
    if (!row) return res.json({ linked: false, inGuild: false });

    let inGuild = false;
    if (DISCORD_BOT_TOKEN && DISCORD_GUILD_ID) {
      try {
        const r = await fetch(
          `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${row.discord_id}`,
          { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } }
        );
        inGuild = r.status === 200;
        stmtUpdateGuild.run({ wallet: walletQuery, in_guild: inGuild ? 1 : 0, now: Date.now() });
      } catch {
        inGuild = !!row.in_guild;
      }
    } else {
      inGuild = !!row.in_guild;
    }

    return res.json({ linked: true, inGuild, discordUsername: row.username, discordAvatar: row.avatar });
  }

  // ── GET ?action=callback&code=xxx&state=walletAddress ────────────────────
  if (action === 'callback') {
    // wallet is passed via OAuth state param
    const wallet = state ? decodeURIComponent(state) : null;
    if (!wallet || !code) {
      return res.status(400).send('Missing wallet (state) or code. Please try connecting again.');
    }

    // Exchange code for token
    const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return res.status(400).json({ error: 'Failed to get token', detail: err });
    }
    const token = await tokenRes.json();

    // Fetch Discord user
    const userRes = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!userRes.ok) return res.status(400).json({ error: 'Failed to fetch Discord user' });
    const discordUser = await userRes.json();

    // Check guild membership
    let inGuild = false;
    if (DISCORD_BOT_TOKEN && DISCORD_GUILD_ID) {
      try {
        const memberRes = await fetch(
          `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordUser.id}`,
          { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } }
        );
        inGuild = memberRes.status === 200;
      } catch { inGuild = false; }
    }

    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null;

    stmtUpsert.run({
      wallet,
      discord_id: discordUser.id,
      username:   discordUser.username,
      avatar,
      in_guild:   inGuild ? 1 : 0,
      now:        Date.now(),
    });

    const discordStatus = inGuild ? 'success' : 'not_in_guild';
    return res.redirect(`/?discord=${discordStatus}&discordUser=${encodeURIComponent(discordUser.username)}`);
  }

  return res.status(400).json({ error: 'Unknown action' });
}

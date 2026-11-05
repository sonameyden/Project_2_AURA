import { Hono } from "hono";
import type { Env } from "../types";

/**
 * Public `GET /invite/:code` landing page. Chat apps don't make `aura://`
 * links tappable, so share links point here and this page hands off to the
 * app. It reveals nothing about the playlist: the app loads the details
 * after the user signs in.
 */
export const invitePageRoutes = new Hono<{ Bindings: Env }>();

invitePageRoutes.get("/:code", (c) => {
  const code = c.req.param("code");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(code)) return c.text("Invalid invite link", 404);
  const appUrl = `aura://invite/${code}`;
  c.header("Cache-Control", "no-store");
  c.header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
  return c.html(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0; url=${appUrl}">
<title>Join a playlist on AURA</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif;
         background: #0C0D12; color: #F3F4F6; text-align: center; padding: 24px; box-sizing: border-box; }
  a { display: inline-block; margin-top: 16px; padding: 14px 22px; border-radius: 16px; background: #A855F7;
      color: #fff; text-decoration: none; font-weight: 700; }
  p { color: #9CA3AF; max-width: 320px; }
</style>
</head>
<body>
  <main>
    <h1>You've been invited to a playlist</h1>
    <p>Open AURA to see it and start listening together.</p>
    <a href="${appUrl}">Open in AURA</a>
    <p>Don't have the app yet? Install AURA, sign in, then tap this link again.</p>
  </main>
</body>
</html>`);
});

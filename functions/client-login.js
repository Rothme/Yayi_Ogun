// POST /client-login
// Body: { password: string }
// Verifies against KV-stored hash (client:password_hash). Falls back to the
// CLIENT_DASHBOARD_PASSWORD env var only until a KV hash has ever been set.
// On success, issues an HttpOnly, Secure, SameSite=Strict session cookie.

import { hashPassword, verifyPassword, makeSessionToken } from "./_shared/password.js";

const KV = (env) => env.AD_QR_STATS || env.AD_CACHE;
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = KV(env);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const password = body && body.password;
  if (!password) {
    return new Response(JSON.stringify({ error: "Password required" }), { status: 400 });
  }

  const storedHash = await kv.get("client:password_hash");
  let ok = false;

  if (storedHash) {
    ok = await verifyPassword(password, storedHash);
  } else if (env.CLIENT_DASHBOARD_PASSWORD) {
    // First-login fallback before any password has ever been set/rotated.
    ok = password === env.CLIENT_DASHBOARD_PASSWORD;
  }

  if (!ok) {
    return new Response(JSON.stringify({ error: "Incorrect password" }), { status: 401 });
  }

  const token = makeSessionToken();
  await kv.put(`session:${token}`, JSON.stringify({ role: "client" }), {
    expirationTtl: SESSION_TTL_SECONDS,
  });

  const headers = new Headers({ "content-type": "application/json" });
  headers.append(
    "set-cookie",
    `ad_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`
  );

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

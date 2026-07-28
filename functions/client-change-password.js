// POST /client-change-password
// Body: { currentPassword: string, newPassword: string }
// Requires a valid client session cookie (enforced by _middleware.js on this
// path too, but we double-check the session here since this mutates state).

import { hashPassword, verifyPassword } from "./_shared/password.js";

const KV = (env) => env.AD_QR_STATS || env.AD_CACHE;

async function getSessionRole(request, env) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/ad_session=([a-f0-9]+)/);
  if (!match) return null;
  const raw = await KV(env).get(`session:${match[1]}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw).role;
  } catch (e) {
    return null;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = KV(env);

  const role = await getSessionRole(request, env);
  if (role !== "client" && role !== "admin") {
    return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const { currentPassword, newPassword } = body || {};
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return new Response(
      JSON.stringify({ error: "New password must be at least 8 characters" }),
      { status: 400 }
    );
  }

  const storedHash = await kv.get("client:password_hash");
  let currentOk = false;
  if (storedHash) {
    currentOk = await verifyPassword(currentPassword, storedHash);
  } else if (env.CLIENT_DASHBOARD_PASSWORD) {
    currentOk = currentPassword === env.CLIENT_DASHBOARD_PASSWORD;
  }

  if (!currentOk && role !== "admin") {
    return new Response(JSON.stringify({ error: "Current password incorrect" }), { status: 401 });
  }

  const newHash = await hashPassword(newPassword);
  await kv.put("client:password_hash", newHash);

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

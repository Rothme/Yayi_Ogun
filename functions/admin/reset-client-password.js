// POST /admin/reset-client-password
// Body: { newPassword: string }
// Requires an admin session. Lets admin force-set a fresh client-insights
// password (e.g. if the client forgets theirs) without needing the old one.

import { hashPassword } from "../_shared/password.js";

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
  if (role !== "admin") {
    return new Response(JSON.stringify({ error: "Admin authentication required" }), {
      status: 401,
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const newPassword = body && body.newPassword;
  if (!newPassword || newPassword.length < 8) {
    return new Response(
      JSON.stringify({ error: "New password must be at least 8 characters" }),
      { status: 400 }
    );
  }

  const newHash = await hashPassword(newPassword);
  await kv.put("client:password_hash", newHash);

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

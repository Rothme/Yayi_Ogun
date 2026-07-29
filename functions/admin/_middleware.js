// functions/admin/_middleware.js
// Gates every request under /admin/*. GET requests to protected pages
// redirect to the login page; non-GET (API) requests to protected endpoints
// return 401 JSON instead.
//
// IMPORTANT: Cloudflare Pages can serve /admin/login.html at the clean URL
// /admin/login (stripping the .html), so both forms must be treated as the
// public login page — otherwise a mismatch here creates a redirect loop
// between "add .html" (our code) and "strip .html" (Cloudflare's own URL
// canonicalization).

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

const PUBLIC_PATHS = ["/admin/login.html", "/admin/login"];

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (PUBLIC_PATHS.includes(url.pathname)) {
    return next();
  }

  const role = await getSessionRole(request, env);
  if (role === "admin") {
    return next();
  }

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Admin authentication required" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  return Response.redirect(new URL("/admin/login.html", request.url).toString(), 302);
}

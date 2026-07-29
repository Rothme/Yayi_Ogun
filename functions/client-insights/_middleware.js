// functions/client-insights/_middleware.js
// Gates every request under /client-insights/*. Allows the login page and
// static PWA assets through unauthenticated.
//
// IMPORTANT: Cloudflare Pages can serve login.html at the clean URL /login
// (stripping .html), so both forms must be treated as public — otherwise a
// mismatch here creates a redirect loop between "add .html" (our code) and
// "strip .html" (Cloudflare's own URL canonicalization).

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

const PUBLIC_PATHS = [
  "/client-insights/login.html",
  "/client-insights/login",
  "/client-insights/manifest.json",
  "/client-insights/service-worker.js",
  "/client-insights/icon-192.png",
  "/client-insights/icon-512.png",
];

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (PUBLIC_PATHS.includes(url.pathname)) {
    return next();
  }

  const role = await getSessionRole(request, env);
  if (role === "client" || role === "admin") {
    return next();
  }

  return Response.redirect(new URL("/client-insights/login.html", request.url).toString(), 302);
}

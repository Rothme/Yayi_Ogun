// functions/client-insights/_middleware.js
// Intercepts every request under /client-insights/* before the matching
// route/static file is served. Allows the login page itself through
// unauthenticated; everything else requires a valid "client" or "admin"
// session cookie.

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

  // Not authenticated — send to the login page instead of serving content.
  return Response.redirect(new URL("/client-insights/login.html", request.url).toString(), 302);
}

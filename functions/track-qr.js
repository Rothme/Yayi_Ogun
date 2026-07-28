// GET /track-qr
// Logs a scan of the master QR code, then redirects to the product page.
// No PII is stored — only a timestamp and coarse country (from Cloudflare's
// edge request metadata, not an external geo-IP service).

const KV = (env) => env.AD_QR_STATS || env.AD_CACHE;
const REDIRECT_TARGET = "/delivers/";
const RECENT_CAP = 50;

export async function onRequestGet(context) {
  const { request, env } = context;
  const kv = KV(env);

  try {
    const country = request.cf && request.cf.country ? request.cf.country : "XX";
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // total counter
    const totalRaw = await kv.get("qr:total");
    const total = (parseInt(totalRaw, 10) || 0) + 1;

    // daily counter
    const dailyKey = `qr:daily:${dateKey}`;
    const dailyRaw = await kv.get(dailyKey);
    const daily = (parseInt(dailyRaw, 10) || 0) + 1;

    // country counter
    const countryKey = `qr:country:${country}`;
    const countryRaw = await kv.get(countryKey);
    const countryCount = (parseInt(countryRaw, 10) || 0) + 1;

    // recent scans feed (capped ring buffer)
    let recent = [];
    const recentRaw = await kv.get("qr:recent");
    if (recentRaw) {
      try {
        recent = JSON.parse(recentRaw);
      } catch (e) {
        recent = [];
      }
    }
    recent.unshift({ ts: now.toISOString(), country });
    if (recent.length > RECENT_CAP) recent = recent.slice(0, RECENT_CAP);

    await Promise.all([
      kv.put("qr:total", String(total)),
      kv.put(dailyKey, String(daily), { expirationTtl: 60 * 60 * 24 * 400 }), // keep ~400 days
      kv.put(countryKey, String(countryCount)),
      kv.put("qr:recent", JSON.stringify(recent)),
    ]);
  } catch (err) {
    // Never block the redirect on a logging failure.
    console.error("track-qr logging failed", err);
  }

  return Response.redirect(new URL(REDIRECT_TARGET, request.url).toString(), 302);
}

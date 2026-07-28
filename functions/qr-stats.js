// GET /qr-stats
// Read-only. Returns aggregate QR scan analytics. Powers both /admin and
// /client-insights dashboards — access control happens in the middlewares
// that sit in front of those two paths, not here.

const KV = (env) => env.AD_QR_STATS || env.AD_CACHE;

function last30Dates() {
  const dates = [];
  const d = new Date();
  for (let i = 29; i >= 0; i--) {
    const day = new Date(d);
    day.setDate(d.getDate() - i);
    dates.push(day.toISOString().slice(0, 10));
  }
  return dates;
}

export async function onRequestGet(context) {
  const { env } = context;
  const kv = KV(env);

  const totalRaw = await kv.get("qr:total");
  const total = parseInt(totalRaw, 10) || 0;

  const dates = last30Dates();
  const dailyEntries = await Promise.all(
    dates.map(async (date) => {
      const raw = await kv.get(`qr:daily:${date}`);
      return { date, count: parseInt(raw, 10) || 0 };
    })
  );

  const recentRaw = await kv.get("qr:recent");
  let recent = [];
  if (recentRaw) {
    try {
      recent = JSON.parse(recentRaw);
    } catch (e) {
      recent = [];
    }
  }

  // Aggregate country breakdown from the recent feed's distinct countries
  // by reading their dedicated counters (bounded, small key set in practice).
  const countries = [...new Set(recent.map((r) => r.country))];
  const countryCounts = await Promise.all(
    countries.map(async (c) => {
      const raw = await kv.get(`qr:country:${c}`);
      return { country: c, count: parseInt(raw, 10) || 0 };
    })
  );
  countryCounts.sort((a, b) => b.count - a.count);

  return new Response(
    JSON.stringify({
      total,
      daily: dailyEntries,
      recent: recent.slice(0, 20),
      byCountry: countryCounts,
      generatedAt: new Date().toISOString(),
    }),
    {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    }
  );
}

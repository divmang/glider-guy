exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  let body; try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: "Bad Request" }; }
  const { session_id } = body;
  if (!session_id) return { statusCode: 400, body: "Missing session_id" };
  const ip = event.headers["x-forwarded-for"]?.split(",")[0]?.trim() || event.headers["x-nf-client-connection-ip"] || "unknown";
  let country = "Unknown", region = "Unknown";
  try {
    if (ip && ip !== "unknown" && ip !== "127.0.0.1" && !ip.startsWith("::")) {
      const geo = await fetch(`http://ip-api.com/json/${ip}?fields=country,regionName,status`);
      const d = await geo.json();
      if (d.status === "success") { country = d.country || "Unknown"; region = d.regionName || "Unknown"; }
    }
  } catch {}
  const supaUrl = "https://lsqhstaamkrzuuwjpkbn.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  await fetch(`${supaUrl}/rest/v1/sessions`, { method:"POST", headers:{ apikey:serviceKey, Authorization:`Bearer ${serviceKey}`, "Content-Type":"application/json", Prefer:"return=minimal" }, body:JSON.stringify({session_id,country,region}) });
  return { statusCode: 200, body: JSON.stringify({ ok:true }) };
};

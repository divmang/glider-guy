exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  let body; try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: "Bad Request" }; }
  const { session_id } = body;
  if (!session_id) return { statusCode: 400, body: "Missing session_id" };
  const supaUrl = "https://lsqhstaamkrzuuwjpkbn.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const res = await fetch(`${supaUrl}/rest/v1/purchases?session_id=eq.${encodeURIComponent(session_id)}&select=id&limit=1`, { headers:{ apikey:serviceKey, Authorization:`Bearer ${serviceKey}` } });
  const rows = res.ok ? await res.json() : [];
  return { statusCode:200, headers:{"Content-Type":"application/json"}, body:JSON.stringify({ adFree:rows.length>0 }) };
};

const crypto = require("crypto");
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  const secret = process.env.LEMON_SIGNING_SECRET;
  const signature = event.headers["x-signature"];
  if (!secret || !signature) return { statusCode: 401, body: "Unauthorized" };
  const digest = crypto.createHmac("sha256", secret).update(event.body).digest("hex");
  let valid = false;
  try { valid = crypto.timingSafeEqual(Buffer.from(digest,"hex"), Buffer.from(signature,"hex")); } catch {}
  if (!valid) return { statusCode: 401, body: "Invalid signature" };
  let payload; try { payload = JSON.parse(event.body); } catch { return { statusCode: 400, body: "Bad JSON" }; }
  const meta = payload?.meta?.custom_data || payload?.data?.attributes?.custom_data || {};
  const session_id = meta.session_id;
  if (!session_id) return { statusCode: 200, body: "No session_id" };
  const supaUrl = "https://lsqhstaamkrzuuwjpkbn.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  await fetch(`${supaUrl}/rest/v1/purchases`, { method:"POST", headers:{ apikey:serviceKey, Authorization:`Bearer ${serviceKey}`, "Content-Type":"application/json", Prefer:"resolution=merge-duplicates" }, body:JSON.stringify({session_id}) });
  return { statusCode: 200, body: "OK" };
};

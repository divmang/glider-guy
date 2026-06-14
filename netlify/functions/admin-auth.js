const crypto = require("crypto");
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  let body; try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: "Bad Request" }; }
  const { password } = body;
  if (!password) return { statusCode: 400, body: "Missing password" };
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return { statusCode: 500, body: "Server misconfigured" };
  let match = false;
  try { match = crypto.timingSafeEqual(Buffer.from(password), Buffer.from(adminPassword)); } catch {}
  return { statusCode: match ? 200 : 401, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: match }) };
};

const crypto = require("crypto");
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  let body; try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: "Bad Request" }; }
  const { password } = body;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!password || !adminPassword) return { statusCode: 401, body: JSON.stringify({ ok: false }) };
  let match = false;
  try { match = crypto.timingSafeEqual(Buffer.from(password), Buffer.from(adminPassword)); } catch {}
  if (!match) return { statusCode: 401, body: JSON.stringify({ ok: false, error: "Unauthorized" }) };
  const supaUrl = "https://lsqhstaamkrzuuwjpkbn.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  try {
    const [sessRes, scoresRes] = await Promise.all([
      fetch(`${supaUrl}/rest/v1/sessions?select=session_id,country,region,created_at&order=created_at.desc&limit=10000`, { headers }),
      fetch(`${supaUrl}/rest/v1/scores?select=name,score,created_at&order=score.desc,created_at.asc&limit=10000`, { headers }),
    ]);
    const sessions = sessRes.ok ? await sessRes.json() : [];
    const scores = scoresRes.ok ? await scoresRes.json() : [];
    const totalPlays = sessions.length, uniqueUsers = new Set(sessions.map(s => s.session_id)).size;
    const countryCounts = {};
    for (const s of sessions) { const c = s.country || "Unknown"; countryCounts[c] = (countryCounts[c] || 0) + 1; }
    const topCountries = Object.entries(countryCounts).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([country,count])=>({country,count}));
    const dayCounts = {};
    for (const s of sessions) { const d = s.created_at?.slice(0,10); if(d) dayCounts[d]=(dayCounts[d]||0)+1; }
    const now = Date.now(), last30 = [];
    for (let i=29;i>=0;i--) { const d=new Date(now-i*86400000).toISOString().slice(0,10); last30.push({date:d,count:dayCounts[d]||0}); }
    const vals = scores.map(s=>s.score);
    const avgScore = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
    const maxScore = vals.length ? Math.max(...vals) : 0;
    const buckets = {"0-5":0,"6-10":0,"11-20":0,"21-50":0,"51+":0};
    for (const v of vals) { if(v<=5)buckets["0-5"]++;else if(v<=10)buckets["6-10"]++;else if(v<=20)buckets["11-20"]++;else if(v<=50)buckets["21-50"]++;else buckets["51+"]++; }
    return { statusCode: 200, headers: {"Content-Type":"application/json"}, body: JSON.stringify({ ok:true, stats:{ totalPlays, uniqueUsers, totalScores:scores.length, avgScore, maxScore, topCountries, playsPerDay:last30, scoreBuckets:Object.entries(buckets).map(([range,count])=>({range,count})), recentScores:scores.slice(0,10) } }) };
  } catch (err) { return { statusCode: 500, body: JSON.stringify({ ok:false, error:err.message }) }; }
};

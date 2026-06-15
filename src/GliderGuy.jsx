import { useEffect, useRef, useState, useCallback } from "react";
import LOGO_SRC from "./logo.js";

// ─── Supabase ────────────────────────────────────────────────
const SUPA_URL = "https://lsqhstaamkrzuuwjpkbn.supabase.co";
const SUPA_KEY = "sb_publishable_wOOA-eMCDwYLB5RbA6gfiQ_cK4J0WYe";

// ─── Offline queue ───────────────────────────────────────────
const QUEUE_KEY = "gg_score_queue";
function loadQueue() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY)||"[]"); } catch { return []; } }
function saveQueue(q) { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {} }
async function flushQueue() {
  const q = loadQueue();
  if (!q.length) return;
  const remaining = [];
  for (const item of q) {
    try {
      const r = await fetch(`${SUPA_URL}/rest/v1/scores`, { method:"POST", headers:{ apikey:SUPA_KEY, Authorization:`Bearer ${SUPA_KEY}`, "Content-Type":"application/json", Prefer:"return=minimal" }, body:JSON.stringify(item) });
      if (!r.ok) remaining.push(item);
    } catch { remaining.push(item); }
  }
  saveQueue(remaining);
}
async function fetchTopScores(limit=3) {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/scores?select=name,score&order=score.desc,created_at.asc&limit=${limit}`, { headers:{ apikey:SUPA_KEY, Authorization:`Bearer ${SUPA_KEY}` } });
    return r.ok ? r.json() : [];
  } catch { return []; }
}
async function fetchAllScores() {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/scores?select=name,score,created_at&order=score.desc,created_at.asc&limit=100`, { headers:{ apikey:SUPA_KEY, Authorization:`Bearer ${SUPA_KEY}` } });
    return r.ok ? r.json() : [];
  } catch { return []; }
}
async function submitScore(name, score) {
  const entry = { name: name.trim().slice(0,20), score };
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/scores`, { method:"POST", headers:{ apikey:SUPA_KEY, Authorization:`Bearer ${SUPA_KEY}`, "Content-Type":"application/json", Prefer:"return=minimal" }, body:JSON.stringify(entry) });
    if (!r.ok) throw new Error("failed");
    return true;
  } catch {
    // offline — queue it
    const q = loadQueue();
    q.push(entry);
    saveQueue(q);
    return false; // submitted to queue, not live yet
  }
}

// ─── image loader ────────────────────────────────────────────
const IMGS = {};
const IMG_SRCS = {
  bgSky:     "/img/bg-sky.png",
  hillsFar:  "/img/hills-far.png",
  hillsNear: "/img/hills-near.png",
  ground:    "/img/ground.png",
  player:    "/img/player.png",
  pillar:    "/img/pillar.png",
  uiPanel:   "/img/ui-panel.png",
};
let imgsLoaded = false;
function loadImages(cb) {
  if (imgsLoaded) { cb(); return; }
  let count = 0, total = Object.keys(IMG_SRCS).length;
  for (const [k, src] of Object.entries(IMG_SRCS)) {
    const img = new Image();
    img.onload  = () => { IMGS[k]=img; count++; if(count===total){ imgsLoaded=true; cb(); } };
    img.onerror = () => { IMGS[k]=null; count++; if(count===total){ imgsLoaded=true; cb(); } };
    img.src = src;
  }
}
// Preload immediately on module load so images are ready before first game
loadImages(() => {});

// ─── canvas rr ───────────────────────────────────────────────
function rr(ctx,x,y,w,h,r=5){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();}

// ─── constants ───────────────────────────────────────────────
const GRAVITY         = 0.32;
const PLY_X           = 0.22;
const PILLAR_W        = 80;
const PILLAR_HIT      = Math.round(80 * 0.54); // ~43px = actual shaft width
const _PSCALE         = PILLAR_W / 199;
const PILLAR_CAP_TOP  = Math.round(150 * _PSCALE);
const PILLAR_CAP_BOT  = Math.round(91  * _PSCALE);
const BASE_SPEED      = 2.6;
const MAX_SPEED       = 6.2;
const TOP_N           = 50;
const INTERSTITIAL_EVERY = 4;
const PUB_ID          = "ca-pub-5015379766355417";
const AD_SLOT         = "auto";
const CHECKOUT_URL    = "https://saltwolfgames.lemonsqueezy.com/checkout/buy/f04de7d7-85be-4ffb-887b-dda4f0aaa7cf";
const MEDALS          = ["🥇","🥈","🥉"];
const ff = "'Palatino Linotype','Georgia',serif";
const ffUI = "'Palatino Linotype','Georgia',serif";
const BTN_ZONE_H      = Math.min(130, Math.max(90, Math.round(window.innerHeight * 0.14)));
const PILLAR_GAP_BASE = Math.round(window.innerHeight * 0.22);
const PILLAR_GAP_MIN  = Math.round(window.innerHeight * 0.14);

function gameSpeed(sc) { return Math.min(BASE_SPEED + sc * 0.11, MAX_SPEED); }
function btnStyle(c1,c2,sh) { return { background:`linear-gradient(135deg,${c1},${c2})`, color:"#fff", border:"none", borderRadius:50, padding:"16px 48px", fontSize:20, fontWeight:900, letterSpacing:1, cursor:"pointer", boxShadow:`0 5px 0 ${sh},0 0 30px ${c1}88`, WebkitTapHighlightColor:"transparent", fontFamily:ff }; }
function getSessionId() { try { let id=localStorage.getItem("gg_sid"); if(!id){id=Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem("gg_sid",id);} return id; } catch { return Math.random().toString(36).slice(2); } }
function pushAd(el) { try { if(el&&window.adsbygoogle)(window.adsbygoogle=window.adsbygoogle||[]).push({}); } catch {} }

function newGame(W, H) {
  return { W, H, frame:0, score:0, scrollX:0,
    ply: { x:-60, y:H*0.38, vy:-1.2, dead:false },
    pillars:[], pillarTimer:60,
    particles:[],
    state:"intro"
  };
}

export default function GliderGuy() {
  const canvasRef   = useRef(null);
  const gRef        = useRef(null);
  const rafRef      = useRef(null);
  const bestRef     = useRef(0);
  const audioRef    = useRef(null);
  const sfxRef      = useRef({});
  const mutedRef    = useRef(false);
  const brandTapRef = useRef({count:0,timer:null});
  const bannerRef   = useRef(null);
  const gameCountRef= useRef(0);
  const scoreRef    = useRef(0);
  const adminPwRef  = useRef(null);

  const [muted,        setMuted]        = useState(false);
  const [screen,       setScreen]       = useState("menu");
  const [dispScore,    setDispScore]    = useState(0);
  const [dispBest,     setDispBest]     = useState(0);
  const [topScores,    setTopScores]    = useState([]);
  const [allScores,    setAllScores]    = useState([]);
  const [showAll,      setShowAll]      = useState(false);
  const [nameInput,    setNameInput]    = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [isTopScore,   setIsTopScore]   = useState(false);
  const [adFree,       setAdFree]       = useState(false);
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [buyingAdFree, setBuyingAdFree] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState(0);
  const [countdown,    setCountdown]    = useState(null);
  const countdownRef  = useRef(null);
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminPw,     setAdminPw]       = useState("");
  const [adminError,  setAdminError]    = useState("");
  const [adminChecking,setAdminChecking]= useState(false);
  const [adminStats,  setAdminStats]    = useState(null);
  const [loadingStats,setLoadingStats]  = useState(false);

  // ── music ────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current; if (!audio) return;
    audio.loop = true; audio.volume = 0.55;
    audio.load(); // needed for multi-source <audio> on iOS
    const tryPlay = () => audio.play().catch(()=>{});
    // try on any user interaction anywhere on the page
    document.addEventListener("touchstart", tryPlay, {once:true});
    document.addEventListener("mousedown",  tryPlay, {once:true});
    document.addEventListener("touchend",   tryPlay, {once:true});
    document.addEventListener("click",      tryPlay, {once:true});
    const onVis = () => { if(document.hidden) audio.pause(); else if(!audio.muted) audio.play().catch(()=>{}); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("touchstart", tryPlay);
      document.removeEventListener("mousedown",  tryPlay);
      document.removeEventListener("touchend",   tryPlay);
      document.removeEventListener("click",      tryPlay);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  function toggleMute() {
    const a=audioRef.current; if(!a) return;
    a.muted=!a.muted; mutedRef.current=a.muted; setMuted(a.muted);
    Object.values(sfxRef.current).forEach(s=>{ if(s) s.muted=a.muted; });
  }

  // ── SFX preload ──────────────────────────────────────────────
  useEffect(() => {
    const sfxFiles = {
      boost:     "/sfx/boost.wav",
      score:     "/sfx/score.wav",
      death:     "/sfx/death.wav",
      countdown: "/sfx/countdown.wav",
      top50:     "/sfx/top50.wav",
    };
    const sfx = {};
    for (const [k, src] of Object.entries(sfxFiles)) {
      const a = new Audio(src);
      a.preload = "auto";
      a.volume = k==="boost" ? 0.35 : k==="score" ? 0.5 : k==="death" ? 0.7 : k==="countdown" ? 0.6 : 0.8;
      sfx[k] = a;
    }
    sfxRef.current = sfx;
  }, []);

  function playSfx(name) {
    if (mutedRef.current) return;
    const sfx = sfxRef.current[name];
    if (!sfx) return;
    try { sfx.currentTime=0; sfx.play().catch(()=>{}); } catch {}
  }

  // ── offline queue monitor ────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      await flushQueue();
      setOfflineQueue(loadQueue().length);
    };
    check();
    window.addEventListener("online", check);
    return () => window.removeEventListener("online", check);
  }, []);

  // ── ad-free check ────────────────────────────────────────────
  useEffect(() => {
    try { if(localStorage.getItem("gg_adfree")==="1"){ setAdFree(true); return; } } catch {}
    fetch("/api/check-purchase",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:getSessionId()})})
      .then(r=>r.json()).then(d=>{ if(d.adFree){ setAdFree(true); try{localStorage.setItem("gg_adfree","1");}catch{} } }).catch(()=>{});
  }, []);

  useEffect(() => {
    if (!adFree && (screen==="menu"||screen==="dead")) setTimeout(()=>pushAd(bannerRef.current),300);
  }, [screen, adFree]);

  // ── leaderboard ──────────────────────────────────────────────
  const refreshTop = useCallback(async () => { setTopScores(await fetchTopScores(3)); }, []);
  useEffect(() => { refreshTop(); }, [refreshTop]);

  async function checkIsTopScore(score) {
    if (score < 1) return false;
    try {
      const top = await fetchTopScores(TOP_N);
      if (top.length < TOP_N) return true;
      return score > Math.min(...top.map(s=>s.score));
    } catch { return score >= 1; }
  }

  async function handleSubmit() {
    if (!nameInput.trim() || submitting) return;
    setSubmitting(true);
    await submitScore(nameInput, scoreRef.current);
    setSubmitted(true); setSubmitting(false);
    setOfflineQueue(loadQueue().length);
    refreshTop();
  }

  async function openAllScores() {
    setLoadingBoard(true); setShowAll(true);
    setAllScores(await fetchAllScores());
    setLoadingBoard(false);
  }

  // ── buy ad-free ──────────────────────────────────────────────
  function handleBuyAdFree() {
    const url = `${CHECKOUT_URL}?checkout[custom][session_id]=${getSessionId()}`;
    window.open(url, "_blank");
    setBuyingAdFree(true);
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const d = await fetch("/api/check-purchase",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:getSessionId()})}).then(r=>r.json());
        if (d.adFree) { setAdFree(true); setBuyingAdFree(false); try{localStorage.setItem("gg_adfree","1");}catch{} clearInterval(poll); }
      } catch {}
      if (attempts > 60) clearInterval(poll);
    }, 5000);
  }

  // ── session logging ──────────────────────────────────────────
  async function logSession() {
    try { await fetch("/api/log-session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:getSessionId()})}); } catch {}
  }

  // ── admin triple-tap ─────────────────────────────────────────
  function handleBrandTap() {
    const t = brandTapRef.current;
    t.count++;
    if (t.timer) clearTimeout(t.timer);
    if (t.count >= 3) { t.count=0; setAdminPw(""); setAdminError(""); setShowAdminPrompt(true); }
    else t.timer = setTimeout(()=>{ t.count=0; }, 900);
  }

  async function handleAdminLogin() {
    if (!adminPw.trim() || adminChecking) return;
    setAdminChecking(true); setAdminError("");
    try {
      const d = await fetch("/api/admin-auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:adminPw})}).then(r=>r.json());
      if (d.ok) { adminPwRef.current=adminPw; setShowAdminPrompt(false); setAdminPw(""); loadAdminStats(adminPw); setScreen("admin"); }
      else setAdminError("Wrong password.");
    } catch { setAdminError("Connection error."); }
    setAdminChecking(false);
  }

  async function loadAdminStats(pw) {
    setLoadingStats(true);
    const password = pw || adminPwRef.current;
    if (!password) { setLoadingStats(false); return; }
    try {
      const d = await fetch("/api/admin-stats",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password})}).then(r=>r.json());
      if (d.ok) setAdminStats(d.stats); else setAdminStats(null);
    } catch {}
    setLoadingStats(false);
  }

  function goMenu() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current=null; }
    if (gRef.current) gRef.current.state="dead";
    setShowAll(false); refreshTop(); setScreen("menu");
  }

  // ── GAME LOGIC ───────────────────────────────────────────────
  function spawnPillar(g) {
    const gap = Math.max(PILLAR_GAP_BASE - g.score*1.3, PILLAR_GAP_MIN);
    const sky = g.H - BTN_ZONE_H;
    const topH = sky*0.09 + Math.random()*(sky*0.82 - gap);
    g.pillars.push({ x:g.W + PILLAR_W + 2, topH, gap, passed:false });
  }

  // ── BOOST (main button) ──────────────────────────────────────
  function boost() {
    if (!gRef.current || gRef.current.state !== "playing") return;
    gRef.current.ply.vy = Math.max(gRef.current.ply.vy - 7.5, -12);
    playSfx("boost");
  }

  function die(g) {
    if (g.state !== "playing") return;
    g.state = "dead"; g.ply.dead = true;
    playSfx("death");
    for (let i=0;i<32;i++) { const a=Math.random()*Math.PI*2,s=Math.random()*9+2; g.particles.push({x:g.ply.x,y:g.ply.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,r:Math.random()*10+4,hue:Math.random()*60+10}); }
    const sc=g.score, nb=Math.max(sc,bestRef.current); bestRef.current=nb; scoreRef.current=sc;
    gameCountRef.current++;
    const showAd = !adFree && gameCountRef.current % INTERSTITIAL_EVERY === 0;
    setTimeout(async () => {
      setDispScore(sc); setDispBest(nb);
      setNameInput(""); setSubmitted(false); setSubmitting(false);
      const top = await checkIsTopScore(sc);
      setIsTopScore(top);
      if (top) playSfx("top50");
      if (showAd) setShowInterstitial(true);
      else setScreen("dead");
    }, 700);
  }

  function update(g) {
    g.frame++;
    const { W, H } = g;
    const groundY = H - BTN_ZONE_H;
    const spd = gameSpeed(g.score);

    if (g.state === "intro") {
      g.ply.x += 4.5; g.ply.vy += GRAVITY*0.45; g.ply.y += g.ply.vy;
      g.ply.y = Math.max(40, Math.min(g.ply.y, groundY-30));
      g.scrollX += gameSpeed(g.score);
      if (g.ply.x >= W*PLY_X) { g.ply.x=W*PLY_X; g.ply.vy=0; g.state="countdown"; }
      return;
    }
    if (g.state === "countdown") {
      g.ply.vy = Math.sin(g.frame*0.08)*0.4; g.ply.y += g.ply.vy;
      g.scrollX += gameSpeed(g.score);
      return;
    }
    if (g.state !== "playing") return;

    g.ply.vy = Math.min(g.ply.vy + GRAVITY, 14); g.ply.y += g.ply.vy;
    g.scrollX += gameSpeed(g.score);
    if (g.ply.y - 15 < 0) { g.ply.y=15; g.ply.vy=1.5; }
    if (g.ply.y + 15 > groundY) { die(g); return; }

    const interval = Math.max(76, 145 - g.score*2.8);
    if (++g.pillarTimer >= interval) { spawnPillar(g); g.pillarTimer=0; }

    for (let i=g.pillars.length-1; i>=0; i--) {
      const p=g.pillars[i]; p.x-=spd;
      if (!p.passed && p.x+PILLAR_W < g.ply.x) { p.passed=true; g.score++; setDispScore(g.score); playSfx("score"); }
      if (p.x < -PILLAR_W-10) g.pillars.splice(i,1);
    }
    for (const p of g.pillars) {
      const hitX = p.x + (PILLAR_W - PILLAR_HIT) / 2;
      const pr = 10;
      // collision matches the logical gap boundaries exactly
      if (g.ply.x+pr > hitX && g.ply.x-pr < hitX+PILLAR_HIT &&
          (g.ply.y-pr < p.topH || g.ply.y+pr > p.topH+p.gap)) {
        die(g); return;
      }
    }

    for (let i=g.particles.length-1;i>=0;i--) { const p=g.particles[i]; p.x+=p.vx; p.y+=p.vy; p.vy+=0.22; p.life-=0.025; if(p.life<=0)g.particles.splice(i,1); }
  }

  function draw(ctx, g) {
    const { W, H, frame:f, ply, pillars, particles, scrollX } = g;
    ctx.clearRect(0,0,W,H);
    const groundY = H - BTN_ZONE_H;

    // ── BACKGROUND SKY ──
    if (IMGS.bgSky) {
      ctx.drawImage(IMGS.bgSky, 0, 0, W, groundY);
    } else {
      const skyG=ctx.createLinearGradient(0,0,0,groundY);
      skyG.addColorStop(0,"#04080f");
      skyG.addColorStop(0.35,"#080f18");
      skyG.addColorStop(0.65,"#12180e");
      skyG.addColorStop(0.85,"#2a1a06");
      skyG.addColorStop(1,"#4a2808");
      ctx.fillStyle=skyG; ctx.fillRect(0,0,W,groundY);
      // amber glow from horizon
      const glow=ctx.createRadialGradient(W*0.5,groundY,0,W*0.5,groundY,W*0.75);
      glow.addColorStop(0,"rgba(160,80,10,0.55)");
      glow.addColorStop(0.5,"rgba(80,40,5,0.2)");
      glow.addColorStop(1,"transparent");
      ctx.fillStyle=glow; ctx.fillRect(0,0,W,groundY);
    }

    // ── FAR HILLS (15% scroll speed) ──
    if (IMGS.hillsFar) {
      const iw=IMGS.hillsFar.naturalWidth||1, ih=IMGS.hillsFar.naturalHeight||1;
      const dh=Math.min((W/iw)*ih, groundY*0.55);
      const dy=groundY-dh, off=(scrollX*0.15)%W;
      for(let i=-1;i<=2;i++) ctx.drawImage(IMGS.hillsFar, i*W-off, dy, W, dh);
      // fade top into sky by painting matching sky gradient over it
      const fadeH=dh*0.4;
      const fadeG=ctx.createLinearGradient(0,dy,0,dy+fadeH);
      fadeG.addColorStop(0,"rgba(4,8,15,1)");
      fadeG.addColorStop(0.6,"rgba(4,8,15,0.6)");
      fadeG.addColorStop(1,"rgba(4,8,15,0)");
      ctx.fillStyle=fadeG; ctx.fillRect(0,dy,W,fadeH);
    } else {
      const hB=groundY, hMH=groundY*0.40;
      ctx.fillStyle="#0a0e0a";
      ctx.beginPath(); ctx.moveTo(0,hB);
      for(const[rx,rh]of[[0,.3],[.08,.55],[.15,.35],[.25,.70],[.33,.45],[.42,.80],[.52,.50],[.62,.68],[.72,.38],[.82,.60],[.92,.35],[1,.48]])
        ctx.lineTo(rx*W,hB-rh*hMH);
      ctx.lineTo(W,hB); ctx.closePath(); ctx.fill();
      ctx.fillStyle="rgba(120,60,5,0.18)";
      ctx.beginPath(); ctx.moveTo(0,hB);
      for(const[rx,rh]of[[0,.3],[.08,.55],[.15,.35],[.25,.70],[.33,.45],[.42,.80],[.52,.50],[.62,.68],[.72,.38],[.82,.60],[.92,.35],[1,.48]])
        ctx.lineTo(rx*W,hB-rh*hMH);
      ctx.lineTo(W,hB); ctx.closePath(); ctx.fill();
    }

    // ── NEAR HILLS (65% scroll speed) ──
    if (IMGS.hillsNear) {
      const iw=IMGS.hillsNear.naturalWidth||1, ih=IMGS.hillsNear.naturalHeight||1;
      const dh=Math.min((W/iw)*ih, groundY*0.40);
      const dy=groundY-dh, off=(scrollX*0.65)%W;
      for(let i=-1;i<=2;i++) ctx.drawImage(IMGS.hillsNear, i*W-off, dy, W, dh);
      // stronger fade at top
      const fadeH=dh*0.5;
      const fadeG=ctx.createLinearGradient(0,dy,0,dy+fadeH);
      fadeG.addColorStop(0,"rgba(4,8,15,1)");
      fadeG.addColorStop(0.7,"rgba(4,8,15,0.5)");
      fadeG.addColorStop(1,"rgba(4,8,15,0)");
      ctx.fillStyle=fadeG; ctx.fillRect(0,dy,W,fadeH);
    } else {
      const hB=groundY, hMH=groundY*0.22;
      const off=(scrollX*0.65)%W;
      ctx.fillStyle="#060a06";
      for(const dx of [-off, W-off]) {
        ctx.save(); ctx.translate(dx,0); ctx.beginPath(); ctx.moveTo(0,hB);
        for(const[rx,rh]of[[0,.6],[.12,.9],[.22,.55],[.35,.95],[.48,.7],[.60,.88],[.72,.58],[.85,.80],[.95,.62],[1.05,.75]])
          ctx.lineTo(rx*W,hB-rh*hMH);
        ctx.lineTo(W,hB); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      // amber edge glow
      ctx.fillStyle="rgba(140,70,5,0.22)";
      for(const dx of [-off, W-off]) {
        ctx.save(); ctx.translate(dx,0); ctx.beginPath(); ctx.moveTo(0,hB);
        for(const[rx,rh]of[[0,.6],[.12,.9],[.22,.55],[.35,.95],[.48,.7],[.60,.88],[.72,.58],[.85,.80],[.95,.62],[1.05,.75]])
          ctx.lineTo(rx*W,hB-rh*hMH);
        ctx.lineTo(W,hB); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }

    // ── GROUND (100% scroll speed) ──
    if (IMGS.ground) {
      const iw=IMGS.ground.naturalWidth||1, ih=IMGS.ground.naturalHeight||1;
      const dh=Math.min((W/iw)*ih, BTN_ZONE_H*1.5);
      const off=scrollX%W;
      for(let i=-1;i<=2;i++) ctx.drawImage(IMGS.ground, i*W-off, groundY, W, dh);
      // fade very top of ground into scene
      const fadeH=Math.min(dh*0.25, 30);
      const fadeG=ctx.createLinearGradient(0,groundY,0,groundY+fadeH);
      fadeG.addColorStop(0,"rgba(4,8,15,0.9)");
      fadeG.addColorStop(1,"rgba(4,8,15,0)");
      ctx.fillStyle=fadeG; ctx.fillRect(0,groundY,W,fadeH);
    } else {
      // dark cracked stone ground fallback
      const gG=ctx.createLinearGradient(0,groundY,0,H);
      gG.addColorStop(0,"#1a1008"); gG.addColorStop(0.3,"#0e0a04"); gG.addColorStop(1,"#050302");
      ctx.fillStyle=gG; ctx.fillRect(0,groundY,W,BTN_ZONE_H);
      // amber edge line
      ctx.fillStyle="rgba(160,80,10,0.5)"; ctx.fillRect(0,groundY,W,2);
    }

    // button zone dark overlay
    const btnG=ctx.createLinearGradient(0,groundY,0,H);
    btnG.addColorStop(0,"rgba(0,0,0,0.4)"); btnG.addColorStop(1,"rgba(0,0,0,0.7)");
    ctx.fillStyle=btnG; ctx.fillRect(0,groundY,W,BTN_ZONE_H);

    // ── PILLARS ──
    for (const p of pillars) {
      const botY = p.topH + p.gap;
      const botH = H - botY;
      if (IMGS.pillar) {
        const iw = IMGS.pillar.naturalWidth  || 199;
        const ih = IMGS.pillar.naturalHeight || 751;

        // top pillar: draw full image flipped vertically, filling 0..p.topH exactly
        if (p.topH > 0) {
          ctx.save();
          ctx.beginPath(); ctx.rect(p.x, 0, PILLAR_W, p.topH); ctx.clip();
          ctx.translate(p.x, p.topH);
          ctx.scale(1, -1);
          ctx.drawImage(IMGS.pillar, 0, 0, iw, ih, 0, 0, PILLAR_W, p.topH);
          ctx.restore();
        }

        // bottom pillar: draw full image normally, filling botY..H exactly
        if (botH > 0) {
          ctx.save();
          ctx.beginPath(); ctx.rect(p.x, botY, PILLAR_W, botH); ctx.clip();
          ctx.drawImage(IMGS.pillar, 0, 0, iw, ih, p.x, botY, PILLAR_W, botH);
          ctx.restore();
        }
      } else {
        // dark stone pillar fallback
        const pb=(px,py,ph)=>{
          if(ph<=0)return;
          const pg=ctx.createLinearGradient(px,0,px+PILLAR_W,0);
          pg.addColorStop(0,"#1a1208"); pg.addColorStop(0.3,"#2e2010"); pg.addColorStop(0.7,"#221808"); pg.addColorStop(1,"#120e04");
          ctx.fillStyle=pg; rr(ctx,px,py,PILLAR_W,ph,3); ctx.fill();
          // amber rim light
          ctx.fillStyle="rgba(180,90,10,0.15)"; ctx.fillRect(px,py,3,ph);
          ctx.fillStyle="rgba(180,90,10,0.08)"; ctx.fillRect(px+PILLAR_W-3,py,3,ph);
        };
        const pc=(px,py)=>{
          ctx.fillStyle="#0e0a04"; rr(ctx,px-6,py,PILLAR_W+12,16,4); ctx.fill();
          ctx.fillStyle="rgba(160,80,10,0.4)"; ctx.fillRect(px-6,py,PILLAR_W+12,2);
        };
        pb(p.x,0,p.topH); pc(p.x,p.topH-16);
        if(botH>0){pb(p.x,botY,botH);pc(p.x,botY);}
      }
    }

    // ── DEBUG HITBOXES ──
    const DEBUG_HIT = true;
    if (DEBUG_HIT) {
      for (const p of pillars) {
        const hitX = p.x + (PILLAR_W - PILLAR_HIT) / 2;
        // orange = full drawn pillar area
        ctx.strokeStyle="rgba(255,140,0,0.9)"; ctx.lineWidth=2;
        ctx.strokeRect(p.x, 0, PILLAR_W, p.topH);
        ctx.strokeRect(p.x, p.topH+p.gap, PILLAR_W, H-(p.topH+p.gap));
        // red = collision hitbox
        ctx.strokeStyle="rgba(255,0,0,0.9)"; ctx.lineWidth=2;
        ctx.strokeRect(hitX, 0, PILLAR_HIT, p.topH);
        ctx.strokeRect(hitX, p.topH+p.gap, PILLAR_HIT, H-(p.topH+p.gap));
        // green = safe gap
        ctx.strokeStyle="rgba(0,255,0,0.7)"; ctx.lineWidth=1;
        ctx.strokeRect(hitX, p.topH, PILLAR_HIT, p.gap);
      }
      // yellow = player
      ctx.strokeStyle="rgba(255,255,0,0.9)"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(ply.x, ply.y, 10, 0, Math.PI*2); ctx.stroke();
    }

    // ── PARTICLES ──
    for(const p of particles){ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=`hsl(${p.hue},80%,65%)`;ctx.beginPath();ctx.arc(p.x,p.y,p.r*p.life,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;

    // ── PLAYER ──
    if (!ply.dead) {
      const {x,y,vy}=ply;
      const tilt=Math.max(-0.38,Math.min(0.38,vy*0.040));
      if (IMGS.player) {
        const pw=88, ph=pw*(IMGS.player.naturalHeight/IMGS.player.naturalWidth||0.6);
        ctx.save();
        ctx.translate(x,y);
        ctx.rotate(tilt);
        ctx.translate(0,Math.sin(f*0.13)*2);
        // draw so rider body (at ~65% from left) aligns with logical center x
        ctx.drawImage(IMGS.player, -pw*0.65, -ph*0.5, pw, ph);
        ctx.restore();
      } else {
        ctx.save(); ctx.translate(x,y); ctx.rotate(tilt);
        const wa=Math.sin(f*0.13)*0.09;
        for(const side of[-1,1]){ctx.save();ctx.rotate(side*wa);ctx.fillStyle="#e8c060cc";ctx.beginPath();ctx.moveTo(0,2);ctx.lineTo(side*-44,-7);ctx.lineTo(side*-36,13);ctx.closePath();ctx.fill();ctx.strokeStyle="#c09030";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,2);ctx.lineTo(side*-44,-7);ctx.stroke();ctx.restore();}
        ctx.fillStyle="#c07030"; ctx.beginPath(); ctx.moveTo(-14,3); ctx.lineTo(-28,-10); ctx.lineTo(-8,8); ctx.closePath(); ctx.fill();
        ctx.strokeStyle="#ffe080"; ctx.lineWidth=3; ctx.lineCap="round";
        ctx.beginPath(); ctx.moveTo(-2,2); ctx.quadraticCurveTo(-14,-1+Math.sin(f*0.17)*5,-30,4+Math.sin(f*0.17)*2); ctx.stroke();
        ctx.fillStyle="#d4a040"; ctx.beginPath(); ctx.ellipse(0,4,12,7,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#f0d090"; ctx.beginPath(); ctx.arc(9,-4,8,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#8b4513"; ctx.beginPath(); ctx.arc(9,-4,8.5,Math.PI,0); ctx.fill();
        ctx.fillStyle="#6b2500"; ctx.beginPath(); ctx.ellipse(9,-4,8.5,3,0,Math.PI,0); ctx.fill();
        ctx.fillStyle="#aaddffcc"; ctx.beginPath(); ctx.ellipse(13,-3,4,3,0.25,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }
    }
  }

  // ── game loop ────────────────────────────────────────────────
  function startGame() {
    const canvas=canvasRef.current; if(!canvas) return;
    if(rafRef.current) cancelAnimationFrame(rafRef.current);
    const pr=Math.min(window.devicePixelRatio||1,2), W=canvas.offsetWidth, H=canvas.offsetHeight;
    canvas.width=W*pr; canvas.height=H*pr;
    const ctx=canvas.getContext("2d"); ctx.scale(pr,pr);
    const g=newGame(W,H); gRef.current=g;
    logSession();
    // start loop immediately — images preloaded at module load so always ready
    // but guard draw in case somehow not yet loaded
    function loop(){
      update(g);
      if(imgsLoaded) draw(ctx,g);
      rafRef.current=requestAnimationFrame(loop);
    }
    // ensure images are loaded before first frame
    if(imgsLoaded){
      rafRef.current=requestAnimationFrame(loop);
    } else {
      loadImages(()=>{ rafRef.current=requestAnimationFrame(loop); });
    }
  }

  function handlePlay() {
    // attempt music start — this is inside a direct user gesture so iOS allows it
    if (audioRef.current) audioRef.current.play().catch(()=>{});
    setDispScore(0); setScreen("intro");
    requestAnimationFrame(startGame);
    setTimeout(() => {
      if(gRef.current) gRef.current.state="countdown";
      setCountdown(3); countdownRef.current=3; playSfx("countdown");
      setTimeout(()=>{ setCountdown(2); countdownRef.current=2; playSfx("countdown"); },1000);
      setTimeout(()=>{ setCountdown(1); countdownRef.current=1; playSfx("countdown"); },2000);
      setTimeout(()=>{
        setCountdown(null); countdownRef.current=null;
        if(gRef.current) gRef.current.state="playing";
        setScreen("playing");
      },3000);
    }, 800);
  }

  useEffect(()=>()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);},[]);

  // ── sub-components ───────────────────────────────────────────
  function MuteBtn({top=16,right=16}) {
    return <button onClick={toggleMute}
      style={{position:"absolute",top,right,zIndex:50,background:"#ffffff18",border:"1px solid #ffffff33",borderRadius:50,width:38,height:38,fontSize:18,cursor:"pointer",WebkitTapHighlightColor:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
      {muted?"🔇":"🔊"}
    </button>;
  }

  function TopBoard() {
    return (
      <div style={{width:"100%",maxWidth:320,margin:"0 auto 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:13,color:"#ffd700",fontWeight:700,letterSpacing:1}}>🏆 TOP SCORES</span>
          <button onClick={openAllScores} style={{background:"none",border:"1px solid #ffffff33",borderRadius:20,color:"#88ccff",fontSize:11,padding:"4px 12px",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>View All →</button>
        </div>
        {topScores.length===0
          ? <div style={{textAlign:"center",color:"#ffffff44",fontSize:12,padding:"12px 0"}}>No scores yet — be the first!</div>
          : topScores.map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:i===0?"#ffffff14":"#ffffff08",borderRadius:8,padding:"8px 14px",marginBottom:5,border:i===0?"1px solid #ffd70033":"1px solid #ffffff0a"}}>
              <span style={{fontSize:16,width:28}}>{MEDALS[i]||`${i+1}.`}</span>
              <span style={{flex:1,color:"#e0e0e0",fontSize:14,fontWeight:600}}>{s.name}</span>
              <span style={{color:"#ffd700",fontSize:16,fontWeight:900}}>{s.score}</span>
            </div>
          ))
        }
        {offlineQueue > 0 && (
          <div style={{fontSize:11,color:"#ffaa44",textAlign:"center",marginTop:6,padding:"4px 8px",background:"#ffaa4411",borderRadius:6}}>
            📴 {offlineQueue} score{offlineQueue>1?"s":""} queued — will sync when online
          </div>
        )}
      </div>
    );
  }

  function AllScoresModal() {
    return (
      <div style={{position:"absolute",inset:0,background:"#000000ee",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",zIndex:300,overflowY:"auto",fontFamily:ff,padding:"20px 0 40px"}}>
        <div style={{width:"100%",maxWidth:420,padding:"0 16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,paddingTop:10}}>
            <h2 style={{color:"#ffd700",fontSize:22,fontWeight:900,margin:0}}>🏆 Global Leaderboard</h2>
            <button onClick={()=>setShowAll(false)} style={{background:"#ffffff22",border:"none",borderRadius:50,color:"#fff",fontSize:18,width:36,height:36,cursor:"pointer"}}>✕</button>
          </div>
          {loadingBoard ? <div style={{textAlign:"center",color:"#88ccff",padding:40}}>Loading…</div>
          : allScores.length===0 ? <div style={{textAlign:"center",color:"#ffffff44",padding:40}}>No scores yet!</div>
          : allScores.map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:i<3?"#ffffff12":"#ffffff07",borderRadius:10,padding:"10px 16px",marginBottom:6,border:i===0?"1px solid #ffd70044":i<3?"1px solid #ffffff18":"1px solid #ffffff08"}}>
              <span style={{fontSize:i<3?18:15,width:32,color:i===0?"#ffd700":i===1?"#c0c0c0":i===2?"#cd7f32":"#888"}}>{MEDALS[i]||`${i+1}`}</span>
              <span style={{flex:1,color:"#e8e8e8",fontSize:15,fontWeight:i<3?700:400}}>{s.name}</span>
              <span style={{color:i===0?"#ffd700":i<3?"#88ccff":"#aaa",fontSize:16,fontWeight:700}}>{s.score}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function InterstitialClose({onClose}) {
    const [secs,setSecs]=useState(5);
    useEffect(()=>{ if(secs<=0)return; const t=setTimeout(()=>setSecs(s=>s-1),1000); return()=>clearTimeout(t); },[secs]);
    return <button onClick={secs<=0?onClose:undefined}
      style={{marginTop:16,padding:"12px 32px",borderRadius:50,border:"none",background:secs<=0?"linear-gradient(135deg,#00aaff,#0044ff)":"#ffffff22",color:secs<=0?"#fff":"#ffffff88",fontSize:16,fontWeight:700,cursor:secs<=0?"pointer":"default",fontFamily:ff,boxShadow:secs<=0?"0 4px 0 #002e99,0 0 30px #0af6":"none",WebkitTapHighlightColor:"transparent"}}>
      {secs>0?`Skip in ${secs}s…`:"Continue →"}
    </button>;
  }

  function AdminDashboard() {
    const s=adminStats;
    if(loadingStats) return <div style={{position:"absolute",inset:0,background:"#050e1a",display:"flex",alignItems:"center",justifyContent:"center",color:"#88ccff",fontSize:18,fontFamily:ff}}>Loading stats…</div>;
    if(!s) return (
      <div style={{position:"absolute",inset:0,background:"#050e1a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:ff,gap:16,padding:24}}>
        <div style={{fontSize:14,color:"#ff8888",textAlign:"center"}}>Stats failed to load.</div>
        <button onClick={()=>loadAdminStats()} style={{background:"#0066cc",border:"none",borderRadius:10,color:"#fff",fontSize:14,padding:"10px 24px",cursor:"pointer",fontFamily:ff}}>↻ Retry</button>
        <button onClick={goMenu} style={{background:"#ffffff18",border:"1px solid #ffffff33",borderRadius:10,color:"#ff8888",fontSize:13,padding:"8px 20px",cursor:"pointer",fontFamily:ff}}>✕ Exit</button>
      </div>
    );
    const maxDay=Math.max(...s.playsPerDay.map(d=>d.count),1);
    const maxC=Math.max(...s.topCountries.map(c=>c.count),1);
    return (
      <div style={{position:"absolute",inset:0,background:"#050e1a",overflowY:"auto",fontFamily:ff,padding:"20px 16px 40px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <img src={LOGO_SRC} alt="Salt Wolf Games" style={{width:36,height:"auto"}}/>
            <div>
              <div style={{fontSize:11,color:"#cc4444",letterSpacing:3,textTransform:"uppercase",marginBottom:2}}>🔐 Admin</div>
              <div style={{color:"#fff",fontSize:16,fontWeight:900}}>Salt Wolf Games</div>
              <div style={{fontSize:12,color:"#88aacc"}}>Glider Guy — Statistics</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>loadAdminStats()} style={{background:"#ffffff18",border:"1px solid #ffffff33",borderRadius:8,color:"#88ccff",fontSize:12,padding:"8px 12px",cursor:"pointer"}}>↻</button>
            <button onClick={goMenu} style={{background:"#ffffff18",border:"1px solid #ffffff33",borderRadius:8,color:"#ff8888",fontSize:12,padding:"8px 12px",cursor:"pointer"}}>✕</button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
          {[["Total Plays",s.totalPlays,"#00aaff"],["Unique Players",s.uniqueUsers,"#00ff88"],["Scores Submitted",s.totalScores,"#ffd700"],["Avg Score",s.avgScore,"#ff88aa"],["Top Score",s.maxScore,"#ff6600"],["Countries",s.topCountries.length,"#aa88ff"]].map(([label,value,color],i)=>(
            <div key={i} style={{background:"#0d1e2e",border:"1px solid #1a3040",borderRadius:12,padding:"14px 16px"}}>
              <div style={{fontSize:11,color:"#6080a0",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{label}</div>
              <div style={{fontSize:32,fontWeight:900,color}}>{(value||0).toLocaleString()}</div>
            </div>
          ))}
        </div>
        <div style={{background:"#0d1e2e",border:"1px solid #1a3040",borderRadius:12,padding:"16px",marginBottom:16}}>
          <div style={{fontSize:13,color:"#88aacc",fontWeight:700,marginBottom:12}}>📈 Plays — Last 30 Days</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:2,height:80}}>
            {s.playsPerDay.map((d,i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
              <div style={{width:"100%",height:Math.round((d.count/maxDay)*76)+4,background:"linear-gradient(180deg,#00aaff,#0044ff)",borderRadius:"2px 2px 0 0",opacity:d.count?1:0.15}}/>
            </div>)}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:9,color:"#4a6a8a"}}>
            <span>{s.playsPerDay[0]?.date?.slice(5)}</span><span>Today</span>
          </div>
        </div>
        <div style={{background:"#0d1e2e",border:"1px solid #1a3040",borderRadius:12,padding:"16px",marginBottom:16}}>
          <div style={{fontSize:13,color:"#88aacc",fontWeight:700,marginBottom:12}}>🌍 Top Countries</div>
          {s.topCountries.map((c,i)=>(
            <div key={i} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#ccc",marginBottom:3}}><span>{c.country}</span><span style={{color:"#88ccff"}}>{c.count}</span></div>
              <div style={{height:6,background:"#1a3040",borderRadius:3}}><div style={{height:6,width:`${(c.count/maxC)*100}%`,background:`hsl(${200+i*18},80%,55%)`,borderRadius:3}}/></div>
            </div>
          ))}
        </div>
        <div style={{background:"#0d1e2e",border:"1px solid #1a3040",borderRadius:12,padding:"16px"}}>
          <div style={{fontSize:13,color:"#88aacc",fontWeight:700,marginBottom:12}}>⏱ Recent Submissions</div>
          {s.recentScores.map((sc,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:i<s.recentScores.length-1?"1px solid #1a3040":"none"}}>
              <span style={{color:"#ccc",fontSize:14}}>{sc.name}</span>
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <span style={{color:"#ffd700",fontWeight:700}}>{sc.score}</span>
                <span style={{color:"#4a6a8a",fontSize:11}}>{sc.created_at?.slice(0,10)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isPlaying = screen==="playing" || screen==="intro" || screen==="countdown";

  // ── RENDER ───────────────────────────────────────────────────
  return (
    <div style={{width:"100vw",height:"100dvh",background:"#040c14",position:"relative",userSelect:"none",WebkitUserSelect:"none",fontFamily:ff,overflow:"hidden",paddingTop:"env(safe-area-inset-top)",paddingBottom:"env(safe-area-inset-bottom)",boxSizing:"border-box"}}>
      <audio ref={audioRef} loop preload="auto">
        <source src="/dark-ambience.ogg" type="audio/ogg"/>
        <source src="/dark-ambience.mp3" type="audio/mpeg"/>
      </audio>

      {/* canvas — only interactive during play, never intercepts menu taps */}
      <canvas ref={canvasRef}
        style={{position:"absolute",inset:0,width:"100%",height:"100%",display:"block",touchAction:"none",
          pointerEvents: isPlaying ? "none" : "none"}}/>

      {/* ── live score ── */}
      {isPlaying && (
        <div style={{position:"absolute",top:18,left:"50%",transform:"translateX(-50%)",fontSize:48,fontWeight:900,color:"#fff",textShadow:"0 3px 0 #0008,0 0 22px #4afb",pointerEvents:"none",zIndex:10}}>
          {dispScore}
        </div>
      )}

      {/* ── in-game controls ── */}
      {isPlaying && (
        <>
          <MuteBtn top={16} right={16}/>
          <button onClick={goMenu}
            style={{position:"absolute",top:16,left:16,zIndex:50,background:"#ffffff18",border:"1px solid #ffffff33",borderRadius:50,width:38,height:38,fontSize:16,cursor:"pointer",WebkitTapHighlightColor:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>🏠</button>
        </>
      )}

      {/* ── TWO BOTTOM BUTTONS ── */}
      {isPlaying && (
        <div style={{
          position:"absolute", bottom:0, left:0, right:0,
          height:BTN_ZONE_H,
          display:"flex", alignItems:"center", justifyContent:"center",
          gap:24, padding:"0 32px",
          zIndex:20,
        }}>
          {/* BOOST — round gothic button */}
          <button
            onPointerDown={e=>{ e.preventDefault(); boost(); }}
            style={{
              width:80, height:80,
              borderRadius:"50%",
              background:"radial-gradient(circle at 40% 35%, #5a3a1a, #1a0e04)",
              border:"2px solid rgba(180,100,20,0.6)",
              color:"rgba(220,160,60,0.95)",
              fontSize:13, fontWeight:700,
              fontFamily:ff,
              cursor:"pointer",
              boxShadow:"0 0 18px rgba(160,80,10,0.5), inset 0 1px 0 rgba(255,180,60,0.2), 0 4px 0 #0a0500",
              WebkitTapHighlightColor:"transparent",
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
              touchAction:"none", gap:2, letterSpacing:1,
            }}>
            <span style={{fontSize:20}}>💨</span>
            FLY
          </button>

          {/* DISABLED — round gothic button */}
          <button
            disabled
            style={{
              width:80, height:80,
              borderRadius:"50%",
              background:"radial-gradient(circle at 40% 35%, #1a1a1a, #0a0a0a)",
              border:"2px dashed rgba(100,80,50,0.35)",
              color:"rgba(120,100,60,0.4)",
              fontSize:13, fontWeight:600,
              fontFamily:ff,
              cursor:"not-allowed",
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
              touchAction:"none", gap:2, letterSpacing:1,
            }}>
            <span style={{fontSize:20}}>🔒</span>
            SOON
          </button>
        </div>
      )}

      {/* ── MENU ── */}
      {screen==="menu" && (
        <div style={{position:"absolute",inset:0,background:"linear-gradient(160deg,#091830,#05101c)",overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",minHeight:"100%",padding:"max(60px, env(safe-area-inset-top)) 20px 40px",boxSizing:"border-box"}}>
            <MuteBtn/>
            <div onClick={handleBrandTap} style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:28,cursor:"default",WebkitTapHighlightColor:"transparent"}}>
              <img src={LOGO_SRC} alt="Salt Wolf Games" style={{width:126,height:"auto",display:"block"}}/>
              <div style={{fontSize:9,color:"#ffffff44",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>presents</div>
            </div>
            <div style={{fontSize:58,lineHeight:1,marginBottom:6}}>🪂</div>
            <h1 style={{fontSize:40,fontWeight:900,color:"#fff",margin:"0 0 28px",textShadow:"0 0 30px #4af,0 4px 0 #0af5",letterSpacing:2}}>GLIDER GUY</h1>
            <div style={{width:"100%",marginBottom:24}}><TopBoard/></div>
            <div style={{display:"flex",flexDirection:"column",gap:12,width:"100%",maxWidth:280,alignItems:"center"}}>
              <button onClick={handlePlay} style={btnStyle("#00aaff","#0044ff","#002e99")}>FLY! 🚀</button>
              <button onClick={()=>setScreen("howto")} style={{...btnStyle("#6644cc","#4422aa","#2a1166"),padding:"14px 48px",fontSize:16}}>📖 How to Play</button>
              {!adFree && (
                <button onClick={handleBuyAdFree} style={{background:"none",border:"1.5px solid #ffd70066",borderRadius:50,color:"#ffd700",fontSize:14,padding:"12px 28px",cursor:"pointer",WebkitTapHighlightColor:"transparent",fontFamily:ff,minWidth:200}}>
                  {buyingAdFree?"Checking purchase…":"✨ Remove Ads — €1.99"}
                </button>
              )}
              {adFree && <div style={{fontSize:12,color:"#4dffb4"}}>✅ Ad-Free — Thank you! 🙏</div>}
              <p style={{fontSize:11,color:"#ffffff28",textAlign:"center",maxWidth:240,lineHeight:2}}>Gaps shrink · Speed increases · Good luck!</p>
            </div>
            {!adFree && (
              <div style={{width:"100%",maxWidth:320,marginTop:20,minHeight:60}}>
                <ins ref={bannerRef} className="adsbygoogle" style={{display:"block",width:"100%"}} data-ad-client={PUB_ID} data-ad-slot={AD_SLOT} data-ad-format="auto" data-full-width-responsive="true"/>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HOW TO PLAY ── */}
      {screen==="howto" && (
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",overflowY:"auto",background:"linear-gradient(160deg,#091830f5,#05101cf5)",padding:"32px 20px 40px",zIndex:10}}>
          <MuteBtn/>
          <div style={{fontSize:52,lineHeight:1,marginBottom:8}}>📖</div>
          <h2 style={{fontSize:32,fontWeight:900,color:"#fff",margin:"0 0 20px",textShadow:"0 0 20px #4af",letterSpacing:2}}>HOW TO PLAY</h2>
          {[
            {icon:"🪂",title:"You are Glider Guy",desc:"You launch off a snowy mountain and glide forward automatically. You can't stop — only survive!"},
            {icon:"💨",title:"BOOST keeps you up",desc:"Tap the BOOST button at the bottom to push your glider upward. Gravity pulls you down constantly — keep tapping to stay airborne!"},
            {icon:"🟩",title:"Fly Through the Gaps",desc:"Green pillars scroll toward you. Fly through the gap in each pillar to score a point. Miss and it's game over!"},
            {icon:"⚡",title:"It Gets Faster",desc:"Every pillar you pass makes you go faster and shrinks the gaps. How long can you survive?"},
          ].map(({icon,title,desc},i)=>(
            <div key={i} style={{width:"100%",maxWidth:340,background:"#ffffff0a",border:"1px solid #ffffff18",borderRadius:14,padding:"14px 18px",marginBottom:12,display:"flex",gap:14,alignItems:"flex-start"}}>
              <span style={{fontSize:28,lineHeight:1,flexShrink:0,marginTop:2}}>{icon}</span>
              <div>
                <div style={{color:"#88ffaa",fontWeight:700,fontSize:14,marginBottom:4}}>{title}</div>
                <div style={{color:"#b0cce0",fontSize:13,lineHeight:1.6}}>{desc}</div>
              </div>
            </div>
          ))}
          <div style={{marginTop:8,display:"flex",gap:12,flexDirection:"column",width:"100%",maxWidth:280,alignItems:"center"}}>
            <button onClick={handlePlay} style={btnStyle("#00aaff","#0044ff","#002e99")}>LET'S FLY! 🚀</button>
            <button onClick={()=>setScreen("menu")} style={{background:"none",border:"1px solid #ffffff33",borderRadius:50,color:"#88ccff",fontSize:15,padding:"10px 32px",cursor:"pointer",WebkitTapHighlightColor:"transparent",fontFamily:ff}}>← Back</button>
          </div>
        </div>
      )}

      {/* ── DEAD ── */}
      {screen==="dead" && (
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",overflowY:"auto",background:"linear-gradient(160deg,#091830ee,#05101cee)",padding:"max(28px, env(safe-area-inset-top)) 20px 40px"}}>
          <MuteBtn/>
          <div style={{background:"#ffffff0c",border:"1.5px solid #ffffff18",borderRadius:16,padding:"16px 52px",marginBottom:20,textAlign:"center"}}>
            <div style={{fontSize:11,color:"#6080a0",letterSpacing:3,textTransform:"uppercase"}}>Your Score</div>
            <div style={{fontSize:52,color:"#ffd700",fontWeight:900,lineHeight:1.1}}>{dispScore}</div>
            <div style={{fontSize:13,color:"#4dffb4",marginTop:3}}>
              {dispScore>0&&dispScore>=dispBest?"🏆 New Personal Best!":dispBest>0?`Your Best: ${dispBest}`:""}
            </div>
          </div>
          <TopBoard/>
          <div style={{display:"flex",flexDirection:"column",gap:10,width:"100%",maxWidth:280,alignItems:"center"}}>
            <button onClick={handlePlay} style={btnStyle("#00aaff","#0044ff","#002e99")}>FLY AGAIN! 🚀</button>
            <button onClick={goMenu} style={{...btnStyle("#445566","#2a3a4a","#1a2030"),padding:"12px 48px",fontSize:16}}>🏠 Main Menu</button>
            {!adFree && (
              <button onClick={handleBuyAdFree} style={{background:"none",border:"1.5px solid #ffd70066",borderRadius:50,color:"#ffd700",fontSize:13,padding:"8px 24px",cursor:"pointer",WebkitTapHighlightColor:"transparent",fontFamily:ff}}>
                {buyingAdFree?"Checking purchase…":"✨ Remove Ads — €1.99"}
              </button>
            )}
            {adFree && <div style={{fontSize:12,color:"#4dffb4"}}>✅ Ad-Free — Thank you!</div>}
          </div>
          {!adFree && (
            <div style={{width:"100%",maxWidth:320,marginTop:16,minHeight:60}}>
              <ins className="adsbygoogle" style={{display:"block",width:"100%"}} data-ad-client={PUB_ID} data-ad-slot={AD_SLOT} data-ad-format="auto" data-full-width-responsive="true"/>
            </div>
          )}
        </div>
      )}

      {/* ── ADMIN ── */}
      {screen==="admin" && <AdminDashboard/>}

      {/* ── INTERSTITIAL ── */}
      {showInterstitial && (
        <div style={{position:"absolute",inset:0,background:"#000000f0",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:150,fontFamily:ff}}>
          <div style={{fontSize:12,color:"#ffffff55",marginBottom:12,letterSpacing:2,textTransform:"uppercase"}}>Advertisement</div>
          <div style={{width:"100%",maxWidth:340,minHeight:250,display:"flex",alignItems:"center",justifyContent:"center",background:"#0d1e2e",borderRadius:12,overflow:"hidden"}}>
            <ins className="adsbygoogle" style={{display:"block",width:"100%",minHeight:250}} data-ad-client={PUB_ID} data-ad-slot={AD_SLOT} data-ad-format="rectangle" data-full-width-responsive="true"/>
          </div>
          <InterstitialClose onClose={()=>{setShowInterstitial(false);setScreen("dead");}}/>
        </div>
      )}

      {/* ── ALL SCORES ── */}
      {showAll && <AllScoresModal/>}

      {/* ── COUNTDOWN ── */}
      {countdown!==null && (
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",zIndex:80}}>
          <div key={countdown} style={{fontSize:160,fontWeight:900,color:"#fff",textShadow:`0 0 60px ${countdown===3?"#ff4444":countdown===2?"#ffaa00":"#00ff88"},0 6px 0 #0006`,animation:"countPop 0.9s ease-out forwards",lineHeight:1}}>
            {countdown}
          </div>
          <style>{`@keyframes countPop{0%{transform:scale(1.8);opacity:0}20%{transform:scale(1);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(0.6);opacity:0}}`}</style>
        </div>
      )}

      {/* ── ADMIN PROMPT ── */}
      {showAdminPrompt && (
        <div style={{position:"absolute",inset:0,background:"#000000cc",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,fontFamily:ff}}>
          <div style={{background:"#0d1e2e",border:"1px solid #1a3a5a",borderRadius:16,padding:"28px 24px",width:"calc(100% - 48px)",maxWidth:300,textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:8}}>🔐</div>
            <div style={{fontSize:16,fontWeight:700,color:"#fff",marginBottom:4}}>Admin Access</div>
            <div style={{fontSize:12,color:"#6080a0",marginBottom:20}}>Enter password to continue</div>
            <input type="password" placeholder="Password" value={adminPw}
              onChange={e=>{setAdminPw(e.target.value);setAdminError("");}}
              onKeyDown={e=>e.key==="Enter"&&handleAdminLogin()}
              autoFocus
              style={{width:"100%",padding:"12px 16px",borderRadius:10,border:"1.5px solid #1a3a5a",background:"#ffffff0e",color:"#fff",fontSize:16,outline:"none",marginBottom:10,boxSizing:"border-box",fontFamily:ff,textAlign:"center",letterSpacing:4}}/>
            {adminError && <div style={{fontSize:12,color:"#ff6666",marginBottom:10}}>{adminError}</div>}
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setShowAdminPrompt(false)} style={{flex:1,padding:"12px",background:"#ffffff10",border:"1px solid #ffffff22",borderRadius:10,color:"#aaa",fontSize:14,cursor:"pointer",fontFamily:ff}}>Cancel</button>
              <button onClick={handleAdminLogin} disabled={!adminPw.trim()||adminChecking}
                style={{flex:1,padding:"12px",background:"linear-gradient(135deg,#0066cc,#0033aa)",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",opacity:adminPw.trim()?1:0.5,fontFamily:ff}}>
                {adminChecking?"…":"Enter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NAME ENTRY MODAL — last element, highest z-index ── */}
      {screen==="dead" && isTopScore && !submitted && (
        <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundColor:"rgba(0,0,0,0.93)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:"24px"}}>
          <div style={{background:"linear-gradient(160deg,#0d1e38,#091428)",border:"1.5px solid rgba(255,215,0,0.3)",borderRadius:20,padding:"32px 24px",width:"100%",maxWidth:340,textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:10}}>🎉</div>
            <div style={{fontSize:22,fontWeight:900,color:"#ffd700",marginBottom:8}}>Top 50!</div>
            <div style={{fontSize:14,color:"#88ccff",marginBottom:24,lineHeight:1.7}}>You made the global top 50!<br/>Enter your name for the leaderboard.</div>
            <input type="text" placeholder="Your name / nickname" value={nameInput}
              onChange={e=>setNameInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} maxLength={20} autoFocus
              style={{width:"100%",padding:"14px 16px",borderRadius:10,border:"1.5px solid rgba(255,215,0,0.4)",background:"rgba(255,215,0,0.06)",color:"#fff",fontSize:16,outline:"none",marginBottom:14,boxSizing:"border-box",fontFamily:ff}}/>
            <button onClick={handleSubmit} disabled={!nameInput.trim()||submitting}
              style={{width:"100%",padding:"15px",borderRadius:50,border:"none",background:nameInput.trim()?"linear-gradient(135deg,#00cc88,#008855)":"#1a3a2a",color:nameInput.trim()?"#fff":"#ffffff55",fontSize:17,fontWeight:900,cursor:nameInput.trim()?"pointer":"default",fontFamily:ff,marginBottom:14,boxShadow:nameInput.trim()?"0 4px 0 #005533,0 0 30px #00cc8866":"none"}}>
              {submitting?"Submitting…":"Save My Name 🏆"}
            </button>
            <button onClick={async()=>{
              const anonName=`anonymous${getSessionId().slice(-4)}`;
              setSubmitting(true);
              await submitScore(anonName, scoreRef.current);
              setSubmitting(false); setSubmitted(true); refreshTop();
              setOfflineQueue(loadQueue().length);
            }}
              style={{width:"100%",padding:"13px",borderRadius:50,border:"1.5px solid rgba(255,255,255,0.4)",background:"rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.85)",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:ff,WebkitTapHighlightColor:"transparent"}}>
              {submitting?"Submitting…":"Skip — list me as Anonymous"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

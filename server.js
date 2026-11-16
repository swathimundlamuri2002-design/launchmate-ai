import express from "express";
import { chat } from "./agent.js";
import { getSite } from "./site.js";
import { sendContact } from "./contact.js";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));
app.use(express.static("public"));

function makeLimiter(max) {
  const hits = new Map();
  return ip => {
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter(t => now - t < 600000);
    recent.push(now);
    hits.set(ip, recent);
    return recent.length > max;
  };
}
const chatLimited = makeLimiter(20);
const contactLimited = makeLimiter(5);

// Conversations live on the server (with tool results), so the browser cannot forge earlier turns.
const sessions = new Map();
const MAX_SESSIONS = 200;
const MAX_MESSAGES = 40;

function getSession(id) {
  let s = sessions.get(id);
  if (!s) {
    s = { messages: [], busy: false };
    sessions.set(id, s);
    if (sessions.size > MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
  }
  return s;
}

app.post("/api/chat", async (req, res) => {
  if (chatLimited(req.ip)) return res.status(429).json({ error: "Too many requests. Please wait a few minutes." });
  const { sessionId, message } = req.body || {};
  if (typeof sessionId !== "string" || !/^[a-zA-Z0-9-]{8,64}$/.test(sessionId) ||
      typeof message !== "string" || !message.trim() || message.length > 500) {
    return res.status(400).json({ error: "Invalid request" });
  }
  const s = getSession(sessionId);
  if (s.busy) return res.status(429).json({ error: "Please wait for the previous reply." });
  if (s.messages.length >= MAX_MESSAGES) {
    return res.status(400).json({ error: "This conversation is too long. Please refresh the page to start a new one." });
  }
  s.busy = true;
  const before = s.messages.length;
  s.messages.push({ role: "user", content: message.trim() });
  try {
    const { reply, siteIds } = await chat(s.messages);
    if (s.messages[s.messages.length - 1].role === "user") s.messages.length = before;
    res.json({ reply, siteIds });
  } catch (e) {
    s.messages.length = before;
    console.error("chat error:", e?.status || "", e?.message?.slice(0, 200));
    res.status(500).json({ error: "Something went wrong. Please try again." });
  } finally {
    s.busy = false;
  }
});

app.post("/api/contact", async (req, res) => {
  if (contactLimited(req.ip)) return res.status(429).json({ error: "Too many messages. Please try again later." });
  const r = await sendContact(req.body);
  if (r.ok) return res.json({ ok: true });
  res.status(r.status).json({ error: r.error });
});

app.get("/site/:id", (req, res) => {
  const html = getSite(req.params.id);
  if (!html) return res.status(404).send("Preview not found or expired.");
  res.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
  res.type("html").send(html);
});

app.get("/health", (req, res) => res.json({
  status: "ok",
  claudeKey: !!process.env.ANTHROPIC_API_KEY,
  gddyPat: !!process.env.GDDY_PAT,
  mailConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Listening on " + port));

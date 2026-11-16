import crypto from "node:crypto";

const store = new Map();
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (s, n) => String(s ?? "").slice(0, n);

function render(d) {
  const items = d.products.map(p => `<li><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p></li>`).join("");
  return `<!doctype html>
<html lang="${d.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.name)}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 0; color: #1a1a1a; background: #fffaf2; line-height: 1.6; }
  header { background: #7a2e0e; color: #fff; padding: 32px 16px; text-align: center; }
  header h1 { margin: 0 0 8px; font-size: 2rem; }
  main { max-width: 760px; margin: 0 auto; padding: 16px; }
  ul { list-style: none; padding: 0; display: grid; gap: 12px; }
  li { background: #fff; border: 1px solid #d9c9b6; border-radius: 8px; padding: 12px 16px; }
  h2 { color: #7a2e0e; }
  footer { text-align: center; padding: 16px; color: #444; }
</style>
</head>
<body>
<header><h1>${esc(d.name)}</h1><p>${esc(d.tagline)}</p></header>
<main>
  <section><h2>About</h2><p>${esc(d.about)}</p></section>
  <section><h2>Products</h2><ul>${items}</ul></section>
  <section><h2>Contact</h2><p>${esc(d.city)}</p></section>
</main>
<footer>Made with LaunchMate AI</footer>
</body>
</html>`;
}

export function saveSite(input) {
  const d = {
    name: clip(input?.business_name, 60),
    tagline: clip(input?.tagline, 120),
    about: clip(input?.about, 600),
    city: clip(input?.city, 60),
    lang: ["en", "te", "hi"].includes(input?.language) ? input.language : "en",
    products: (Array.isArray(input?.products) ? input.products : []).slice(0, 6)
      .map(p => ({ name: clip(p?.name, 60), description: clip(p?.description, 200) }))
  };
  const id = crypto.randomBytes(8).toString("hex");
  store.set(id, render(d));
  if (store.size > 50) store.delete(store.keys().next().value);
  return id;
}

export function getSite(id) { return store.get(id); }

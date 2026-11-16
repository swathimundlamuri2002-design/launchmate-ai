import Anthropic from "@anthropic-ai/sdk";
import { saveSite } from "./site.js";

const client = new Anthropic();

const tools = [
  {
    name: "check_domain",
    description: "Check with GoDaddy whether a domain name is available to register, with indicative prices.",
    input_schema: {
      type: "object",
      properties: { domain: { type: "string", description: "Full domain, e.g. mypickles.in" } },
      required: ["domain"]
    }
  },
  {
    name: "generate_site",
    description: "Create a one-page website preview for the business. Call this only after the owner has confirmed the business name and what they sell. Write all text in the owner's language.",
    input_schema: {
      type: "object",
      properties: {
        business_name: { type: "string" },
        tagline: { type: "string", description: "One short line" },
        about: { type: "string", description: "2 to 3 sentences about the business" },
        city: { type: "string" },
        language: { type: "string", enum: ["en", "te", "hi"], description: "Language of the page text" },
        products: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, description: { type: "string" } },
            required: ["name", "description"]
          }
        }
      },
      required: ["business_name", "tagline", "about", "city", "language", "products"]
    }
  }
];

function money(m) {
  return m && typeof m.value === "number" ? { currency: m.currencyCode, amount: m.value / 100 } : null;
}

function normalize(d) {
  if (d.error) return { domain: d.domain, error: d.error };
  return {
    domain: d.domain,
    available: d.available,
    definitive: d.definitive,
    prices: (d.prices || []).slice(0, 3).map(p => ({
      years: p.period,
      price: money(p.price),
      renewalPrice: money(p.renewalPrice),
      fees: (p.fees || []).map(f => ({ type: f.type, fee: money(f.fee) })),
      recommended: p.recommended ?? false
    }))
  };
}

async function checkDomain(domain) {
  const pat = process.env.GDDY_PAT;
  if (!pat) return { error: "Domain check is not configured" };
  if (typeof domain !== "string" || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain)) {
    return { error: "Invalid domain name" };
  }
  try {
    const url = "https://api.godaddy.com/v3/domains/check-availability?domain=" + encodeURIComponent(domain);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${pat}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return { error: "Could not check this domain right now", status: res.status };
    return normalize(await res.json());
  } catch {
    return { error: "Could not check this domain right now" };
  }
}

const system = `You are LaunchMate AI, a friendly assistant that helps first-time small business owners in India go from idea to a live website. Be brief.
Rules:
- Reply in the same language the user writes in (Telugu, Hindi or English).
- Write plain text only. No tables, no markdown symbols like | or **. Use short lines or simple dashes.
- Never buy or register anything; only suggest and check.
- Brand names must be short (under 14 letters), easy to spell and say, with a local Telugu or Indian feel. Spell place names correctly (Vijayawada was formerly Bezawada).
- You can call check_domain at any time for any name, including names from earlier in the chat. Results from your own tool calls earlier in this conversation are real; never say you cannot check a domain.
- Use only what the tool returns. If a result has an error, say it could not be checked.
- If "definitive" is false, say the result is indicative and will be re-verified before any purchase.
- Prices are already in normal units (amount 12.99 means 12.99 USD). Do not convert currencies. Mention the renewal price if it differs.
- Once the owner has chosen a name and told you what they sell, offer to create a website preview. Call generate_site only after they say yes. Do not invent products they did not mention; ask if unsure. Write warm, specific product descriptions of one or two sentences (taste, how it is eaten) using only what the owner said or common knowledge about that kind of pickle. Never invent prices, certifications or claims such as organic, preservative-free or award-winning. After it succeeds, tell them the preview link is shown below your message.`;

// "messages" is the server-side conversation (with tool results). It is extended in place.
export async function chat(messages) {
  const siteIds = [];
  for (let i = 0; i < 6; i++) {
    const res = await client.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 1200,
      system,
      tools,
      messages
    });
    messages.push({ role: "assistant", content: res.content });
    if (res.stop_reason !== "tool_use") {
      return { reply: res.content.filter(b => b.type === "text").map(b => b.text).join("\n"), siteIds };
    }
    const results = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      let out;
      if (block.name === "check_domain") {
        out = await checkDomain(block.input?.domain);
      } else if (block.name === "generate_site") {
        const id = saveSite(block.input);
        siteIds.push(id);
        out = { ok: true, note: "Preview created. The link is shown to the user below your message." };
      } else {
        out = { error: "unknown tool" };
      }
      results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out) });
    }
    messages.push({ role: "user", content: results });
  }
  return { reply: "Sorry, that took too many steps. Please try a simpler request.", siteIds };
}

# LaunchMate AI

An AI assistant that helps first-time small business owners in India go from an idea to a website preview. The owner describes their business in Telugu, Hindi or English. LaunchMate AI suggests brand names, checks whether the domains are available on GoDaddy, and builds a one-page website preview.

**Live app:** https://hkxnniwhsv.c36.airoapp.ai
**Custom domain:** to be added
**Contact form:** `/contact.html`

## Who it is for
Home sellers, creators and small shops who have a product but no website and may not be comfortable with English-only tools. For example, a home baker in Vijayawada who sells pickles.

## What it does
1. The owner describes the business in their own language.
2. The agent suggests short brand names and checks each `.in` domain with the GoDaddy Domains API, with real prices.
3. The owner picks a name and says what they sell.
4. The agent creates a one-page website preview (name, tagline, about, products, contact).
5. Visitors can send a message through the contact form, which is emailed to the business mailbox.

## How it works
- **Claude** (`claude-sonnet-5-5`) runs a tool-use loop. It decides when to call two tools:
  - `check_domain` calls the GoDaddy Domains API for availability and price.
  - `generate_site` returns structured JSON, which the server renders into a safe HTML template.
- The agent never buys or registers anything. The owner makes purchases themselves on godaddy.com.
- Results marked "indicative" by the API are reported that way to the user.

## Tech
- Node.js 22, Express
- Anthropic API (Claude) with tool use
- GoDaddy Domains API (personal access token) and GoDaddy Node.js hosting (deployed with the `gddy` CLI)
- Nodemailer for the contact form (SMTP to the domain mailbox)

## Security and engineering
- No secrets in code or in the repo. Keys are read from environment variables and stored as GoDaddy hosting secrets.
- Conversations are kept on the server together with tool results, so the browser cannot forge earlier turns.
- Rate limits: 20 chat requests and 5 contact messages per 10 minutes per IP.
- Input validation on every endpoint (length limits, domain name pattern, email pattern).
- Model output is escaped before it goes into HTML, and generated previews are served with a Content-Security-Policy.
- The tool loop is capped, and the conversation length is capped.
- The contact form has a honeypot field against bots and strips line breaks from header fields.
- Error messages shown to users never include internal details.
- The GoDaddy token is a personal access token with only the permissions the agent needs.

## Run locally
Requires Node.js 20 or later.

```bash
npm install
```

Create a `.env` file (it is git-ignored):

```
ANTHROPIC_API_KEY=your-key
GDDY_PAT=your-godaddy-personal-access-token
# Optional, for the contact form:
SMTP_HOST=smtp.titan.email
SMTP_PORT=465
SMTP_USER=hello@yourdomain.com
SMTP_PASS=your-mailbox-password
CONTACT_TO=hello@yourdomain.com
```

```bash
node --env-file=.env server.js
```

Open http://localhost:3000. `/health` reports which settings are present (true or false only, never the values).

## Deploy on GoDaddy Node.js hosting
```bash
# zip the project (without .env and node_modules), then:
gddy hosting source upload --app-id <app-id> --file ./app.zip
gddy hosting deployment publish --app-id <app-id>
# store secrets per environment:
gddy hosting secret create --app-id <app-id> --name ANTHROPIC_API_KEY --value <value> --variant PUBLISH
```

## Project structure
```
server.js     Express server, routes, rate limits, sessions
agent.js      Claude tool-use loop and the GoDaddy domain check
site.js       Website preview template and storage
contact.js    Contact form handler (SMTP)
public/       Chat page and contact page
```

## Known limitations
- Website previews and chat sessions are kept in memory, so they are lost when the app restarts.
- Domain availability from the API is indicative. It is re-verified at purchase time on godaddy.com.
- The agent does not buy domains or create mailboxes. The owner does that.

## Built for
GoDaddy Inclusive Innovation Hackathon 2026, sponsored by Anthropic.

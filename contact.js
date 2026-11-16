import nodemailer from "nodemailer";

const clean = (s, n) => String(s ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, n);

export async function sendContact(body) {
  const name = clean(body?.name, 80);
  const email = clean(body?.email, 120);
  const message = String(body?.message ?? "").trim().slice(0, 2000);

  if (body?.website) return { status: 200, ok: true }; // honeypot: bots fill this, pretend success
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 400, error: "Please enter your name, a valid email and a message." };
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, CONTACT_TO } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return { status: 503, error: "The contact form is not configured yet. Please try again later." };
  }

  const port = Number(SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });

  try {
    await transporter.sendMail({
      from: SMTP_USER,
      to: CONTACT_TO || SMTP_USER,
      replyTo: email,
      subject: "LaunchMate AI contact: " + name,
      text: "From: " + name + " <" + email + ">\n\n" + message
    });
    return { status: 200, ok: true };
  } catch (e) {
    console.error("mail error:", e?.code || "", String(e?.message).slice(0, 150));
    return { status: 502, error: "Could not send your message right now. Please try again later." };
  }
}

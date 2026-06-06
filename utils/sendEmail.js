const nodemailer = require("nodemailer");
const dns = require("dns").promises;
const { renderEmail, BRAND } = require("./emailTemplate");

const SMTP_HOST = "smtp.gmail.com";
let cachedSmtpIp = null;

const resolveSmtpIpv4 = async () => {
  if (cachedSmtpIp) return cachedSmtpIp;
  const { address } = await dns.lookup(SMTP_HOST, { family: 4 });
  cachedSmtpIp = address;
  return address;
};

const getMailCreds = () => {
  const user = process.env.EMAIL_USER || process.env.MAIL_USER;
  const rawPass = process.env.EMAIL_PASS || process.env.MAIL_PASS;
  const pass = rawPass ? String(rawPass).replace(/\s+/g, "") : rawPass;
  return { user, pass };
};

const renderOtpBody = (otp) => `
  <div style="background:#f5f3ff;border:1px solid #e9d5ff;border-radius:12px;padding:28px;text-align:center;">
    <p style="margin:0 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:0.18em;font-weight:600;color:#6b6f8c;">Your verification code</p>
    <p style="margin:0;font-size:38px;line-height:1.1;font-weight:800;letter-spacing:0.32em;color:${BRAND.accent};font-family:'Courier New',monospace;">${otp}</p>
  </div>

  <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">
    This code is valid for <strong style="color:#0b0a18;">5 minutes</strong>. Enter it on the sign-in screen to continue.
  </p>

  <div style="margin-top:20px;padding:14px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;">
    <p style="margin:0;font-size:13px;line-height:1.5;color:#9a3412;">
      <strong>Didn't request this?</strong> You can safely ignore this email — your account stays secure.
    </p>
  </div>
`;

/** Build the subject + html + text once, shared by every delivery method. */
const buildMessage = (otp) => {
  const html = renderEmail({
    preheader: `Your ${BRAND.name} sign-in code is ${otp}. It expires in 5 minutes.`,
    title: "Verify your sign-in",
    intro: `Use the code below to finish signing in to your ${BRAND.name} account.`,
    bodyHtml: renderOtpBody(otp),
    footerNote: `For your security, never share this code with anyone — ${BRAND.name} will never ask you for it.`,
  });

  const text =
    `Your ${BRAND.name} sign-in code is: ${otp}\n\n` +
    `This code expires in 5 minutes. If you didn't request it, you can ignore this email.\n\n` +
    `For your security, never share this code with anyone.`;

  return { subject: `Your ${BRAND.name} sign-in code: ${otp}`, html, text };
};

/** Parse EMAIL_FROM ("Name <email>" or "email") into { name, email }. */
const parseSender = () => {
  const raw = (process.env.EMAIL_FROM || process.env.MAIL_USER || "").trim();
  const match = raw.match(/^(.*?)<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim() || BRAND.name, email: match[2].trim() };
  }
  return { name: BRAND.name, email: raw };
};

/**
 * Deliver via the Brevo HTTP API (port 443).
 * Best no-domain option: verify a single sender (e.g. your Gmail) in Brevo and
 * you can email anyone — no custom domain required.
 */
const sendViaBrevo = async (to, otp) => {
  const apiKey = process.env.BREVO_API_KEY;
  const sender = parseSender();
  if (!sender.email) {
    throw new Error(
      "Set EMAIL_FROM (or MAIL_USER) to the sender address you verified in Brevo."
    );
  }

  const { subject, html, text } = buildMessage(otp);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      throw new Error(`Brevo API error ${resp.status}: ${detail}`);
    }
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Email provider (Brevo) timed out after 15s.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Deliver via the Resend HTTP API (port 443).
 * Cloud hosts (Render/Vercel/Heroku) block or drop outbound SMTP, which makes
 * nodemailer hang; HTTPS is always allowed, so this is the production path.
 */
const sendViaResend = async (to, otp) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM || `${BRAND.name} <onboarding@resend.dev>`;
  const { subject, html, text } = buildMessage(otp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      throw new Error(`Resend API error ${resp.status}: ${detail}`);
    }
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Email provider (Resend) timed out after 15s.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Deliver via Gmail SMTP (local dev / fallback). Now has explicit timeouts so
 * a blocked SMTP port fails in ~10s instead of hanging for 90s.
 */
const sendViaSmtp = async (to, otp) => {
  const { user, pass } = getMailCreds();
  if (!user || !pass) {
    throw new Error(
      "Missing email credentials. Set RESEND_API_KEY (recommended) or EMAIL_USER/EMAIL_PASS (MAIL_USER/MAIL_PASS)."
    );
  }

  const smtpIp = await resolveSmtpIpv4();
  const transporter = nodemailer.createTransport({
    host: smtpIp,
    port: 465,
    secure: true,
    auth: { user, pass },
    family: 4,
    tls: { servername: SMTP_HOST },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  const { subject, html, text } = buildMessage(otp);
  await transporter.sendMail({
    from: `"${BRAND.name}" <${user}>`,
    to,
    subject,
    text,
    html,
  });
};

const sendEmail = async (to, otp) => {
  // Prefer an HTTPS provider in production (works on Render where SMTP is
  // blocked). Fall back to SMTP for local development when no key is set.
  if (process.env.BREVO_API_KEY) {
    return sendViaBrevo(to, otp);
  }
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(to, otp);
  }
  return sendViaSmtp(to, otp);
};

module.exports = sendEmail;

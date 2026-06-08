const nodemailer = require("nodemailer");
const dns = require("dns").promises;
const { Resend } = require("resend");

const SMTP_HOST = "smtp.gmail.com";
let cachedSmtpIp = null;
let cachedResend = null;

const getResend = () => {
  if (!process.env.RESEND_API_KEY) return null;
  if (cachedResend) return cachedResend;
  cachedResend = new Resend(process.env.RESEND_API_KEY);
  return cachedResend;
};

const getSmtpCreds = () => {
  const user = process.env.EMAIL_USER || process.env.MAIL_USER;
  const rawPass = process.env.EMAIL_PASS || process.env.MAIL_PASS;
  const pass = rawPass ? String(rawPass).replace(/\s+/g, "") : rawPass;
  return { user, pass };
};

const resolveSmtpIpv4 = async () => {
  if (cachedSmtpIp) return cachedSmtpIp;
  const { address } = await dns.lookup(SMTP_HOST, { family: 4 });
  cachedSmtpIp = address;
  return address;
};

const sendViaResend = async ({ to, subject, html, text, from, replyTo }) => {
  const resend = getResend();
  const fromAddress =
    process.env.RESEND_FROM ||
    from ||
    "Portfolio <onboarding@resend.dev>";

  const { error } = await resend.emails.send({
    from: fromAddress,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
    ...(replyTo ? { reply_to: replyTo } : {}),
  });

  if (error) {
    throw new Error(
      `Resend failed: ${error.message || JSON.stringify(error)}`
    );
  }
};

const sendViaSmtp = async ({ to, subject, html, text, from, replyTo }) => {
  const { user, pass } = getSmtpCreds();
  if (!user || !pass) {
    throw new Error(
      "Missing email credentials. Set EMAIL_USER/EMAIL_PASS or MAIL_USER/MAIL_PASS — or set RESEND_API_KEY to use Resend."
    );
  }

  const smtpIp = await resolveSmtpIpv4();

  // Try port 465 first (SSL), then fallback to 587 (TLS) if on Render
  const isProduction = process.env.NODE_ENV === "production";
  const port = isProduction ? 587 : 465;
  const secure = port === 465;

  console.log(
    `[SMTP] Sending to ${to} via ${smtpIp}:${port} (secure: ${secure})`
  );

  const transporter = nodemailer.createTransport({
    host: smtpIp,
    port: port,
    secure: secure,
    auth: { user, pass },
    family: 4,
    ...(port === 587 ? { tls: { servername: SMTP_HOST } } : {}),
    connectionTimeout: 5000,
    socketTimeout: 10000,
  });

  await transporter.sendMail({
    from: from || user,
    to,
    subject,
    html,
    text,
    ...(replyTo ? { replyTo } : {}),
  });

  console.log(`[SMTP] Successfully sent email to ${to}`);
};

/**
 * Send an email. Uses Resend (HTTPS) when RESEND_API_KEY is set — required
 * on hosts that block outbound SMTP (Render free/standard). Falls back to
 * Gmail SMTP locally for dev.
 */
const sendMail = async (opts) => {
  console.log(`[MAILER] Starting email send...`);

  // Add timeout to prevent hanging requests (especially SMTP)
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => {
      const err = new Error("Email send timeout (10s) - SMTP or API unreachable");
      console.error(`[MAILER] ✗ ${err.message}`);
      reject(err);
    }, 10000)
  );

  const sendPromise = (async () => {
    if (getResend()) {
      console.log(`[MAILER] Using Resend API...`);
      return await sendViaResend(opts);
    } else {
      console.log(`[MAILER] Using SMTP (Gmail)...`);
      return await sendViaSmtp(opts);
    }
  })();

  return Promise.race([sendPromise, timeoutPromise])
    .then((result) => {
      console.log(`[MAILER] ✓ Email sent successfully`);
      return result;
    })
    .catch((err) => {
      console.error(`[MAILER] ✗ Email send failed:`, err.message);
      throw err;
    });
};

module.exports = { sendMail };

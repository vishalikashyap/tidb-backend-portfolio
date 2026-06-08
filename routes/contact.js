const express = require("express");

const { renderEmail, escapeHtml, BRAND } = require("../utils/emailTemplate");
const { sendMail } = require("../utils/mailer");

const router = express.Router();

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const isEmail = (value) =>
  isNonEmptyString(value) &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

const renderContactBody = ({ name, email, subjectText, message }) => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:18px 22px;border-bottom:1px solid #e5e7eb;">
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;font-weight:600;color:#94a3b8;">From</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#0b0a18;">${escapeHtml(name)}</p>
        <p style="margin:2px 0 0;font-size:13px;color:#4b5563;">
          <a href="mailto:${escapeHtml(email)}" style="color:${BRAND.accentSoft};text-decoration:none;">${escapeHtml(email)}</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 22px;border-bottom:1px solid #e5e7eb;">
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;font-weight:600;color:#94a3b8;">Subject</p>
        <p style="margin:0;font-size:15px;color:#0b0a18;">${escapeHtml(subjectText)}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 22px;">
        <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;font-weight:600;color:#94a3b8;">Message</p>
        <p style="margin:0;font-size:14px;line-height:1.65;color:#0b0a18;white-space:pre-wrap;">${escapeHtml(message).replace(/\n/g, "<br/>")}</p>
      </td>
    </tr>
  </table>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:22px;">
    <tr>
      <td align="center">
        <a
          href="mailto:${escapeHtml(email)}?subject=Re:%20${encodeURIComponent(subjectText)}"
          style="display:inline-block;padding:12px 26px;background:${BRAND.accent};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;border-radius:8px;"
        >Reply to ${escapeHtml(name)}</a>
      </td>
    </tr>
  </table>
`;

router.post("/", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body ?? {};

    if (!isNonEmptyString(name)) {
      return res.status(400).json({ message: "Name is required" });
    }
    if (!isEmail(email)) {
      return res.status(400).json({ message: "Valid email is required" });
    }
    if (!isNonEmptyString(message)) {
      return res.status(400).json({ message: "Message is required" });
    }
    if (message.trim().length > 5000) {
      return res.status(413).json({ message: "Message too long" });
    }

    const inboxFallback =
      process.env.EMAIL_USER ||
      process.env.MAIL_USER ||
      process.env.CONTACT_TO;
    const to = process.env.CONTACT_TO || inboxFallback;
    if (!to) {
      return res.status(500).json({
        message:
          "Inbox not configured. Set CONTACT_TO (or EMAIL_USER/MAIL_USER).",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanMessage = message.trim();
    const subjectText = isNonEmptyString(subject)
      ? subject.trim().slice(0, 200)
      : "New contact form submission";

    const html = renderEmail({
      preheader: `${cleanName} sent you a message: ${subjectText}`,
      title: "New message from your contact form",
      intro: `${escapeHtml(cleanName)} just reached out through your ${BRAND.name} site.`,
      bodyHtml: renderContactBody({
        name: cleanName,
        email: cleanEmail,
        subjectText,
        message: cleanMessage,
      }),
      footerNote: `Reply directly to this email to respond to ${escapeHtml(cleanName)} — the reply-to address is already set.`,
    });

    const text =
      `New contact form submission\n\n` +
      `From: ${cleanName} <${cleanEmail}>\n` +
      `Subject: ${subjectText}\n\n` +
      `Message:\n${cleanMessage}\n`;

    await sendMail({
      from: `"${BRAND.name} Contact" <${process.env.EMAIL_USER || process.env.MAIL_USER || "onboarding@resend.dev"}>`,
      to,
      replyTo: cleanEmail,
      subject: `[${BRAND.name}] ${subjectText}`,
      text,
      html,
    });

    return res.json({ message: "Message sent" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

module.exports = router;

const express = require("express");
const nodemailer = require("nodemailer");

const router = express.Router();

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const isEmail = (value) =>
  isNonEmptyString(value) &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getMailCreds = () => {
  const user = process.env.EMAIL_USER || process.env.MAIL_USER;
  const rawPass = process.env.EMAIL_PASS || process.env.MAIL_PASS;
  const pass = rawPass ? String(rawPass).replace(/\s+/g, "") : rawPass;
  return { user, pass };
};

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

    const { user, pass } = getMailCreds();
    if (!user || !pass) {
      return res.status(500).json({ message: "Mail not configured" });
    }

    const to = process.env.CONTACT_TO || user;
    const trimmedSubject = isNonEmptyString(subject)
      ? subject.trim().slice(0, 200)
      : "New contact form submission";

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
      family: 4,
    });

    await transporter.sendMail({
      from: user,
      to,
      replyTo: email.trim(),
      subject: `[Contact] ${trimmedSubject}`,
      html: `
        <h2>New contact form submission</h2>
        <p><strong>Name:</strong> ${escapeHtml(name.trim())}</p>
        <p><strong>Email:</strong> ${escapeHtml(email.trim())}</p>
        <p><strong>Subject:</strong> ${escapeHtml(trimmedSubject)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message.trim()).replace(/\n/g, "<br/>")}</p>
      `,
    });

    return res.json({ message: "Message sent" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

module.exports = router;

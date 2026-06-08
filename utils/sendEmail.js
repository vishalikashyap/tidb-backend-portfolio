const { renderEmail, BRAND } = require("./emailTemplate");
const { sendMail } = require("./mailer");

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

const sendEmail = async (to, otp) => {
  console.log(`[MAIL] Preparing to send OTP to ${to}`);

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

  const hasResend = process.env.RESEND_API_KEY ? "Yes" : "No";
  console.log(`[MAIL] Using Resend: ${hasResend}, Using SMTP: ${hasResend === "No" ? "Yes" : "No"}`);

  await sendMail({
    from: `"${BRAND.name}" <${process.env.EMAIL_USER || process.env.MAIL_USER || "onboarding@resend.dev"}>`,
    to,
    subject: `Your ${BRAND.name} sign-in code: ${otp}`,
    text,
    html,
  });

  console.log(`[MAIL] ✓ OTP email prepared and queued to ${to}`);
};

module.exports = sendEmail;

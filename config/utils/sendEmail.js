const nodemailer = require("nodemailer");

const sendEmail = async (to, otp) => {
  const user = process.env.EMAIL_USER || process.env.MAIL_USER;
  const rawPass = process.env.EMAIL_PASS || process.env.MAIL_PASS;
  const pass = rawPass ? String(rawPass).replace(/\s+/g, "") : rawPass;

  if (!user || !pass) {
    throw new Error(
      "Missing email credentials. Set EMAIL_USER/EMAIL_PASS or MAIL_USER/MAIL_PASS."
    );
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });

  await transporter.sendMail({
    from: user,
    to,
    subject: "Your OTP Code",
    html: `<h2>Your OTP is: ${otp}</h2>`,
  });
};

module.exports = sendEmail;

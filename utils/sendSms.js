const twilio = require("twilio");

let cachedClient = null;

const getClient = () => {
  if (cachedClient) return cachedClient;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error(
      "Missing Twilio credentials. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN."
    );
  }

  cachedClient = twilio(sid, token);
  return cachedClient;
};

const toE164 = (mobile) => {
  const raw = String(mobile ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;

  const digits = raw.replace(/\D/g, "");
  const defaultCountry = (process.env.SMS_DEFAULT_COUNTRY_CODE || "+91").trim();
  return `${defaultCountry}${digits}`;
};

const sendOtpSms = async (mobile, otp) => {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) {
    throw new Error("Missing TWILIO_PHONE_NUMBER.");
  }

  const to = toE164(mobile);
  if (!to) throw new Error("Invalid mobile number.");

  const client = getClient();
  await client.messages.create({
    from,
    to,
    body: `Your Portfolio sign-in code is ${otp}. It expires in 5 minutes. Never share this code with anyone.`,
  });
};

module.exports = { sendOtpSms, toE164 };

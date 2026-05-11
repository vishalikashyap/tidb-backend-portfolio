// routes/auth.js
const express = require("express");
const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");

const router = express.Router();
const pool = require("../config/db");
const sendEmail = require("../utils/sendEmail");
const auth = require("../middleware/auth");
const ensureLoginEventsSchema = require("../utils/ensureLoginEventsSchema");

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const normalizeOtp = (value) => String(value ?? "").trim();
const normalizeMobile = (value) =>
  String(value ?? "")
    .trim()
    .replace(/[^\d+]/g, "");

const isEmail = (value) =>
  isNonEmptyString(value) &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

const isMobile = (value) => {
  const normalized = normalizeMobile(value);
  return normalized.length > 0 && /^\+?[0-9]{7,15}$/.test(normalized);
};

const signToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    const err = new Error("JWT_SECRET not configured");
    err.statusCode = 500;
    throw err;
  }

  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// SEND OTP (email OR mobile)
router.post("/send-otp", async (req, res) => {
  const { email, mobile } = req.body;

  const hasEmail = email !== undefined && email !== null && email !== "";
  const hasMobile = mobile !== undefined && mobile !== null && mobile !== "";
  const normalizedMobile = hasMobile ? normalizeMobile(mobile) : undefined;

  if (!hasEmail && !hasMobile) {
    return res.status(400).json({ message: "Email or mobile is required" });
  }

  if (hasEmail && hasMobile) {
    return res
      .status(400)
      .json({ message: "Provide either email or mobile, not both" });
  }

  if (hasEmail && !isEmail(email)) {
    return res.status(400).json({ message: "Invalid email" });
  }

  if (hasMobile && !isMobile(mobile)) {
    return res.status(400).json({ message: "Invalid mobile" });
  }

  const otp = otpGenerator.generate(6, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

  const expiry = new Date(Date.now() + 5 * 60 * 1000);
  const includeOtp = String(process.env.OTP_DEBUG).toLowerCase() === "true";

  try {
    if (email) {
      await sendEmail(email, otp);

      const [rows] = await pool.query("SELECT id FROM users WHERE email=?", [
        email,
      ]);

      if (rows.length) {
        await pool.query("UPDATE users SET otp=?, otp_expiry=? WHERE email=?", [
          otp,
          expiry,
          email,
        ]);
      } else {
        await pool.query(
          "INSERT INTO users (email, otp, otp_expiry) VALUES (?, ?, ?)",
          [email, otp, expiry]
        );
      }
    } else if (mobile) {
      console.log("OTP for mobile:", otp); // replace with SMS later

      const [rows] = await pool.query("SELECT id FROM users WHERE mobile=?", [
        normalizedMobile,
      ]);

      if (rows.length) {
        await pool.query(
          "UPDATE users SET otp=?, otp_expiry=? WHERE mobile=?",
          [otp, expiry, normalizedMobile]
        );
      } else {
        await pool.query(
          "INSERT INTO users (mobile, otp, otp_expiry) VALUES (?, ?, ?)",
          [normalizedMobile, otp, expiry]
        );
      }
    }

    return res.json({
      message: "OTP sent successfully",
      ...(includeOtp ? { otp } : {}),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

// VERIFY OTP (and issue JWT)
router.post("/verify-otp", async (req, res) => {
  const { email, mobile, otp } = req.body;

  try {
    const hasEmail = email !== undefined && email !== null && email !== "";
    const hasMobile = mobile !== undefined && mobile !== null && mobile !== "";
    const normalizedMobile = hasMobile ? normalizeMobile(mobile) : undefined;

    if (!hasEmail && !hasMobile) {
      return res.status(400).json({ message: "Email or mobile is required" });
    }

    if (hasEmail && hasMobile) {
      return res
        .status(400)
        .json({ message: "Provide either email or mobile, not both" });
    }

    if (hasEmail && !isEmail(email)) {
      return res.status(400).json({ message: "Invalid email" });
    }

    if (hasMobile && !isMobile(mobile)) {
      return res.status(400).json({ message: "Invalid mobile" });
    }

    const providedOtp = normalizeOtp(otp);
    if (!providedOtp) {
      return res.status(400).json({ message: "OTP is required" });
    }

    let rows;
    if (email) {
      [rows] = await pool.query("SELECT * FROM users WHERE email=?", [email]);
    } else {
      [rows] = await pool.query("SELECT * FROM users WHERE mobile=?", [
        normalizedMobile,
      ]);
    }

    const user = rows?.[0];
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const storedOtp = normalizeOtp(user.otp);
    const expiryDate = user.otp_expiry ? new Date(user.otp_expiry) : null;

    if (!storedOtp || storedOtp !== providedOtp || !expiryDate) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    if (expiryDate < new Date()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    await pool.query(
      "UPDATE users SET otp=NULL, otp_expiry=NULL, is_verified=TRUE WHERE id=?",
      [user.id]
    );

    try {
      await ensureLoginEventsSchema(pool);
      await pool.query("INSERT INTO login_events (user_id) VALUES (?)", [user.id]);
    } catch (e) {
      console.error("Failed to record login event:", e.message);
    }

    const token = signToken(user.id);

    return res.json({
      message: "Login successful",
      token,
      user: { id: user.id, email: user.email, mobile: user.mobile },
    });
  } catch (err) {
    console.error(err);
    return res
      .status(err.statusCode || 500)
      .json({ message: err.message || "Verification failed" });
  }
});

// Current user (JWT protected)
router.get("/me", auth, async (req, res) => {
  return res.json({ user: req.user });
});

// Stateless logout (client deletes token)
router.post("/logout", auth, async (req, res) => {
  return res.json({ message: "Logged out" });
});

module.exports = router;

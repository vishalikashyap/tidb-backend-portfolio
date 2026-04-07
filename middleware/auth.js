const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing Authorization header" });
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      return res.status(401).json({ message: "Missing token" });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "JWT_SECRET not configured" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload?.id) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const [rows] = await pool.query(
      "SELECT id, email, mobile, is_verified FROM users WHERE id=?",
      [payload.id]
    );

    const user = rows?.[0];
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

module.exports = auth;


const express = require("express");

const pool = require("../config/db");
const ensureLoginEventsSchema = require("../utils/ensureLoginEventsSchema");
const ensurePortfolioSchema = require("../utils/ensurePortfolioSchema");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    await ensureLoginEventsSchema(pool);
    await ensurePortfolioSchema(pool);

    const [loginRows] = await pool.query(
      "SELECT COUNT(*) AS total, COUNT(DISTINCT user_id) AS unique_users FROM login_events"
    );
    const [publishedRows] = await pool.query(
      "SELECT COUNT(*) AS total FROM portfolio_public"
    );

    return res.json({
      totalLogins: Number(loginRows?.[0]?.total ?? 0),
      uniqueUsers: Number(loginRows?.[0]?.unique_users ?? 0),
      portfoliosPublished: Number(publishedRows?.[0]?.total ?? 0),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

module.exports = router;

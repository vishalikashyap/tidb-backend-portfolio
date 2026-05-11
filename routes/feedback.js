const express = require("express");

const prisma = require("../config/prisma");

const router = express.Router();

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const isEmail = (value) =>
  isNonEmptyString(value) &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

const serialize = (row) => ({
  id: Number(row.id),
  name: row.name,
  rating: row.rating,
  message: row.message,
  createdAt: row.createdAt ? row.createdAt.toISOString() : null,
});

router.get("/top", async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

    const rows = await prisma.feedback.findMany({
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        name: true,
        rating: true,
        message: true,
        createdAt: true,
      },
    });

    return res.json({ items: rows.map(serialize) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, email, rating, message } = req.body ?? {};
    const ratingNum = Number(rating);

    if (!isNonEmptyString(name)) {
      return res.status(400).json({ message: "Name is required" });
    }
    if (!isEmail(email)) {
      return res.status(400).json({ message: "Valid email is required" });
    }
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }
    if (!isNonEmptyString(message)) {
      return res.status(400).json({ message: "Message is required" });
    }
    if (message.trim().length > 2000) {
      return res.status(413).json({ message: "Message too long" });
    }

    await prisma.feedback.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        rating: ratingNum,
        message: message.trim(),
      },
    });

    return res.json({ message: "Feedback received" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

module.exports = router;

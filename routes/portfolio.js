const express = require("express");
const crypto = require("crypto");

const auth = require("../middleware/auth");
const pool = require("../config/db");
const ensurePortfolioSchema = require("../utils/ensurePortfolioSchema");

const router = express.Router();

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const deepMergeReplaceArrays = (base, patch) => {
  if (Array.isArray(patch)) return patch.slice();
  if (!isPlainObject(patch)) return patch;

  const baseObj = isPlainObject(base) ? base : {};
  const out = { ...baseObj };

  for (const [key, patchValue] of Object.entries(patch)) {
    const baseValue = baseObj[key];

    if (Array.isArray(patchValue)) {
      out[key] = patchValue.slice();
      continue;
    }

    if (isPlainObject(patchValue)) {
      out[key] = deepMergeReplaceArrays(baseValue, patchValue);
      continue;
    }

    out[key] = patchValue;
  }

  return out;
};

router.get("/draft", auth, async (req, res) => {
  try {
    await ensurePortfolioSchema(pool);

    const [rows] = await pool.query(
      "SELECT draft, updated_at FROM portfolio_drafts WHERE user_id=?",
      [req.user.id]
    );

    const row = rows?.[0];
    if (!row) {
      return res.json({ draft: null, updatedAt: null });
    }

    let draft = null;
    try {
      draft = JSON.parse(row.draft);
    } catch (e) {
      // If somehow corrupted in DB, return null so client can fall back to local.
      draft = null;
    }

    const updatedAt = row.updated_at ? new Date(row.updated_at).toISOString() : null;
    return res.json({ draft, updatedAt });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

router.put("/draft", auth, async (req, res) => {
  try {
    await ensurePortfolioSchema(pool);

    const { draft } = req.body ?? {};
    if (!isPlainObject(draft)) {
      return res.status(400).json({ message: "draft must be an object" });
    }

    const draftText = JSON.stringify(draft);
    if (draftText.length > 1_000_000) {
      return res.status(413).json({ message: "Draft too large" });
    }

    await pool.query(
      `
        INSERT INTO portfolio_drafts (user_id, draft)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE draft=VALUES(draft), updated_at=CURRENT_TIMESTAMP
      `,
      [req.user.id, draftText]
    );

    const [rows] = await pool.query(
      "SELECT updated_at FROM portfolio_drafts WHERE user_id=?",
      [req.user.id]
    );
    const updatedAt = rows?.[0]?.updated_at
      ? new Date(rows[0].updated_at).toISOString()
      : new Date().toISOString();

    return res.json({ message: "Draft saved", updatedAt });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

router.patch("/draft", auth, async (req, res) => {
  try {
    await ensurePortfolioSchema(pool);

    const { patch } = req.body ?? {};
    if (!isPlainObject(patch)) {
      return res.status(400).json({ message: "patch must be an object" });
    }

    const [rows] = await pool.query(
      "SELECT draft FROM portfolio_drafts WHERE user_id=?",
      [req.user.id]
    );

    let currentDraft = {};
    const row = rows?.[0];
    if (row?.draft) {
      try {
        const parsed = JSON.parse(row.draft);
        if (isPlainObject(parsed)) currentDraft = parsed;
      } catch (e) {
        currentDraft = {};
      }
    }

    const merged = deepMergeReplaceArrays(currentDraft, patch);
    const draftText = JSON.stringify(merged);
    if (draftText.length > 1_000_000) {
      return res.status(413).json({ message: "Draft too large" });
    }

    await pool.query(
      `
        INSERT INTO portfolio_drafts (user_id, draft)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE draft=VALUES(draft), updated_at=CURRENT_TIMESTAMP
      `,
      [req.user.id, draftText]
    );

    const [updatedRows] = await pool.query(
      "SELECT updated_at FROM portfolio_drafts WHERE user_id=?",
      [req.user.id]
    );
    const updatedAt = updatedRows?.[0]?.updated_at
      ? new Date(updatedRows[0].updated_at).toISOString()
      : new Date().toISOString();

    return res.json({ message: "Draft updated", updatedAt });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

router.delete("/draft", auth, async (req, res) => {
  try {
    await ensurePortfolioSchema(pool);
    await pool.query("DELETE FROM portfolio_drafts WHERE user_id=?", [req.user.id]);
    return res.json({ message: "Draft reset" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

router.post("/publish", auth, async (req, res) => {
  try {
    await ensurePortfolioSchema(pool);

    const bodyDraft = req.body?.draft;
    let draftObj = null;

    if (bodyDraft !== undefined) {
      if (!isPlainObject(bodyDraft)) {
        return res.status(400).json({ message: "draft must be an object" });
      }
      draftObj = bodyDraft;
    } else {
      const [rows] = await pool.query(
        "SELECT draft FROM portfolio_drafts WHERE user_id=?",
        [req.user.id]
      );
      const row = rows?.[0];
      if (!row?.draft) {
        return res.status(400).json({ message: "No draft found to publish" });
      }
      try {
        const parsed = JSON.parse(row.draft);
        if (!isPlainObject(parsed)) {
          return res.status(400).json({ message: "Saved draft is invalid" });
        }
        draftObj = parsed;
      } catch (e) {
        return res.status(400).json({ message: "Saved draft is corrupted" });
      }
    }

    const draftText = JSON.stringify(draftObj);
    if (draftText.length > 1_000_000) {
      return res.status(413).json({ message: "Draft too large" });
    }

    const [existingRows] = await pool.query(
      "SELECT public_id FROM portfolio_public WHERE user_id=?",
      [req.user.id]
    );
    const existingPublicId = existingRows?.[0]?.public_id;
    const publicId = existingPublicId || crypto.randomUUID();

    await pool.query(
      `
        INSERT INTO portfolio_public (public_id, user_id, draft)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE draft=VALUES(draft), updated_at=CURRENT_TIMESTAMP
      `,
      [publicId, req.user.id, draftText]
    );

    return res.json({ message: "Published", publicId, urlPath: `/p/${publicId}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

router.delete("/publish", auth, async (req, res) => {
  try {
    await ensurePortfolioSchema(pool);
    await pool.query("DELETE FROM portfolio_public WHERE user_id=?", [req.user.id]);
    return res.json({ message: "Unpublished" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

// Public (no auth): fetch published portfolio by publicId
router.get("/p/:publicId", async (req, res) => {
  try {
    await ensurePortfolioSchema(pool);

    const publicId = String(req.params.publicId || "").trim();
    if (!publicId) return res.status(400).json({ message: "publicId is required" });

    const [rows] = await pool.query(
      "SELECT draft, updated_at FROM portfolio_public WHERE public_id=?",
      [publicId]
    );
    const row = rows?.[0];
    if (!row) return res.status(404).json({ message: "Not found" });

    let draft = null;
    try {
      draft = JSON.parse(row.draft);
    } catch (e) {
      draft = null;
    }

    const updatedAt = row.updated_at ? new Date(row.updated_at).toISOString() : null;
    return res.json({ draft, updatedAt });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

module.exports = router;

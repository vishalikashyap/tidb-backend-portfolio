let ensured = false;
let ensurePromise = null;

async function ensurePortfolioSchema(pool) {
  if (ensured) return;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS portfolio_drafts (
        user_id BIGINT NOT NULL PRIMARY KEY,
        draft LONGTEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS portfolio_public (
        public_id VARCHAR(64) NOT NULL PRIMARY KEY,
        user_id BIGINT NOT NULL UNIQUE,
        draft LONGTEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    ensured = true;
  })().finally(() => {
    ensurePromise = null;
  });

  return ensurePromise;
}

module.exports = ensurePortfolioSchema;

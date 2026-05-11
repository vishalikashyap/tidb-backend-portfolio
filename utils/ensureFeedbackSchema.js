let ensured = false;
let ensurePromise = null;

async function ensureFeedbackSchema(pool) {
  if (ensured) return;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        rating TINYINT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    ensured = true;
  })().finally(() => {
    ensurePromise = null;
  });

  return ensurePromise;
}

module.exports = ensureFeedbackSchema;

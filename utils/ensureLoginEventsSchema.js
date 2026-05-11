let ensured = false;
let ensurePromise = null;

async function ensureLoginEventsSchema(pool) {
  if (ensured) return;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS login_events (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_login_events_user (user_id)
      )
    `);
    ensured = true;
  })().finally(() => {
    ensurePromise = null;
  });

  return ensurePromise;
}

module.exports = ensureLoginEventsSchema;

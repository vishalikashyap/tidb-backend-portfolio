const { PrismaClient } = require("@prisma/client");

const buildDatabaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const user = encodeURIComponent(process.env.DB_USER || "");
  const password = encodeURIComponent(process.env.DB_PASSWORD || "");
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || "4000";
  const database = process.env.DB_NAME;
  const sslMode = process.env.DB_SSL === "false" ? "" : "?sslaccept=strict";

  return `mysql://${user}:${password}@${host}:${port}/${database}${sslMode}`;
};

const prisma = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl() } },
});

module.exports = prisma;

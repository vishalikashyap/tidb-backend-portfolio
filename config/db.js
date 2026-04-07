require("dotenv").config();
// config/db.js
const mysql = require("mysql2/promise");

const parseBool = (value, defaultValue) => {
  if (value === undefined || value === null || value === "") return defaultValue;
  return String(value).toLowerCase() === "true";
};

const dbPort = process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined;
const rejectUnauthorized = parseBool(
  process.env.DB_SSL_REJECT_UNAUTHORIZED,
  true
);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: dbPort,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === "false" ? undefined : { rejectUnauthorized },
});

module.exports = pool;

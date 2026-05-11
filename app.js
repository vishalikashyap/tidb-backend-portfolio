const express = require("express");
const cors = require("cors");

const app = express();

const parseOrigins = (value) =>
  String(value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const corsOrigin =
  process.env.CORS_ORIGIN && parseOrigins(process.env.CORS_ORIGIN).length > 0
    ? parseOrigins(process.env.CORS_ORIGIN)
    : true;

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("Backend is running");
});

// Import routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/user"));
app.use("/api/portfolio", require("./routes/portfolio"));
app.use("/api/contact", require("./routes/contact"));
app.use("/api/feedback", require("./routes/feedback"));
app.use("/api/stats", require("./routes/stats"));

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

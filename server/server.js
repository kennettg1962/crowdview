require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();

const allowedOrigins = [
  "http://localhost:4173", // Vite preview
  "http://localhost:5173", // Vite dev
  "http://localhost:3000", // Alternative dev
  "https://crowdview.tv", // Production URL
  "https://www.crowdview.tv", // Production URL with www
  process.env.CLIENT_URL, // Production URL from env
].filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/friends", require("./routes/friends"));
app.use("/api/media", require("./routes/media"));
app.use("/api/devices", require("./routes/devices"));
app.use("/api/rekognition", require("./routes/rekognition"));
app.use("/api/stream",     require("./routes/stream"));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Ensure Rekognition collection exists at startup (non-fatal if AWS not configured)
require("./rekognition").ensureCollection().catch(console.error);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`CrowdView API running on port ${PORT}`));

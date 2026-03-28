require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();

const allowedOrigins = [
  "http://localhost:4173",       // Vite preview
  "http://localhost:5173",       // Vite dev
  "http://localhost:3000",       // Alternative dev
  "https://crowdview.tv",        // Production
  "https://www.crowdview.tv",    // Production www
  "capacitor://localhost",       // Capacitor iOS
  "https://localhost",           // Capacitor iOS (WKWebView secure)
  "http://localhost",            // Capacitor Android
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const auth          = require("./middleware/auth");
const notBackOffice = require("./middleware/notBackOffice");

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users",       auth, notBackOffice, require("./routes/users"));
app.use("/api/friends", require("./routes/friends"));
app.use("/api/media",        auth, notBackOffice, require("./routes/media"));
app.use("/api/devices",      auth, notBackOffice, require("./routes/devices"));
app.use("/api/rekognition", require("./routes/rekognition"));
app.use("/api/stream",     require("./routes/stream"));
app.use("/api/corporate",  require("./routes/corporate"));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Ensure Rekognition collection exists at startup (non-fatal if AWS not configured)
require("./rekognition").ensureCollection().catch(console.error);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`CrowdView API running on port ${PORT}`));

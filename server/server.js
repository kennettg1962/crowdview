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
app.use("/api/corporate",     require("./routes/corporate"));
app.use("/api/operations",    require("./routes/operations"));
app.use("/api/subscription",  require("./routes/subscription").router);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Ensure Rekognition collection exists at startup (non-fatal if AWS not configured)
require("./rekognition").ensureCollection().catch(console.error);

// ── Detection-count flush — batch-write accumulated counts to DB every 30 s ──
// Avoids a DB write on every 300 ms rekognition call.
// Month/year counts auto-reset when the calendar rolls over.
(function startDetectFlush() {
  const pool = require('./db/connection');
  const { pendingDetectFlush } = require('./activity');

  setInterval(async () => {
    if (pendingDetectFlush.size === 0) return;
    const batch = new Map(pendingDetectFlush);
    pendingDetectFlush.clear();

    const now      = new Date();
    const monthRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const yearRef  = String(now.getFullYear());

    for (const [userId, count] of batch) {
      try {
        await pool.execute(
          `UPDATE User SET
             Detect_Month_Count = IF(Detect_Month_Ref = ?, Detect_Month_Count + ?, ?),
             Detect_Month_Ref   = ?,
             Detect_Year_Count  = IF(Detect_Year_Ref  = ?, Detect_Year_Count  + ?, ?),
             Detect_Year_Ref    = ?
           WHERE User_Id = ?`,
          [monthRef, count, count, monthRef,
           yearRef,  count, count, yearRef,
           userId]
        );
      } catch (err) {
        console.error('[detect flush] DB error for user', userId, err.message);
      }
    }
  }, 30_000);
})();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`CrowdView API running on port ${PORT}`));

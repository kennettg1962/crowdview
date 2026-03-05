const mysql = require("mysql2/promise");
const fs = require("fs/promises");
const path = require("path");
require("dotenv").config();

async function runMigrations() {
  console.log("Starting database migration...");

  // Connect without a specific database to ensure we can create it if it doesn't exist
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  let connection;

  try {
    connection = await pool.getConnection();

    // 1. Run schema.sql
    const schemaPath = path.join(__dirname, "schema.sql");
    try {
      const schemaSql = await fs.readFile(schemaPath, "utf8");
      console.log("Executing schema.sql...");
      await connection.query(schemaSql);
      console.log("✅ Schema migration completed successfully.");
    } catch (err) {
      if (err.code === "ENOENT") {
        console.warn("⚠️ schema.sql not found at", schemaPath);
      } else {
        throw new Error(`Failed to execute schema.sql: ${err.message}`);
      }
    }

    // 2. Run optional seed.sql
    const seedPath = path.join(__dirname, "seed.sql");
    try {
      const seedSql = await fs.readFile(seedPath, "utf8");
      if (seedSql.trim().length > 0) {
        console.log("Executing seed.sql...");
        await connection.query(seedSql);
        console.log("✅ Data seeding completed successfully.");
      }
    } catch (err) {
      if (err.code === "ENOENT") {
        console.log("ℹ️ No seed.sql found. Skipping seeding process.");
      } else {
        throw new Error(`Failed to execute seed.sql: ${err.message}`);
      }
    }

    console.log("🎉 All migrations finished successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    await pool.end();
  }
}

runMigrations();

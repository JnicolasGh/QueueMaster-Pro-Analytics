import express from "express";
import { createServer as createViteServer } from "vite";
import { Pool } from "pg";
import path from "path";
import fs from "fs";

const app = express();
const PORT = 3000;

app.use(express.json());

// Database configuration storage (simple local file for persistence of config)
const CONFIG_PATH = path.resolve(process.cwd(), "db_config.json");

interface DbConfig {
  connectionString?: string;
  usePostgres: boolean;
}

let dbConfig: DbConfig = { usePostgres: false };
if (fs.existsSync(CONFIG_PATH)) {
  dbConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

let pool: Pool | null = null;

function initPool() {
  if (dbConfig.usePostgres && dbConfig.connectionString) {
    console.log("Initializing Postgres Pool...");
    pool = new Pool({
      connectionString: dbConfig.connectionString,
      ssl: { rejectUnauthorized: false } // Common for cloud DBs
    });
  } else {
    pool = null;
  }
}

initPool();

// API Routes
app.get("/api/config", (req, res) => {
  res.json(dbConfig);
});

app.post("/api/config", (req, res) => {
  dbConfig = req.body;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(dbConfig));
  initPool();
  res.json({ status: "ok" });
});

// For this demo, we'll still use a local state or SQLite if Postgres isn't ready
// But the user wants Postgres, so we'll implement the routes to try Postgres first

app.get("/api/tickets", async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query("SELECT * FROM tickets ORDER BY created_at DESC");
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  } else {
    res.json([]); // Fallback or empty
  }
});

app.post("/api/tickets", async (req, res) => {
  const ticket = req.body;
  if (pool) {
    try {
      await pool.query(
        "INSERT INTO tickets (id, display_id, category_id, sub_category_id, customer_document, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [ticket.id, ticket.displayId, ticket.categoryId, ticket.subCategoryId, ticket.customerDocument, ticket.status, ticket.createdAt]
      );
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  } else {
    res.json({ status: "ok", warning: "No database connected" });
  }
});

app.put("/api/tickets/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  if (pool) {
    try {
      const keys = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = keys.map((key, i) => `${key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)} = $${i + 2}`).join(", ");
      await pool.query(`UPDATE tickets SET ${setClause} WHERE id = $1`, [id, ...values]);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  } else {
    res.json({ status: "ok" });
  }
});

// Initialize DB table if using Postgres
app.post("/api/setup-db", async (req, res) => {
  if (pool) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tickets (
          id TEXT PRIMARY KEY,
          display_id TEXT,
          category_id TEXT,
          sub_category_id TEXT,
          customer_document TEXT,
          status TEXT,
          created_at BIGINT,
          called_at BIGINT,
          started_at BIGINT,
          completed_at BIGINT,
          counter_id INTEGER
        )
      `);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  } else {
    res.status(400).json({ error: "Postgres not configured" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

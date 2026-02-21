import express from "express";
import { createServer as createViteServer } from "vite";
import { Pool } from "pg";
import path from "path";
import fs from "fs";

const app = express();
const PORT = 3000;

app.use(express.json());

// Database configuration storage
const CONFIG_PATH = path.resolve(process.cwd(), "db_config.json");

interface DbConfig {
  connectionString?: string;
  usePostgres: boolean;
}

let dbConfig: DbConfig = { 
  usePostgres: !!process.env.DATABASE_URL, 
  connectionString: process.env.DATABASE_URL 
};

if (fs.existsSync(CONFIG_PATH)) {
  const savedConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  dbConfig = { ...dbConfig, ...savedConfig };
}

let pool: Pool | null = null;

async function initDb() {
  if (pool) {
    try {
      console.log("Checking/Creating database tables...");
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
        );

        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE,
          password TEXT,
          role TEXT,
          name TEXT
        );
      `);

      // Seed default users
      console.log("Ensuring default users exist...");
      const defaultUsers = [
        ['u1', 'admin', 'admin123', 'admin', 'Administrador'],
        ['u2', 'kiosco', 'kiosco123', 'kiosk', 'Kiosco Principal'],
        ['u3', 'pantalla', 'pantalla123', 'display', 'Pantalla Sala'],
        ['u4', 'asesor1', 'asesor123', 'advisor', 'Asesor Juan'],
      ];
      for (const u of defaultUsers) {
        await pool.query("INSERT INTO users (id, username, password, role, name) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username) DO NOTHING", u);
      }
      console.log("Database tables ready.");
    } catch (err) {
      console.error("Error initializing database tables:", err);
    }
  }
}

async function initPool() {
  const connStr = dbConfig.connectionString || process.env.DATABASE_URL;
  
  if (pool) {
    console.log("Closing existing database pool...");
    await pool.end();
    pool = null;
  }

  if (dbConfig.usePostgres && connStr) {
    console.log("Initializing Postgres Pool...");
    try {
      pool = new Pool({
        connectionString: connStr,
        ssl: (connStr.includes('localhost') || connStr.includes('127.0.0.1')) ? false : { rejectUnauthorized: false }
      });
      
      pool.on('error', (err) => {
        console.error('Unexpected error on idle database client', err);
      });

      // Test connection
      const client = await pool.connect();
      console.log("Database connection successful.");
      client.release();
      
      await initDb();
    } catch (err) {
      console.error("Failed to connect to the database:", (err as Error).message);
      pool = null;
    }
  } else {
    console.log("PostgreSQL is disabled or no connection string provided.");
    pool = null;
  }
}

// Initial pool setup
initPool().catch(err => console.error("Initial DB pool setup failed:", err));

// API Routes
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (pool) {
    try {
      const result = await pool.query("SELECT id, username, role, name FROM users WHERE username = $1 AND password = $2", [username, password]);
      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.status(401).json({ error: "Credenciales inválidas" });
      }
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  } else {
    // Simple mock for local testing without DB
    if (username === 'admin' && password === 'admin123') {
      res.json({ id: 'u1', username: 'admin', role: 'admin', name: 'Admin Local' });
    } else {
      res.status(401).json({ error: "Postgres no conectado y credenciales inválidas" });
    }
  }
});

app.get("/api/users", async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query("SELECT id, username, role, name FROM users");
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  } else {
    res.json([{ id: 'u1', username: 'admin', role: 'admin', name: 'Admin Local' }]);
  }
});

app.post("/api/users", async (req, res) => {
  const { username, password, role, name } = req.body;
  if (pool) {
    try {
      const id = crypto.randomUUID();
      await pool.query("INSERT INTO users (id, username, password, role, name) VALUES ($1, $2, $3, $4, $5)", [id, username, password, role, name]);
      res.json({ id, username, role, name });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  } else {
    res.status(400).json({ error: "Postgres no conectado" });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  if (pool) {
    try {
      await pool.query("DELETE FROM users WHERE id = $1", [id]);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  } else {
    res.status(400).json({ error: "Postgres no conectado" });
  }
});

app.get("/api/config", (req, res) => {
  res.json(dbConfig);
});

app.post("/api/config", async (req, res) => {
  dbConfig = req.body;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(dbConfig));
  await initPool();
  res.json({ status: "ok" });
});

// For this demo, we'll still use a local state or SQLite if Postgres isn't ready
// But the user wants Postgres, so we'll implement the routes to try Postgres first

// Helper to map DB row to Ticket object
const mapTicket = (row: any) => ({
  id: row.id,
  displayId: row.display_id,
  categoryId: row.category_id,
  subCategoryId: row.sub_category_id,
  customerDocument: row.customer_document,
  status: row.status,
  createdAt: row.created_at ? Number(row.created_at) : undefined,
  calledAt: row.called_at ? Number(row.called_at) : undefined,
  startedAt: row.started_at ? Number(row.started_at) : undefined,
  completedAt: row.completed_at ? Number(row.completed_at) : undefined,
  counterId: row.counter_id
});

app.get("/api/tickets", async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query("SELECT * FROM tickets ORDER BY created_at DESC");
      res.json(result.rows.map(mapTicket));
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

app.post("/api/tickets/bulk", async (req, res) => {
  const tickets = req.body;
  if (pool) {
    try {
      // Simple loop for now, but in a real app we'd use a single multi-row INSERT
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const ticket of tickets) {
          await client.query(
            "INSERT INTO tickets (id, display_id, category_id, sub_category_id, customer_document, status, created_at, called_at, started_at, completed_at, counter_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING",
            [ticket.id, ticket.displayId, ticket.categoryId, ticket.subCategoryId, ticket.customerDocument, ticket.status, ticket.createdAt, ticket.calledAt, ticket.startedAt, ticket.completedAt, ticket.counterId]
          );
        }
        await client.query('COMMIT');
        res.json({ status: "ok", count: tickets.length });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
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
        );
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE,
          password TEXT,
          role TEXT,
          name TEXT
        );
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

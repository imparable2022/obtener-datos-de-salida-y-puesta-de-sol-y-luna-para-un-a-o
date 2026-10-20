import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from 'better-sqlite3';
import { mapUsnoOneDayResponse } from './usno.js';

// Initialize DB safely
const dbPath = path.join(process.cwd(), 'solar_moon_data.db');
const db = new Database(dbPath);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_data (
    date TEXT PRIMARY KEY,
    begin_civil_twilight TEXT,
    sunrise TEXT,
    sun_transit TEXT,
    sunset TEXT,
    end_civil_twilight TEXT,
    day_length TEXT,
    visible_light_length TEXT,
    moonrise TEXT,
    moonset TEXT,
    moon_illumination TEXT,
    moon_phase TEXT,
    next_moon_phase TEXT
  )
`);

// USNO's documented GeoJSON endpoint for daily Sun and Moon data.
const USNO_API_URL = "https://aa.usno.navy.mil/api/rstt/oneday";
const LAT = "-29.15";
const LON = "-59.65";
const TZ = "-3";

// Keep the request rate low while retaining one official API request per day.
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchDayFromUsnoApi(date: Date) {
  const dateStr = date.toISOString().split('T')[0];
  const parameters = new URLSearchParams({
    date: dateStr,
    coords: `${LAT},${LON}`,
    tz: TZ,
    dst: 'false',
  });

  try {
    const response = await fetch(`${USNO_API_URL}?${parameters}`);
    if (!response.ok) {
      throw new Error(`USNO API returned ${response.status} ${response.statusText}`);
    }

    return mapUsnoOneDayResponse(dateStr, await response.json());
  } catch (error) {
    console.error(`Error fetching USNO API data for ${dateStr}:`, error);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // DEBUG LOGGING: Log every request hitting the server
  app.use((req, res, next) => {
    console.log(`[SERVER REQUEST] ${req.method} ${req.url}`);
    next();
  });

  // Test route to verify API is working
  app.get("/api/ping", (req, res) => {
    console.log("[SERVER] /api/ping hit");
    res.json({ status: "ok", message: "Pong!" });
  });

  // API Routes - Defined directly on app to avoid Router issues
  app.get("/api/status", (req, res) => {
    console.log(`[SERVER] /api/status called with query:`, req.query);
    try {
      const { year } = req.query;
      let query = 'SELECT COUNT(*) as count FROM daily_data';
      const params: any[] = [];

      if (year) {
        query += ' WHERE date LIKE ?';
        params.push(`${year}-%`);
      }

      const count = db.prepare(query).get(...params) as { count: number };
      
      // Calculate total days in that year
      const targetYear = year ? parseInt(String(year)) : new Date().getFullYear();
      const isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
      const total = isLeap ? 366 : 365;

      res.json({ count: count.count, total });
    } catch (error) {
      console.error("[SERVER ERROR] /api/status:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/data", (req, res) => {
    console.log(`[SERVER] /api/data called with query:`, req.query);
    try {
      const { month, year } = req.query;
      let query = 'SELECT * FROM daily_data';
      const params: any[] = [];
      
      const targetYear = year || new Date().getFullYear();

      if (month) {
        const monthStr = String(month).padStart(2, '0');
        query += ` WHERE date LIKE ? ORDER BY date ASC`;
        params.push(`${targetYear}-${monthStr}-%`);
      } else {
        query += ` WHERE date LIKE ? ORDER BY date ASC`;
        params.push(`${targetYear}-%`);
      }

      const rows = db.prepare(query).all(...params);
      res.json(rows);
    } catch (error) {
      console.error("[SERVER ERROR] /api/data:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/debug/dump", (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM daily_data LIMIT 10').all();
      console.log("[SERVER] DB Dump (first 10 rows):", rows);
      res.json(rows);
    } catch (error) {
      console.error("[SERVER ERROR] /api/debug/dump:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/scrape", async (req, res) => {
    console.log(`[SERVER] /api/scrape called with body:`, req.body);
    try {
      const { year } = req.body;
      const targetYear = year ? parseInt(year) : 2026;

      const count = db.prepare('SELECT COUNT(*) as count FROM daily_data WHERE date LIKE ?').get(`${targetYear}-%`) as { count: number };
      const isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
      const totalDays = isLeap ? 366 : 365;

      if (count.count >= totalDays) {
        console.log(`[SERVER] Data for ${targetYear} already complete.`);
        return res.json({ message: `Data for ${targetYear} is already collected`, complete: true });
      }

      res.json({ message: `USNO API collection started for ${targetYear}`, complete: false });

      console.log(`[SERVER] Starting background USNO API collection for ${targetYear}...`);
      
      const startDate = new Date(`${targetYear}-01-01`);
      const endDate = new Date(`${targetYear}-12-31`);
      
      const dates: Date[] = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
      }

      const CHUNK_SIZE = 5;
      for (let i = 0; i < dates.length; i += CHUNK_SIZE) {
        const chunk = dates.slice(i, i + CHUNK_SIZE);
        
        await Promise.all(chunk.map(async (date) => {
          const dateStr = date.toISOString().split('T')[0];
          
          // Check if exists
          const exists = db.prepare('SELECT 1 FROM daily_data WHERE date = ?').get(dateStr);
          if (exists) {
            // console.log(`[SERVER] Skipping ${dateStr} (already exists)`);
            return;
          }

          console.log(`[SERVER] Fetching USNO API data for ${dateStr}...`);
          const data = await fetchDayFromUsnoApi(date);
          
          if (data) {
            try {
              const stmt = db.prepare(`
                INSERT OR REPLACE INTO daily_data (
                  date, begin_civil_twilight, sunrise, sun_transit, sunset, end_civil_twilight,
                  day_length, visible_light_length, moonrise, moonset, moon_illumination, moon_phase, next_moon_phase
                ) VALUES (
                  @date, @begin_civil_twilight, @sunrise, @sun_transit, @sunset, @end_civil_twilight,
                  @day_length, @visible_light_length, @moonrise, @moonset, @moon_illumination, @moon_phase, @next_moon_phase
                )
              `);
              stmt.run(data);
              console.log(`[SERVER] SUCCESS: Saved data for ${dateStr}`);
            } catch (dbError) {
              console.error(`[SERVER] DB Error saving ${dateStr}:`, dbError);
            }
          } else {
            console.error(`[SERVER] Failed to fetch USNO API data for ${dateStr}`);
          }
        }));

        await delay(1000);
      }
      console.log(`[SERVER] USNO API collection finished for ${targetYear}`);
    } catch (error) {
      console.error("[SERVER ERROR] /api/scrape:", error);
      // Response already sent
    }
  });

  app.post("/api/records", (req, res) => {
    try {
      const data = req.body;
      const stmt = db.prepare(`
        INSERT INTO daily_data (
          date, begin_civil_twilight, sunrise, sun_transit, sunset, end_civil_twilight,
          day_length, visible_light_length, moonrise, moonset, moon_illumination, moon_phase, next_moon_phase
        ) VALUES (
          @date, @begin_civil_twilight, @sunrise, @sun_transit, @sunset, @end_civil_twilight,
          @day_length, @visible_light_length, @moonrise, @moonset, @moon_illumination, @moon_phase, @next_moon_phase
        )
      `);
      stmt.run(data);
      res.json({ success: true });
    } catch (error) {
      console.error("[SERVER ERROR] POST /api/records:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.put("/api/records/:date", (req, res) => {
    try {
      const { date } = req.params;
      const data = { ...req.body, date };
      const stmt = db.prepare(`
        UPDATE daily_data SET
          begin_civil_twilight = @begin_civil_twilight,
          sunrise = @sunrise,
          sun_transit = @sun_transit,
          sunset = @sunset,
          end_civil_twilight = @end_civil_twilight,
          day_length = @day_length,
          visible_light_length = @visible_light_length,
          moonrise = @moonrise,
          moonset = @moonset,
          moon_illumination = @moon_illumination,
          moon_phase = @moon_phase,
          next_moon_phase = @next_moon_phase
        WHERE date = @date
      `);
      stmt.run(data);
      res.json({ success: true });
    } catch (error) {
      console.error("[SERVER ERROR] PUT /api/records/:date:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.delete("/api/records/all", (req, res) => {
    try {
      const stmt = db.prepare('DELETE FROM daily_data');
      stmt.run();
      res.json({ success: true });
    } catch (error) {
      console.error("[SERVER ERROR] DELETE /api/records/all:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.delete("/api/records/:date", (req, res) => {
    try {
      const { date } = req.params;
      const stmt = db.prepare('DELETE FROM daily_data WHERE date = ?');
      stmt.run(date);
      res.json({ success: true });
    } catch (error) {
      console.error("[SERVER ERROR] DELETE /api/records/:date:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.delete("/api/records/year/:year", (req, res) => {
    try {
      const { year } = req.params;
      const stmt = db.prepare('DELETE FROM daily_data WHERE date LIKE ?');
      stmt.run(`${year}-%`);
      res.json({ success: true });
    } catch (error) {
      console.error("[SERVER ERROR] DELETE /api/records/year/:year:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.delete("/api/records/month/:year/:month", (req, res) => {
    try {
      const { year, month } = req.params;
      const monthStr = month.padStart(2, '0');
      const stmt = db.prepare('DELETE FROM daily_data WHERE date LIKE ?');
      stmt.run(`${year}-${monthStr}-%`);
      res.json({ success: true });
    } catch (error) {
      console.error("[SERVER ERROR] DELETE /api/records/month/:year/:month:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

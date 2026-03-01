import express from "express";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import path from "path";
import Database from 'better-sqlite3';

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

// Constants for the scraping target
const BASE_URL = "https://aa.usno.navy.mil/calculated/rstt/oneday";
const LAT = "-29.15";
const LON = "-59.65";
const LABEL = "Reconquista, Santa Fe, Argentina";
const TZ = "3";
const TZ_SIGN = "-1";

// Helper to delay requests
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to parse time string "HH:MM" to minutes for calculation
function timeToMinutes(timeStr: string): number | null {
  if (!timeStr || !timeStr.includes(':')) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Helper to format minutes back to "HH:mm" or "Xh Ym"
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

async function scrapeDay(date: Date) {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const url = `${BASE_URL}?date=${dateStr}&lat=${LAT}&lon=${LON}&label=${encodeURIComponent(LABEL)}&tz=${TZ}&tz_sign=${TZ_SIGN}&tz_label=false&dst=false&submit=Obtener+datos`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    const data: any = {
      date: dateStr,
      begin_civil_twilight: '',
      sunrise: '',
      sun_transit: '',
      sunset: '',
      end_civil_twilight: '',
      moonrise: '',
      moonset: '',
      moon_illumination: '',
      moon_phase: '',
      next_moon_phase: ''
    };

    // Parse Table Data
    let currentSection = '';
    $('table tr').each((_, row) => {
      const th = $(row).find('th');
      if (th.length > 0) {
        const headerText = th.text().trim();
        if (headerText.includes('Sun')) currentSection = 'Sun';
        if (headerText.includes('Moon')) currentSection = 'Moon';
      }

      const cells = $(row).find('td');
      if (cells.length >= 2) {
        const label = $(cells[0]).text().trim();
        const value = $(cells[1]).text().trim();

        if (currentSection === 'Sun') {
          if (label.includes('Begin Civil Twilight')) data.begin_civil_twilight = value;
          if (label.includes('Rise')) data.sunrise = value;
          if (label.includes('Upper Transit')) data.sun_transit = value;
          if (label.includes('Set')) data.sunset = value;
          if (label.includes('End Civil Twilight')) data.end_civil_twilight = value;
        } else if (currentSection === 'Moon') {
          if (label.includes('Rise')) data.moonrise = value;
          if (label.includes('Set')) data.moonset = value;
        }
      }
    });

    // Parse Paragraph Data
    const textContent = $('div').text(); // Get all text to search regex
    
    // Phase and Illumination
    const phaseRegex = /Phase of the moon on .*?: (.*?) with (\d+)%/;
    const phaseMatch = textContent.match(phaseRegex);
    if (phaseMatch) {
      data.moon_phase = phaseMatch[1].trim();
      data.moon_illumination = phaseMatch[2] + '%';
    }

    // Next Primary Phase
    const nextPhaseRegex = /Closest Primary Moon Phase: (.*?)(\n|$)/;
    const nextPhaseMatch = textContent.match(nextPhaseRegex);
    if (nextPhaseMatch) {
      data.next_moon_phase = nextPhaseMatch[1].trim();
    }

    // Calculations
    if (data.sunrise && data.sunset) {
      const riseMin = timeToMinutes(data.sunrise);
      const setMin = timeToMinutes(data.sunset);
      if (riseMin !== null && setMin !== null) {
        let diff = setMin - riseMin;
        if (diff < 0) diff += 24 * 60; // Handle crossing midnight
        data.day_length = formatDuration(diff);
      }
    }

    if (data.begin_civil_twilight && data.end_civil_twilight) {
      const startMin = timeToMinutes(data.begin_civil_twilight);
      const endMin = timeToMinutes(data.end_civil_twilight);
      if (startMin !== null && endMin !== null) {
        let diff = endMin - startMin;
        if (diff < 0) diff += 24 * 60;
        data.visible_light_length = formatDuration(diff);
      }
    }

    return data;

  } catch (error) {
    console.error(`Error scraping ${dateStr}:`, error);
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
        return res.json({ message: `Data for ${targetYear} already scraped`, complete: true });
      }

      res.json({ message: `Scraping started for ${targetYear}`, complete: false });

      console.log(`[SERVER] Starting background scraping for ${targetYear}...`);
      
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

          console.log(`[SERVER] Scraping ${dateStr}...`);
          const data = await scrapeDay(date);
          
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
            console.error(`[SERVER] Failed to scrape data for ${dateStr} (scrapeDay returned null)`);
          }
        }));

        await delay(1000);
      }
      console.log(`[SERVER] Scraping finished for ${targetYear}`);
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

import Database from 'better-sqlite3';

const db = new Database('solar_moon_data.db');

// Initialize database
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

export default db;

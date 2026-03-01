
import * as cheerio from "cheerio";

const BASE_URL = "https://aa.usno.navy.mil/calculated/rstt/oneday";
const LAT = "-29.15";
const LON = "-59.65";
const LABEL = "Reconquista, Santa Fe, Argentina";
const TZ = "3";
const TZ_SIGN = "-1";

async function testScrape() {
  const dateStr = "2026-01-01";
  const url = `${BASE_URL}?date=${dateStr}&lat=${LAT}&lon=${LON}&label=${encodeURIComponent(LABEL)}&tz=${TZ}&tz_sign=${TZ_SIGN}&tz_label=false&dst=false&submit=Obtener+datos`;

  console.log("Fetching URL:", url);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    console.log("Response Status:", response.status);
    const html = await response.text();
    console.log("HTML Length:", html.length);
    
    const $ = cheerio.load(html);
    const tableRows = $('table tr').length;
    console.log("Table Rows found:", tableRows);

    if (tableRows === 0) {
        console.log("Preview of HTML:");
        console.log(html.substring(0, 500));
    }

    // Try parsing
    let currentSection = '';
    const data: any = {};
    
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
        console.log(`Found row: [${currentSection}] ${label} = ${value}`);
      }
    });

  } catch (error) {
    console.error("Error:", error);
  }
}

testScrape();

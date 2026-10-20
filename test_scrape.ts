import { mapUsnoOneDayResponse } from './usno.js';

const USNO_API_URL = 'https://aa.usno.navy.mil/api/rstt/oneday';
const date = '2026-01-01';
const parameters = new URLSearchParams({
  date,
  coords: '-29.15,-59.65',
  tz: '-3',
  dst: 'false',
});

async function testUsnoApi() {
  const url = `${USNO_API_URL}?${parameters}`;
  console.log('Fetching USNO API URL:', url);

  try {
    const response = await fetch(url);
    console.log('Response status:', response.status);
    if (!response.ok) throw new Error(`USNO API returned ${response.status} ${response.statusText}`);

    const dailyData = mapUsnoOneDayResponse(date, await response.json());
    console.log('Mapped daily data:', dailyData);
  } catch (error) {
    console.error('USNO API test failed:', error);
    process.exitCode = 1;
  }
}

void testUsnoApi();

import assert from 'node:assert/strict';
import test from 'node:test';
import { mapUsnoOneDayResponse } from '../usno.js';

test('maps the USNO daily GeoJSON response into the SQLite row shape', () => {
  const dailyData = mapUsnoOneDayResponse('2026-01-01', {
    properties: {
      data: {
        sundata: [
          { phen: 'Begin Civil Twilight', time: '05:46' },
          { phen: 'Rise', time: '06:10' },
          { phen: 'Upper Transit', time: '12:43' },
          { phen: 'Set', time: '19:16' },
          { phen: 'End Civil Twilight', time: '19:40' },
        ],
        moondata: [
          { phen: 'Rise', time: '18:23' },
          { phen: 'Set', time: '05:18' },
        ],
        curphase: 'Waxing crescent',
        fracillum: '15%',
        closestphase: { phase: 'First Quarter', year: 2026, month: 1, day: 5, time: '21:55' },
      },
    },
  });

  assert.deepEqual(dailyData, {
    date: '2026-01-01',
    begin_civil_twilight: '05:46',
    sunrise: '06:10',
    sun_transit: '12:43',
    sunset: '19:16',
    end_civil_twilight: '19:40',
    day_length: '13h 6m',
    visible_light_length: '13h 54m',
    moonrise: '18:23',
    moonset: '05:18',
    moon_illumination: '15%',
    moon_phase: 'Waxing crescent',
    next_moon_phase: 'First Quarter on 5 January 2026 21:55',
  });
});

test('fails clearly for an invalid USNO response', () => {
  assert.throws(
    () => mapUsnoOneDayResponse('2026-01-01', {}),
    /missing properties\.data/,
  );
});

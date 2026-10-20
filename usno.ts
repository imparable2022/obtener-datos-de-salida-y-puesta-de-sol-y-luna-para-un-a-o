export interface DailyData {
  date: string;
  begin_civil_twilight: string;
  sunrise: string;
  sun_transit: string;
  sunset: string;
  end_civil_twilight: string;
  day_length: string;
  visible_light_length: string;
  moonrise: string;
  moonset: string;
  moon_illumination: string;
  moon_phase: string;
  next_moon_phase: string;
}

interface UsnoEvent {
  phen?: string;
  time?: string | null;
}

interface UsnoOneDayResponse {
  properties?: {
    data?: {
      sundata?: UsnoEvent[];
      moondata?: UsnoEvent[];
      curphase?: string | null;
      fracillum?: string | number | null;
      closestphase?: {
        phase?: string;
        year?: number;
        month?: number;
        day?: number;
        time?: string;
      } | null;
    };
  };
}

function timeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function eventTime(events: UsnoEvent[] | undefined, eventName: string): string {
  const event = events?.find(({ phen }) => phen?.trim().toLowerCase() === eventName);
  return event?.time ?? '';
}

function duration(start: string, end: string): string {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return '';

  const difference = (endMinutes - startMinutes + 24 * 60) % (24 * 60);
  return formatDuration(difference);
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function closestPhaseText(phase: NonNullable<NonNullable<UsnoOneDayResponse['properties']>['data']>['closestphase']): string {
  if (!phase?.phase || !phase.year || !phase.month || !phase.day || !monthNames[phase.month - 1]) return '';
  return `${phase.phase} on ${phase.day} ${monthNames[phase.month - 1]} ${phase.year}${phase.time ? ` ${phase.time}` : ''}`;
}

export function mapUsnoOneDayResponse(date: string, response: UsnoOneDayResponse): DailyData {
  const source = response.properties?.data;
  if (!source) throw new Error('USNO API response is missing properties.data');

  const beginCivilTwilight = eventTime(source.sundata, 'begin civil twilight');
  const sunrise = eventTime(source.sundata, 'rise');
  const sunTransit = eventTime(source.sundata, 'upper transit');
  const sunset = eventTime(source.sundata, 'set');
  const endCivilTwilight = eventTime(source.sundata, 'end civil twilight');
  const moonrise = eventTime(source.moondata, 'rise');
  const moonset = eventTime(source.moondata, 'set');
  const illumination = source.fracillum === null || source.fracillum === undefined ? '' : String(source.fracillum);

  return {
    date,
    begin_civil_twilight: beginCivilTwilight,
    sunrise,
    sun_transit: sunTransit,
    sunset,
    end_civil_twilight: endCivilTwilight,
    day_length: duration(sunrise, sunset),
    visible_light_length: duration(beginCivilTwilight, endCivilTwilight),
    moonrise,
    moonset,
    moon_illumination: illumination && illumination.endsWith('%') ? illumination : illumination ? `${illumination}%` : '',
    moon_phase: source.curphase ?? '',
    next_moon_phase: closestPhaseText(source.closestphase),
  };
}

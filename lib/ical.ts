import type { Trip, Activity } from '@/types';

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** Fold lines longer than 75 octets per RFC 5545 Section 3.1 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let i = 75;
  while (i < line.length) {
    parts.push(' ' + line.slice(i, i + 74));
    i += 74;
  }
  return parts.join('\r\n');
}

function formatDateForICal(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function formatDateTimeUTC(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  const min = String(now.getUTCMinutes()).padStart(2, '0');
  const s = String(now.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

/** Per RFC 5545, DTEND for all-day events is the day AFTER the last day */
function dayAfter(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function generateUID(id: string): string {
  return `${id}@traveltrack`;
}

export function generateICalEvent(trip: Trip, activities?: Activity[]): string {
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${generateUID(trip.id)}`,
    `DTSTAMP:${formatDateTimeUTC()}`,
    `DTSTART;VALUE=DATE:${formatDateForICal(trip.startDate)}`,
    `DTEND;VALUE=DATE:${dayAfter(trip.endDate)}`,
    `SUMMARY:${escapeICalText(trip.title)}`,
  ];

  if (trip.destination || trip.country) {
    lines.push(`LOCATION:${escapeICalText([trip.destination, trip.country].filter(Boolean).join(', '))}`);
  }

  let description = trip.description || '';
  if (activities && activities.length > 0) {
    const activitySummary = activities
      .map((a) => `- ${a.date}: ${a.title}${a.location ? ` (${a.location})` : ''}`)
      .join('\n');
    description = description
      ? `${description}\n\nActivities:\n${activitySummary}`
      : `Activities:\n${activitySummary}`;
  }

  if (description) {
    lines.push(`DESCRIPTION:${escapeICalText(description)}`);
  }

  lines.push(`STATUS:${trip.status === 'completed' ? 'CONFIRMED' : 'TENTATIVE'}`);
  lines.push('END:VEVENT');

  return lines.map(foldLine).join('\r\n');
}

export function generateICalFile(trips: Trip[], activitiesByTrip?: Record<string, Activity[]>): string {
  const events = trips.map((trip) =>
    generateICalEvent(trip, activitiesByTrip?.[trip.id])
  );

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Travel Track//Travel Track v1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ];

  return lines.join('\r\n') + '\r\n';
}

export function downloadICalFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

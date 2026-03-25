'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ToastProvider';
import { generateICalFile, downloadICalFile } from '@/lib/ical';
import { CalendarSkeleton } from '@/components/Skeletons';
import type { Trip, Activity } from '@/types';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  planned: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  ongoing: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  completed: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
};

function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay(); // 0=Sun
  const start = new Date(year, month, 1 - startOffset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const fetchTrips = useCallback(async () => {
    if (!user || !db) return;
    try {
      const tripsSnap = await getDocs(query(collection(db, 'trips'), where('userId', '==', user.uid)));
      setTrips(tripsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Trip)));
    } catch (err) {
      console.error('Error fetching trips:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchActivities = useCallback(async () => {
    if (!user || !db) return;
    const days = getCalendarDays(currentMonth.year, currentMonth.month);
    const startStr = toDateStr(days[0]);
    const endStr = toDateStr(days[days.length - 1]);
    try {
      const activitiesSnap = await getDocs(
        query(
          collection(db, 'activities'),
          where('userId', '==', user.uid),
          where('date', '>=', startStr),
          where('date', '<=', endStr)
        )
      );
      setActivities(activitiesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Activity)));
    } catch (err) {
      console.error('Error fetching activities:', err);
    }
  }, [user, currentMonth.year, currentMonth.month]);

  useEffect(() => {
    if (user) fetchTrips();
  }, [user, fetchTrips]);

  useEffect(() => {
    if (user) fetchActivities();
  }, [user, fetchActivities]);

  const calendarDays = useMemo(
    () => getCalendarDays(currentMonth.year, currentMonth.month),
    [currentMonth.year, currentMonth.month]
  );

  const activitiesByDate = useMemo(() => {
    const map: Record<string, Activity[]> = {};
    for (const a of activities) {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    }
    return map;
  }, [activities]);


  function getTripsForDay(dateStr: string): Trip[] {
    return trips.filter((t) => t.startDate && t.endDate && t.startDate <= dateStr && t.endDate >= dateStr);
  }

  function prevMonth() {
    setCurrentMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  }

  function nextMonth() {
    setCurrentMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  }

  function goToToday() {
    const now = new Date();
    setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() });
  }

  async function fetchActivitiesForTrips(tripIds: string[]): Promise<Record<string, Activity[]>> {
    if (!user || !db || tripIds.length === 0) return {};
    const map: Record<string, Activity[]> = {};
    // Firestore 'in' queries support up to 30 values per batch
    for (let i = 0; i < tripIds.length; i += 30) {
      const batch = tripIds.slice(i, i + 30);
      const snap = await getDocs(
        query(
          collection(db, 'activities'),
          where('userId', '==', user.uid),
          where('tripId', 'in', batch)
        )
      );
      for (const doc of snap.docs) {
        const a = { id: doc.id, ...doc.data() } as Activity;
        if (!map[a.tripId]) map[a.tripId] = [];
        map[a.tripId].push(a);
      }
    }
    return map;
  }

  async function handleExportAll() {
    if (trips.length === 0) {
      toast.error('No trips to export');
      return;
    }
    const allActivities = await fetchActivitiesForTrips(trips.map((t) => t.id));
    const content = generateICalFile(trips, allActivities);
    downloadICalFile(content, 'travel-track-trips.ics');
    toast.success('Calendar exported!');
  }

  async function handleExportTrip(trip: Trip) {
    const tripActivities = await fetchActivitiesForTrips([trip.id]);
    const content = generateICalFile([trip], tripActivities);
    downloadICalFile(content, `${trip.title.replace(/[^a-zA-Z0-9]/g, '-')}.ics`);
    toast.success(`Exported "${trip.title}"`);
  }

  const today = new Date();
  const monthLabel = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-950">
        <div className="h-[65px] border-b border-gray-800 bg-gray-900/80" />
        <CalendarSkeleton />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="font-bold text-white text-lg">Travel Track</span>
            </div>
            {/* Nav */}
            <nav className="flex items-center gap-1">
              <Link href="/" className="px-3 py-1.5 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors">
                Trips
              </Link>
              <Link href="/map" className="px-3 py-1.5 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                World Map
              </Link>
              <span className="px-3 py-1.5 text-sm text-white bg-gray-800 rounded-lg font-medium flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Calendar
              </span>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportAll}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export .ics
            </button>
            <Link href="/profile" className="flex items-center hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-600 flex items-center justify-center shrink-0">
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-white">
                    {(user.displayName ?? user.email ?? '?')[0].toUpperCase()}
                  </span>
                )}
              </div>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">{monthLabel}</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={prevMonth}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-4">
          {[
            { label: 'Planned', color: 'bg-blue-400' },
            { label: 'Ongoing', color: 'bg-emerald-400' },
            { label: 'Completed', color: 'bg-amber-400' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
              <span className="text-xs text-gray-500">{item.label}</span>
            </div>
          ))}
        </div>

        {trips.length === 0 ? (
          <div className="rounded-2xl bg-gray-900 border border-gray-800 flex flex-col items-center justify-center gap-4 py-24">
            <div className="text-5xl">📅</div>
            <h2 className="text-white font-semibold text-lg">No trips to show</h2>
            <p className="text-gray-500 text-sm">Add trips to see them on the calendar.</p>
            <Link
              href="/"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Go to Trips
            </Link>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            {/* Day name headers */}
            <div className="grid grid-cols-7 border-b border-gray-800">
              {DAY_NAMES.map((day) => (
                <div key={day} className="px-2 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, i) => {
                const dateStr = toDateStr(day);
                const isCurrentMonth = day.getMonth() === currentMonth.month;
                const isToday = isSameDay(day, today);
                const dayTrips = getTripsForDay(dateStr);
                const dayActivities = activitiesByDate[dateStr] || [];

                return (
                  <div
                    key={i}
                    className={`min-h-[100px] border-b border-r border-gray-800 p-1.5 ${
                      !isCurrentMonth ? 'bg-gray-950/50' : ''
                    }`}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday
                            ? 'bg-emerald-500 text-white'
                            : isCurrentMonth
                            ? 'text-gray-300'
                            : 'text-gray-600'
                        }`}
                      >
                        {day.getDate()}
                      </span>
                      {dayActivities.length > 0 && (
                        <div className="flex gap-0.5">
                          {dayActivities.slice(0, 3).map((_, idx) => (
                            <div key={idx} className="w-1 h-1 rounded-full bg-gray-500" />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Trip pills */}
                    <div className="space-y-0.5">
                      {dayTrips.slice(0, 3).map((trip) => {
                        const colors = STATUS_COLORS[trip.status] || STATUS_COLORS.planned;
                        return (
                          <button
                            key={trip.id}
                            onClick={() => router.push(`/trips/${trip.id}`)}
                            title={`${trip.title} — ${trip.destination}`}
                            className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate ${colors.bg} ${colors.text} border ${colors.border} hover:opacity-80 transition-opacity group relative`}
                          >
                            {trip.title}
                            {/* Export icon on hover */}
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportTrip(trip);
                              }}
                              className="absolute right-0.5 top-1/2 -translate-y-1/2 hidden group-hover:inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-gray-800/80"
                            >
                              <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </span>
                          </button>
                        );
                      })}
                      {dayTrips.length > 3 && (
                        <span className="text-[10px] text-gray-500 pl-1">+{dayTrips.length - 3} more</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

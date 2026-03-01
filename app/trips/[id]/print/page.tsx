'use client';

import { useState, useEffect } from 'react';
import {
  doc, getDoc, collection, query, where, getDocs, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { useRouter, useParams } from 'next/navigation';
import type { Trip, Activity, ActivityType, PackingItem, Expense } from '@/types';

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  sightseeing: '🏛️', food: '🍜', transport: '✈️',
  accommodation: '🏨', adventure: '🧗', shopping: '🛍️', other: '📌',
};

const EXPENSE_ICONS: Record<string, string> = {
  accommodation: '🏨', food: '🍜', transport: '✈️', activities: '🎭',
  shopping: '🛍️', health: '💊', other: '📦',
};

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function groupByDate(activities: Activity[]): Record<string, Activity[]> {
  return activities.reduce((acc, a) => {
    if (!acc[a.date]) acc[a.date] = [];
    acc[a.date].push(a);
    return acc;
  }, {} as Record<string, Activity[]>);
}

export default function PrintPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [packingItems, setPackingItems] = useState<PackingItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !db) return;
    const load = async () => {
      const [tripDoc, actSnap, packSnap, expSnap, notesDoc] = await Promise.all([
        getDoc(doc(db!, 'trips', tripId)),
        getDocs(query(
          collection(db!, 'activities'),
          where('tripId', '==', tripId),
          where('userId', '==', user.uid),
          orderBy('date', 'asc'), orderBy('createdAt', 'asc')
        )),
        getDocs(query(
          collection(db!, 'packingItems'),
          where('tripId', '==', tripId),
          where('userId', '==', user.uid)
        )),
        getDocs(query(
          collection(db!, 'expenses'),
          where('tripId', '==', tripId),
          where('userId', '==', user.uid)
        )),
        getDoc(doc(db!, 'tripNotes', tripId)),
      ]);

      if (!tripDoc.exists() || tripDoc.data()?.userId !== user.uid) {
        router.push('/'); return;
      }
      setTrip({ id: tripDoc.id, ...tripDoc.data() } as Trip);
      setActivities(actSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Activity)));
      const packing = packSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PackingItem));
      packing.sort((a, b) => a.createdAt - b.createdAt);
      setPackingItems(packing);
      const exp = expSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));
      exp.sort((a, b) => a.date.localeCompare(b.date));
      setExpenses(exp);
      if (notesDoc.exists()) setNotes(notesDoc.data().content ?? '');
      setLoading(false);
    };
    load();
  }, [user, tripId, router]);

  // Auto-print once loaded
  useEffect(() => {
    if (!loading && trip) {
      setTimeout(() => window.print(), 500);
    }
  }, [loading, trip]);

  if (loading || !trip) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-2 border-gray-400 border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Preparing your trip summary…</p>
        </div>
      </div>
    );
  }

  const grouped = groupByDate(activities);
  const dates = Object.keys(grouped).sort();
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const packedCount = packingItems.filter((i) => i.packed).length;

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  const expByCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 1.5cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; background: white; }
      `}</style>

      {/* Print button — hidden when printing */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg shadow-lg hover:bg-gray-700"
        >
          Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg shadow-lg hover:bg-gray-200"
        >
          Close
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="border-b-2 border-gray-900 pb-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded bg-emerald-600 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm text-gray-500 font-medium">Travel Track</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">{trip.title}</h1>
          <p className="text-lg text-emerald-700 font-medium">{trip.destination}, {trip.country}</p>
          <div className="flex flex-wrap gap-6 mt-3 text-sm text-gray-500">
            <span>{formatDate(trip.startDate)} – {formatDate(trip.endDate)}</span>
            <span className="capitalize">{trip.status}</span>
            <span>{activities.length} activities</span>
          </div>
          {trip.description && (
            <p className="mt-4 text-gray-600 text-sm leading-relaxed">{trip.description}</p>
          )}
        </div>

        {/* Itinerary */}
        {dates.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              📅 Itinerary
            </h2>
            <div className="space-y-6">
              {dates.map((date) => (
                <div key={date}>
                  <h3 className="font-semibold text-gray-700 text-sm mb-2 pb-1 border-b border-gray-200">
                    {formatDate(date)}
                  </h3>
                  <div className="space-y-2">
                    {grouped[date].map((activity) => (
                      <div key={activity.id} className="pl-3 border-l-2 border-emerald-400">
                        <div className="flex items-start gap-2">
                          <span>{ACTIVITY_ICONS[activity.type]}</span>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{activity.title}</p>
                            {activity.location && (
                              <p className="text-xs text-gray-500">{activity.location}</p>
                            )}
                            {activity.notes && (
                              <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{activity.notes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Packing list */}
        {packingItems.length > 0 && (
          <section className="mb-8 page-break">
            <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
              🧳 Packing List
            </h2>
            <p className="text-sm text-gray-500 mb-4">{packedCount}/{packingItems.length} packed</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              {packingItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 py-0.5">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                    item.packed ? 'bg-emerald-600 border-emerald-600' : 'border-gray-400'
                  }`}>
                    {item.packed && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm ${item.packed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {item.name}
                  </span>
                  <span className="text-xs text-gray-400">({item.category})</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Budget */}
        {expenses.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
              💰 Budget
            </h2>
            {trip.budget && (
              <p className="text-sm text-gray-500 mb-3">
                Budget: {fmt(trip.budget)} · Spent: {fmt(totalExpenses)} · {totalExpenses > trip.budget ? `${fmt(totalExpenses - trip.budget)} over` : `${fmt(trip.budget - totalExpenses)} remaining`}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {Object.entries(expByCategory).map(([cat, total]) => (
                <div key={cat} className="flex items-center gap-2 text-sm">
                  <span>{EXPENSE_ICONS[cat] ?? '📦'}</span>
                  <span className="text-gray-600 capitalize">{cat}</span>
                  <span className="ml-auto font-medium text-gray-900">{fmt(total)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-200 pt-2 text-sm font-bold flex justify-between">
              <span>Total</span>
              <span>{fmt(totalExpenses)}</span>
            </div>
          </section>
        )}

        {/* Notes */}
        {notes && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              📝 Notes & Journal
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{notes}</p>
          </section>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 pt-4 mt-8 text-xs text-gray-400 text-center">
          Generated by Travel Track · {new Date().toLocaleDateString()}
        </div>
      </div>
    </>
  );
}

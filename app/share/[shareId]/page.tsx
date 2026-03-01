'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PhotoGallery } from '@/components/PhotoGallery';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Trip, Activity, ActivityType } from '@/types';

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  sightseeing: '🏛️',
  food: '🍜',
  transport: '✈️',
  accommodation: '🏨',
  adventure: '🧗',
  shopping: '🛍️',
  other: '📌',
};

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function tripDays(start: string, end: string) {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
}

function groupByDate(activities: Activity[]): Record<string, Activity[]> {
  return activities.reduce((acc, a) => {
    if (!acc[a.date]) acc[a.date] = [];
    acc[a.date].push(a);
    return acc;
  }, {} as Record<string, Activity[]>);
}

export default function SharePage() {
  const params = useParams();
  const shareId = params.shareId as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!db || !shareId) return;
    const load = async () => {
      try {
        // Fetch the public trip by shareId
        const tripSnap = await getDocs(
          query(
            collection(db!, 'trips'),
            where('shareId', '==', shareId),
            where('isPublic', '==', true)
          )
        );
        if (tripSnap.empty) { setNotFound(true); setLoading(false); return; }

        const tripDoc = tripSnap.docs[0];
        const tripData = { id: tripDoc.id, ...tripDoc.data() } as Trip;
        setTrip(tripData);

        // Fetch activities
        const actSnap = await getDocs(
          query(
            collection(db!, 'activities'),
            where('tripId', '==', tripDoc.id),
            orderBy('date', 'asc'),
            orderBy('createdAt', 'asc')
          )
        );
        setActivities(actSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Activity)));
      } catch (err) {
        console.error('Error loading shared trip:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (notFound || !trip) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-2">
          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white">Trip not found</h1>
        <p className="text-gray-500 text-sm">This link may have expired or sharing has been disabled.</p>
        <Link href="/" className="mt-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors">
          Go to Travel Track
        </Link>
      </div>
    );
  }

  const days = tripDays(trip.startDate, trip.endDate);
  const grouped = groupByDate(activities);
  const dates = Object.keys(grouped).sort();

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-bold text-white">Travel Track</span>
          </Link>
          <span className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1 rounded-full">Shared itinerary</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Cover photo */}
        {trip.coverPhotoUrl && (
          <div className="w-full h-56 rounded-2xl overflow-hidden mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={trip.coverPhotoUrl} alt={trip.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Trip header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">{trip.title}</h1>
          <p className="text-emerald-400 font-medium mb-3">{trip.destination}, {trip.country}</p>
          <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-4">
            <span>{formatDate(trip.startDate)} – {formatDate(trip.endDate)}</span>
            <span>{days} day{days !== 1 ? 's' : ''}</span>
            <span>{activities.length} activit{activities.length !== 1 ? 'ies' : 'y'}</span>
          </div>
          {trip.description && (
            <p className="text-gray-400 text-sm leading-relaxed">{trip.description}</p>
          )}
        </div>

        {/* Photo gallery */}
        <PhotoGallery activities={activities} />

        {/* Activities */}
        {activities.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-white mb-5">Itinerary</h2>
            <div className="space-y-6">
              {dates.map((date) => (
                <div key={date}>
                  <p className="text-sm font-semibold text-emerald-400 mb-3">{formatDate(date)}</p>
                  <div className="space-y-3">
                    {grouped[date].map((activity) => {
                      const photoUrls = [
                        ...(activity.photoUrls ?? []),
                        ...(activity.photoUrl && !(activity.photoUrls ?? []).includes(activity.photoUrl) ? [activity.photoUrl] : []),
                      ];
                      return (
                        <div key={activity.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                          {photoUrls.length > 0 && (
                            <div className="flex gap-1 h-28 overflow-hidden">
                              {photoUrls.slice(0, 3).map((url, i) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img key={i} src={url} alt="" className="flex-1 object-cover min-w-0" />
                              ))}
                            </div>
                          )}
                          <div className="p-4">
                            <div className="flex items-start gap-3">
                              <span className="text-xl shrink-0">{ACTIVITY_ICONS[activity.type]}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-white">{activity.title}</p>
                                {activity.location && (
                                  <p className="text-xs text-gray-500 mt-0.5">{activity.location}</p>
                                )}
                                {activity.notes && (
                                  <p className="text-sm text-gray-400 mt-2 leading-relaxed">{activity.notes}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer CTA */}
        <div className="mt-12 pt-8 border-t border-gray-800 text-center">
          <p className="text-gray-500 text-sm mb-3">Plan and share your own adventures</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start with Travel Track
          </Link>
        </div>
      </main>
    </div>
  );
}

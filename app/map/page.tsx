'use client';

import 'leaflet/dist/leaflet.css';
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { Trip } from '@/types';

// Dynamically import the map to avoid SSR issues with Leaflet
const WorldMap = dynamic(
  () => import('@/components/WorldMap').then((m) => m.WorldMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  }
);

export default function MapPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const fetchTrips = useCallback(async () => {
    if (!user || !db) return;
    try {
      const q = query(
        collection(db, 'trips'),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      setTrips(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Trip)));
    } catch (err) {
      console.error('Error fetching trips:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchTrips();
  }, [user, fetchTrips]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10 shrink-0">
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
              <span className="px-3 py-1.5 text-sm text-white bg-gray-800 rounded-lg font-medium">
                World Map
              </span>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {trips.length} trip{trips.length !== 1 ? 's' : ''} · {new Set(trips.map((t) => t.country)).size} countr{new Set(trips.map((t) => t.country)).size !== 1 ? 'ies' : 'y'}
            </span>
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

      {/* Map fills the rest of the screen */}
      <div className="p-4" style={{ height: 'calc(100vh - 65px)' }}>
        {trips.length === 0 ? (
          <div className="h-full rounded-2xl bg-gray-900 border border-gray-800 flex flex-col items-center justify-center gap-4">
            <div className="text-5xl">🗺️</div>
            <h2 className="text-white font-semibold text-lg">No trips to show</h2>
            <p className="text-gray-500 text-sm">Add trips to see them on the map.</p>
            <Link
              href="/"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Go to Trips
            </Link>
          </div>
        ) : (
          <WorldMap trips={trips} />
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, collection, query, where, orderBy, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { AddActivityModal } from '@/components/AddActivityModal';
import { EditActivityModal } from '@/components/EditActivityModal';
import { EditTripModal } from '@/components/EditTripModal';
import { PhotoGallery } from '@/components/PhotoGallery';
import { PackingList } from '@/components/PackingList';
import { BudgetTracker } from '@/components/BudgetTracker';
import { useRouter, useParams } from 'next/navigation';
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

const STATUS_STYLES = {
  planned: 'bg-blue-500/20 text-blue-300',
  ongoing: 'bg-emerald-500/20 text-emerald-300',
  completed: 'bg-gray-500/20 text-gray-300',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function tripDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

function groupActivitiesByDate(activities: Activity[]): Record<string, Activity[]> {
  return activities.reduce((acc, a) => {
    if (!acc[a.date]) acc[a.date] = [];
    acc[a.date].push(a);
    return acc;
  }, {} as Record<string, Activity[]>);
}

export default function TripDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showEditTrip, setShowEditTrip] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const fetchTrip = useCallback(async () => {
    if (!user || !db) return;
    try {
      const tripDoc = await getDoc(doc(db, 'trips', tripId));
      if (!tripDoc.exists() || tripDoc.data()?.userId !== user.uid) {
        router.push('/');
        return;
      }
      setTrip({ id: tripDoc.id, ...tripDoc.data() } as Trip);
    } catch (err) {
      console.error('Error fetching trip:', err);
    }
  }, [user, tripId, router]);

  const fetchActivities = useCallback(async () => {
    if (!user || !db) return;
    try {
      const q = query(
        collection(db, 'activities'),
        where('tripId', '==', tripId),
        where('userId', '==', user.uid),
        orderBy('date', 'asc'),
        orderBy('createdAt', 'asc')
      );
      const snapshot = await getDocs(q);
      setActivities(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Activity)));
    } catch (err) {
      console.error('Error fetching activities:', err);
    }
  }, [user, tripId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchTrip(), fetchActivities()]);
      setLoading(false);
    };
    if (user) load();
  }, [user, fetchTrip, fetchActivities]);

  const handleStatusChange = async (status: Trip['status']) => {
    if (!trip || !db) return;
    await updateDoc(doc(db, 'trips', tripId), { status, updatedAt: Date.now() });
    setTrip((prev) => prev ? { ...prev, status } : prev);
    setIsEditingStatus(false);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !storage || !db) return;
    setCoverUploading(true);
    try {
      const storageRef = ref(storage, `trips/${user.uid}/${tripId}/cover_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'trips', tripId), { coverPhotoUrl: url, updatedAt: Date.now() });
      setTrip((prev) => prev ? { ...prev, coverPhotoUrl: url } : prev);
    } catch (err) {
      console.error('Cover upload error:', err);
    } finally {
      setCoverUploading(false);
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!db || !window.confirm('Delete this activity?')) return;
    setDeletingActivityId(activityId);
    try {
      await deleteDoc(doc(db, 'activities', activityId));
      setActivities((prev) => prev.filter((a) => a.id !== activityId));
    } finally {
      setDeletingActivityId(null);
    }
  };

  const handleDeleteTrip = async () => {
    if (!db || !window.confirm('Delete this trip and all its activities? This cannot be undone.')) return;
    try {
      // Delete activities
      for (const activity of activities) {
        await deleteDoc(doc(db, 'activities', activity.id));
      }
      await deleteDoc(doc(db, 'trips', tripId));
      router.push('/');
    } catch (err) {
      console.error('Error deleting trip:', err);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!trip) return null;

  const grouped = groupActivitiesByDate(activities);
  const sortedDates = Object.keys(grouped).sort();
  const days = tripDays(trip.startDate, trip.endDate);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-bold text-white truncate">Travel Track</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Trip hero */}
        <div className="relative rounded-2xl overflow-hidden mb-8 bg-gray-900 border border-gray-800">
          {/* Cover photo */}
          <div className="h-52 relative">
            {trip.coverPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={trip.coverPhotoUrl} alt={trip.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-emerald-900/30 to-gray-900 flex items-center justify-center">
                <svg className="w-16 h-16 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            )}
            {/* Upload cover button */}
            <label className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white text-xs rounded-lg cursor-pointer backdrop-blur transition-colors">
              {coverUploading ? (
                <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
              {trip.coverPhotoUrl ? 'Change cover' : 'Add cover'}
              <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            </label>
          </div>

          {/* Trip info */}
          <div className="p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-white mb-1 truncate">{trip.title}</h1>
                <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${trip.destination}, ${trip.country}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-emerald-400 hover:underline transition-colors"
                  >
                    {trip.destination}, {trip.country}
                  </a>
                </div>
              </div>

              {/* Edit + Status */}
              <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowEditTrip(true)}
                className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                title="Edit trip"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <div className="relative shrink-0">
                <button
                  onClick={() => setIsEditingStatus(!isEditingStatus)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium ${STATUS_STYLES[trip.status]}`}
                >
                  {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)} ▾
                </button>
                {isEditingStatus && (
                  <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-xl z-10 min-w-32">
                    {(['planned', 'ongoing', 'completed'] as Trip['status'][]).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-700 transition-colors ${
                          trip.status === s ? 'text-emerald-400' : 'text-white'
                        }`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-4">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {days} day{days !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {activities.length} activit{activities.length !== 1 ? 'ies' : 'y'}
              </span>
            </div>

            {trip.description && (
              <p className="text-gray-400 text-sm leading-relaxed">{trip.description}</p>
            )}
          </div>
        </div>

        {/* Budget tracker */}
        <BudgetTracker
          tripId={tripId}
          userId={user.uid}
          budget={trip.budget}
          onBudgetChange={(b) => setTrip((prev) => prev ? { ...prev, budget: b } : prev)}
        />

        {/* Packing list */}
        <PackingList tripId={tripId} userId={user.uid} />

        {/* Photo gallery */}
        <PhotoGallery activities={activities} />

        {/* Activities section */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">Activities</h2>
            {activities.length > 0 && (
              <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  List
                </button>
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'timeline' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Timeline
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteTrip}
              className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              Delete trip
            </button>
            <button
              onClick={() => setShowAddActivity(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Log Activity
            </button>
          </div>
        </div>

        {activities.length === 0 ? (
          <div className="text-center py-16 bg-gray-900 rounded-2xl border border-gray-800">
            <div className="text-4xl mb-3">🗺️</div>
            <h3 className="text-white font-semibold mb-2">No activities yet</h3>
            <p className="text-gray-500 text-sm mb-5">Start logging what you did on this trip!</p>
            <button
              onClick={() => setShowAddActivity(true)}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Log first activity
            </button>
          </div>
        ) : viewMode === 'list' ? (
          /* ── List view ── */
          <div className="space-y-8">
            {sortedDates.map((date) => (
              <div key={date}>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  {formatDate(date)}
                </h3>
                <div className="space-y-3">
                  {grouped[date].map((activity) => {
                    const urls = [
                      ...(activity.photoUrls ?? []),
                      ...(activity.photoUrl && !(activity.photoUrls ?? []).includes(activity.photoUrl) ? [activity.photoUrl] : []),
                    ];
                    const visible = urls.slice(0, 3);
                    const extra = urls.length - visible.length;
                    return (
                      <div key={activity.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                        <div className="flex gap-4 p-4">
                          {visible.length > 0 && (
                            <div className="flex gap-1 shrink-0">
                              {visible.map((url, i) => (
                                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-800">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={url} alt={activity.title} className="w-full h-full object-cover" />
                                  {i === visible.length - 1 && extra > 0 && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-semibold">+{extra}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-lg shrink-0">{ACTIVITY_ICONS[activity.type]}</span>
                                <div className="min-w-0">
                                  <h4 className="font-medium text-white text-sm truncate">{activity.title}</h4>
                                  {activity.location && (
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      {activity.location}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => setEditingActivity(activity)} className="text-gray-600 hover:text-white transition-colors p-0.5" title="Edit activity">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                <button onClick={() => handleDeleteActivity(activity.id)} disabled={deletingActivityId === activity.id} className="text-gray-600 hover:text-red-400 transition-colors p-0.5 disabled:opacity-50" title="Delete activity">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </div>
                            {activity.notes && (
                              <p className="mt-2 text-sm text-gray-400 leading-relaxed">{activity.notes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── Timeline view ── */
          <div className="relative pl-8">
            {/* Vertical spine */}
            <div className="absolute left-3 top-2 bottom-2 w-px bg-gray-800" />

            {sortedDates.map((date) => (
              <div key={date} className="relative mb-8 last:mb-0">
                {/* Date node */}
                <div className="absolute -left-5 flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-gray-950 mt-0.5" />
                <p className="text-sm font-semibold text-emerald-400 mb-3">{formatDate(date)}</p>

                <div className="space-y-3">
                  {grouped[date].map((activity) => {
                    const urls = [
                      ...(activity.photoUrls ?? []),
                      ...(activity.photoUrl && !(activity.photoUrls ?? []).includes(activity.photoUrl) ? [activity.photoUrl] : []),
                    ];
                    const visible = urls.slice(0, 3);
                    const extra = urls.length - visible.length;
                    return (
                      <div key={activity.id} className="relative ml-2">
                        {/* Activity dot */}
                        <div className="absolute -left-5 top-4 w-2 h-2 rounded-full bg-gray-600 ring-2 ring-gray-950" />
                        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                          {/* Photo strip */}
                          {visible.length > 0 && (
                            <div className="flex gap-0.5">
                              {visible.map((url, i) => (
                                <div key={i} className="relative flex-1 h-28 overflow-hidden bg-gray-800 first:rounded-tl-xl last:rounded-tr-xl">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={url} alt={activity.title} className="w-full h-full object-cover" />
                                  {i === visible.length - 1 && extra > 0 && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-sm font-semibold">+{extra}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-base shrink-0">{ACTIVITY_ICONS[activity.type]}</span>
                                <div className="min-w-0">
                                  <h4 className="font-medium text-white text-sm truncate">{activity.title}</h4>
                                  {activity.location && (
                                    <p className="text-xs text-gray-500 mt-0.5">{activity.location}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => setEditingActivity(activity)} className="text-gray-600 hover:text-white transition-colors p-0.5" title="Edit">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                <button onClick={() => handleDeleteActivity(activity.id)} disabled={deletingActivityId === activity.id} className="text-gray-600 hover:text-red-400 transition-colors p-0.5 disabled:opacity-50" title="Delete">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </div>
                            {activity.notes && (
                              <p className="mt-1.5 text-xs text-gray-400 leading-relaxed">{activity.notes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showAddActivity && (
        <AddActivityModal
          tripId={tripId}
          tripStartDate={trip.startDate}
          tripEndDate={trip.endDate}
          onClose={() => setShowAddActivity(false)}
          onAdded={fetchActivities}
        />
      )}

      {showEditTrip && (
        <EditTripModal
          trip={trip}
          onClose={() => setShowEditTrip(false)}
          onUpdated={(updated) => setTrip(updated)}
        />
      )}

      {editingActivity && (
        <EditActivityModal
          activity={editingActivity}
          tripStartDate={trip.startDate}
          tripEndDate={trip.endDate}
          onClose={() => setEditingActivity(null)}
          onUpdated={(updated) => {
            setActivities((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
            setEditingActivity(null);
          }}
        />
      )}
    </div>
  );
}

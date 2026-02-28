'use client';

import { useState, useEffect } from 'react';
import { updateProfile, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const CURRENCIES = [
  { code: 'USD', label: 'USD – US Dollar' },
  { code: 'EUR', label: 'EUR – Euro' },
  { code: 'GBP', label: 'GBP – British Pound' },
  { code: 'JPY', label: 'JPY – Japanese Yen' },
  { code: 'AUD', label: 'AUD – Australian Dollar' },
  { code: 'CAD', label: 'CAD – Canadian Dollar' },
  { code: 'CHF', label: 'CHF – Swiss Franc' },
  { code: 'CNY', label: 'CNY – Chinese Yuan' },
  { code: 'HKD', label: 'HKD – Hong Kong Dollar' },
  { code: 'SGD', label: 'SGD – Singapore Dollar' },
  { code: 'THB', label: 'THB – Thai Baht' },
  { code: 'MXN', label: 'MXN – Mexican Peso' },
  { code: 'KRW', label: 'KRW – South Korean Won' },
  { code: 'INR', label: 'INR – Indian Rupee' },
];

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState({ trips: 0, countries: 0, activities: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  // Load profile prefs from Firestore + display name from Auth
  useEffect(() => {
    if (!user || !db) return;
    setDisplayName(user.displayName ?? '');

    const load = async () => {
      const ref = doc(db!, 'userProfiles', user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        if (data.currency) setCurrency(data.currency);
      }
    };
    load();
  }, [user]);

  // Load stats
  useEffect(() => {
    if (!user || !db) return;
    const loadStats = async () => {
      try {
        const tripsSnap = await getDocs(
          query(collection(db!, 'trips'), where('userId', '==', user.uid))
        );
        const tripDocs = tripsSnap.docs.map((d) => d.data());
        const countries = new Set(tripDocs.map((t) => t.country)).size;

        const activitiesSnap = await getDocs(
          query(collection(db!, 'activities'), where('userId', '==', user.uid))
        );

        setStats({ trips: tripDocs.length, countries, activities: activitiesSnap.size });
      } finally {
        setLoadingStats(false);
      }
    };
    loadStats();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !auth) return;
    setSaving(true);
    try {
      await updateProfile(user, { displayName: displayName.trim() || null });
      await setDoc(doc(db, 'userProfiles', user.uid), { currency }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/login');
    }
  };

  const initials = (user?.displayName ?? user?.email ?? '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-bold text-white text-lg">Travel Track</span>
          </div>
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
            <span className="px-3 py-1.5 text-sm text-white bg-gray-800 rounded-lg font-medium">Profile</span>
          </nav>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        {/* Avatar + name card */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 bg-emerald-600 flex items-center justify-center">
            {user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-white">{initials}</span>
            )}
          </div>
          <div>
            <p className="text-lg font-semibold text-white">{user.displayName || 'Traveler'}</p>
            <p className="text-sm text-gray-400">{user.email}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {loadingStats ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center animate-pulse">
                <div className="h-7 bg-gray-800 rounded mb-1 mx-auto w-10" />
                <div className="h-3 bg-gray-800 rounded mx-auto w-16" />
              </div>
            ))
          ) : (
            [
              { label: 'Trips', value: stats.trips },
              { label: 'Countries', value: stats.countries },
              { label: 'Activities', value: stats.activities },
            ].map((s) => (
              <div key={s.label} className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))
          )}
        </div>

        {/* Settings form */}
        <form onSubmit={handleSave} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="p-5 border-b border-gray-800">
            <h2 className="text-base font-semibold text-white">Settings</h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Display Name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Email</label>
              <input
                value={user.email ?? ''}
                readOnly
                className="w-full px-3 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-500 text-sm cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Default Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="px-5 pb-5 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {saved && <span className="text-sm text-emerald-400">Saved!</span>}
          </div>
        </form>

        {/* Sign out */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Sign out</p>
            <p className="text-xs text-gray-500 mt-0.5">You will be redirected to the login page.</p>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 text-sm font-medium rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </main>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface TripNotesProps {
  tripId: string;
  userId: string;
}

type SaveState = 'idle' | 'saving' | 'saved';

export function TripNotes({ tripId, userId }: TripNotesProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoad = useRef(true);

  useEffect(() => {
    if (!db) return;
    const load = async () => {
      const snap = await getDoc(doc(db!, 'tripNotes', tripId));
      if (snap.exists()) setContent(snap.data().content ?? '');
      setLoading(false);
    };
    load();
  }, [tripId]);

  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      return;
    }
    if (!db) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState('saving');

    debounceRef.current = setTimeout(async () => {
      await setDoc(doc(db!, 'tripNotes', tripId), {
        tripId,
        userId,
        content,
        updatedAt: Date.now(),
      });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [content, tripId, userId]);

  return (
    <div className="mb-8 bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="p-5 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Notes & Journal</h2>
        <span className={`text-xs transition-opacity ${
          saveState === 'idle' ? 'opacity-0' : 'opacity-100'
        } ${saveState === 'saved' ? 'text-emerald-400' : 'text-gray-500'}`}>
          {saveState === 'saving' ? 'Saving…' : '✓ Saved'}
        </span>
      </div>
      {loading ? (
        <div className="p-8 flex justify-center">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your travel notes, diary entries, tips, reminders…"
          rows={8}
          className="w-full px-5 py-4 bg-transparent text-gray-300 placeholder-gray-600 text-sm leading-relaxed resize-none focus:outline-none"
        />
      )}
    </div>
  );
}

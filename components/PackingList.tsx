'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PackingItem } from '@/types';

const CATEGORIES = ['Essentials', 'Clothes', 'Toiletries', 'Documents', 'Electronics', 'Other'];

const PRESETS: Record<string, string[]> = {
  Essentials: ['Passport', 'Wallet', 'Phone charger', 'Headphones', 'Water bottle'],
  Clothes: ['T-shirts', 'Underwear', 'Socks', 'Jacket', 'Shoes', 'Swimwear'],
  Toiletries: ['Toothbrush', 'Toothpaste', 'Shampoo', 'Sunscreen', 'Deodorant'],
  Documents: ['Flight tickets', 'Hotel booking', 'Travel insurance', 'Visa'],
  Electronics: ['Laptop', 'Camera', 'Power bank', 'Adapter/converter'],
  Other: [],
};

interface PackingListProps {
  tripId: string;
  userId: string;
}

export function PackingList({ tripId, userId }: PackingListProps) {
  const [items, setItems] = useState<PackingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Essentials');
  const [adding, setAdding] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [activePresetCategory, setActivePresetCategory] = useState('Essentials');

  useEffect(() => {
    const fetch = async () => {
      if (!db) return;
      const q = query(
        collection(db, 'packingItems'),
        where('tripId', '==', tripId),
        where('userId', '==', userId)
      );
      const snap = await getDocs(q);
      const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PackingItem));
      fetched.sort((a, b) => a.createdAt - b.createdAt);
      setItems(fetched);
      setLoading(false);
    };
    fetch();
  }, [tripId, userId]);

  const addItem = async (name: string, category: string) => {
    if (!name.trim() || !db) return;
    const data = {
      tripId,
      userId,
      name: name.trim(),
      category,
      packed: false,
      createdAt: Date.now(),
    };
    const ref = await addDoc(collection(db, 'packingItems'), data);
    setItems((prev) => [...prev, { id: ref.id, ...data }]);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    await addItem(newName, newCategory);
    setNewName('');
    setAdding(false);
  };

  const togglePacked = async (item: PackingItem) => {
    if (!db) return;
    const packed = !item.packed;
    await updateDoc(doc(db, 'packingItems', item.id), { packed });
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, packed } : i)));
  };

  const deleteItem = async (id: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'packingItems', id));
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const addPreset = async (name: string) => {
    const already = items.some((i) => i.name.toLowerCase() === name.toLowerCase());
    if (already) return;
    await addItem(name, activePresetCategory);
  };

  const packed = items.filter((i) => i.packed).length;
  const total = items.length;
  const progress = total === 0 ? 0 : Math.round((packed / total) * 100);

  // Group by category
  const grouped = CATEGORIES.reduce<Record<string, PackingItem[]>>((acc, cat) => {
    const catItems = items.filter((i) => i.category === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {});
  const uncategorized = items.filter((i) => !CATEGORIES.includes(i.category));
  if (uncategorized.length > 0) grouped['Other'] = [...(grouped['Other'] ?? []), ...uncategorized];

  return (
    <div className="mb-8 bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">Packing List</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPresets((v) => !v)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                showPresets
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
              }`}
            >
              Presets
            </button>
            <span className="text-sm text-gray-400">
              {packed}/{total} packed
            </span>
          </div>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Presets panel */}
      {showPresets && (
        <div className="border-b border-gray-800 p-4">
          <div className="flex gap-2 mb-3 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActivePresetCategory(cat)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                  activePresetCategory === cat
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(PRESETS[activePresetCategory] ?? []).map((preset) => {
              const added = items.some((i) => i.name.toLowerCase() === preset.toLowerCase());
              return (
                <button
                  key={preset}
                  onClick={() => addPreset(preset)}
                  disabled={added}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                    added
                      ? 'border-gray-700 text-gray-600 cursor-default'
                      : 'border-gray-700 text-gray-300 hover:border-emerald-500 hover:text-emerald-400'
                  }`}
                >
                  {added ? '✓ ' : '+ '}{preset}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Items grouped by category */}
      {loading ? (
        <div className="p-8 flex justify-center">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div>
          {Object.keys(grouped).length === 0 && (
            <p className="text-center text-gray-500 text-sm py-8">No items yet. Add some below or use Presets.</p>
          )}
          {Object.entries(grouped).map(([category, catItems]) => (
            <div key={category} className="border-b border-gray-800 last:border-0">
              <p className="px-5 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {category}
              </p>
              {catItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-800/50 group"
                >
                  <button
                    onClick={() => togglePacked(item)}
                    className={`w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                      item.packed
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-gray-600 hover:border-emerald-500'
                    }`}
                  >
                    {item.packed && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className={`flex-1 text-sm ${item.packed ? 'line-through text-gray-500' : 'text-white'}`}>
                    {item.name}
                  </span>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-0.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Add item form */}
      <form onSubmit={handleAdd} className="p-4 border-t border-gray-800 flex gap-2">
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="px-2.5 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-xs focus:outline-none focus:border-emerald-500 shrink-0"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add an item…"
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={!newName.trim() || adding}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
        >
          Add
        </button>
      </form>
    </div>
  );
}

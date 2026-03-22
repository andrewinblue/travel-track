'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from './ToastProvider';
import type { Expense } from '@/types';

const CATEGORIES = [
  { value: 'accommodation', label: 'Accommodation', icon: '🏨' },
  { value: 'food', label: 'Food & Drink', icon: '🍜' },
  { value: 'transport', label: 'Transport', icon: '✈️' },
  { value: 'activities', label: 'Activities', icon: '🎭' },
  { value: 'shopping', label: 'Shopping', icon: '🛍️' },
  { value: 'health', label: 'Health', icon: '💊' },
  { value: 'other', label: 'Other', icon: '📦' },
];

interface BudgetTrackerProps {
  tripId: string;
  userId: string;
  budget?: number;
  onBudgetChange: (budget: number | undefined) => void;
}

export function BudgetTracker({ tripId, userId, budget, onBudgetChange }: BudgetTrackerProps) {
  const toast = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('USD');
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(budget?.toString() ?? '');
  const [budgetError, setBudgetError] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);

  // Add form state
  const [expenseError, setExpenseError] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('food');
  const [newDescription, setNewDescription] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [adding, setAdding] = useState(false);

  // Fetch currency from userProfiles
  useEffect(() => {
    if (!db) return;
    const load = async () => {
      const snap = await getDoc(doc(db!, 'userProfiles', userId));
      if (snap.exists() && snap.data().currency) setCurrency(snap.data().currency);
    };
    load();
  }, [userId]);

  // Fetch expenses
  useEffect(() => {
    if (!db) return;
    const fetch = async () => {
      const q = query(
        collection(db!, 'expenses'),
        where('tripId', '==', tripId),
        where('userId', '==', userId)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));
      data.sort((a, b) => b.createdAt - a.createdAt);
      setExpenses(data);
      setLoading(false);
    };
    fetch();
  }, [tripId, userId]);

  const saveBudget = async () => {
    if (!db) return;
    const val = parseFloat(budgetInput);
    if (budgetInput.trim() && (isNaN(val) || val < 0)) {
      setBudgetError('Budget must be a positive number');
      return;
    }
    setBudgetError('');
    setSavingBudget(true);
    try {
      const newBudget = isNaN(val) || val <= 0 ? undefined : val;
      await updateDoc(doc(db, 'trips', tripId), { budget: newBudget ?? null });
      onBudgetChange(newBudget);
      setEditingBudget(false);
      toast.success('Budget saved');
    } finally {
      setSavingBudget(false);
    }
  };

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newAmount);
    if (!newAmount.trim()) {
      setExpenseError('Amount is required');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setExpenseError('Amount must be a positive number');
      return;
    }
    if (amount > 999999999) {
      setExpenseError('Amount is too large');
      return;
    }
    if (!db) return;
    setExpenseError('');
    setAdding(true);
    try {
      const data: Omit<Expense, 'id'> = {
        tripId,
        userId,
        amount,
        category: newCategory,
        description: newDescription.trim(),
        date: newDate,
        createdAt: Date.now(),
      };
      const ref = await addDoc(collection(db, 'expenses'), data);
      setExpenses((prev) => [{ id: ref.id, ...data }, ...prev]);
      setNewAmount('');
      setNewDescription('');
      toast.success('Expense added');
    } finally {
      setAdding(false);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'expenses', id));
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const progress = budget ? Math.min((total / budget) * 100, 100) : 0;
  const over = budget ? total > budget : false;
  const progressColor = over ? 'bg-red-500' : progress > 75 ? 'bg-amber-500' : 'bg-emerald-500';

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 });

  // Spending by category
  const byCategory = CATEGORIES.map((cat) => ({
    ...cat,
    total: expenses.filter((e) => e.category === cat.value).reduce((s, e) => s + e.amount, 0),
  })).filter((c) => c.total > 0);

  return (
    <div className="mb-8 bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-white">Budget</h2>
          <button
            onClick={() => { setEditingBudget(true); setBudgetInput(budget?.toString() ?? ''); }}
            className="text-xs text-gray-500 hover:text-emerald-400 transition-colors"
          >
            {budget ? 'Edit budget' : 'Set budget'}
          </button>
        </div>

        {/* Budget edit inline */}
        {editingBudget && (
          <>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm text-gray-400 shrink-0">{currency}</span>
              <input
                type="number"
                min="0"
                step="any"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                placeholder="e.g. 2000"
                autoFocus
                className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={saveBudget}
                disabled={savingBudget}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-lg disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => { setEditingBudget(false); setBudgetError(''); }}
                className="px-3 py-1.5 text-gray-400 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>
            {budgetError && <p className="text-xs text-red-400 mt-1">{budgetError}</p>}
          </>
        )}

        {/* Budget summary */}
        {!editingBudget && (
          <div className="mt-2">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-2xl font-bold text-white">{fmt(total)}</span>
              {budget ? (
                <span className={`text-sm ${over ? 'text-red-400' : 'text-gray-400'}`}>
                  {over ? `${fmt(total - budget)} over budget` : `${fmt(budget - total)} remaining`}
                  <span className="text-gray-600 ml-1">/ {fmt(budget)}</span>
                </span>
              ) : (
                <span className="text-sm text-gray-500">No budget set</span>
              )}
            </div>
            {budget && (
              <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Category breakdown */}
      {byCategory.length > 0 && (
        <div className="px-5 py-3 border-b border-gray-800 flex flex-wrap gap-2">
          {byCategory.map((cat) => (
            <div key={cat.value} className="flex items-center gap-1.5 bg-gray-800 rounded-lg px-2.5 py-1.5">
              <span className="text-sm">{cat.icon}</span>
              <span className="text-xs text-gray-300">{cat.label}</span>
              <span className="text-xs font-medium text-white">{fmt(cat.total)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expense list */}
      {loading ? (
        <div className="p-8 flex justify-center">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : expenses.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-6">No expenses yet. Add one below.</p>
      ) : (
        <div className="divide-y divide-gray-800">
          {expenses.map((expense) => {
            const cat = CATEGORIES.find((c) => c.value === expense.category);
            return (
              <div key={expense.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-800/50 group">
                <span className="text-lg shrink-0">{cat?.icon ?? '📦'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{expense.description || cat?.label}</p>
                  <p className="text-xs text-gray-500">{expense.date}</p>
                </div>
                <span className="text-sm font-medium text-white shrink-0">{fmt(expense.amount)}</span>
                <button
                  onClick={() => deleteExpense(expense.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-0.5 shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add expense form */}
      <form onSubmit={addExpense} className="p-4 border-t border-gray-800 space-y-2">
        {expenseError && <p className="text-xs text-red-400">{expenseError}</p>}
        <div className="flex gap-2">
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="px-2.5 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-xs focus:outline-none focus:border-emerald-500 shrink-0"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="any"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder={`Amount (${currency})`}
            className="w-36 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500"
          />
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="px-2.5 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex gap-2">
          <input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={!newAmount || adding}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
          >
            Add
          </button>
        </div>
      </form>
    </div>
  );
}

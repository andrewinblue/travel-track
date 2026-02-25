'use client';

import Link from 'next/link';
import type { Trip } from '@/types';

const STATUS_STYLES = {
  planned: 'bg-blue-500/20 text-blue-300',
  ongoing: 'bg-emerald-500/20 text-emerald-300',
  completed: 'bg-gray-500/20 text-gray-300',
};

const STATUS_LABELS = {
  planned: 'Planned',
  ongoing: 'Ongoing',
  completed: 'Completed',
};

function tripDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (start.getFullYear() !== end.getFullYear()) {
    return `${start.toLocaleDateString('en-US', { ...opts, year: 'numeric' })} – ${end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
  }
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
}

interface TripCardProps {
  trip: Trip;
}

export function TripCard({ trip }: TripCardProps) {
  const days = tripDays(trip.startDate, trip.endDate);

  return (
    <Link href={`/trips/${trip.id}`}>
      <div className="bg-gray-900 rounded-2xl border border-gray-800 hover:border-gray-700 transition-colors overflow-hidden group cursor-pointer">
        {/* Cover photo or placeholder */}
        <div className="h-40 bg-gradient-to-br from-gray-800 to-gray-900 relative overflow-hidden">
          {trip.coverPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={trip.coverPhotoUrl}
              alt={trip.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
          {/* Status badge */}
          <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[trip.status]}`}>
            {STATUS_LABELS[trip.status]}
          </span>
        </div>

        <div className="p-4">
          <h3 className="font-semibold text-white text-base mb-1 truncate">{trip.title}</h3>
          <div className="flex items-center gap-1.5 text-gray-400 text-sm mb-3">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">{trip.destination}, {trip.country}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
            <span>{days} day{days !== 1 ? 's' : ''}</span>
          </div>

          {trip.description && (
            <p className="mt-3 text-sm text-gray-500 line-clamp-2">{trip.description}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

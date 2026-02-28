'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Activity } from '@/types';

interface GalleryPhoto {
  url: string;
  title: string;
  location?: string;
}

interface PhotoGalleryProps {
  activities: Activity[];
}

function getActivityPhotos(activity: Activity): string[] {
  const urls = activity.photoUrls ?? [];
  if (activity.photoUrl && !urls.includes(activity.photoUrl)) {
    return [activity.photoUrl, ...urls];
  }
  return urls;
}

export function PhotoGallery({ activities }: PhotoGalleryProps) {
  const photos: GalleryPhoto[] = activities.flatMap((a) =>
    getActivityPhotos(a).map((url) => ({ url, title: a.title, location: a.location }))
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);


  const closeLightbox = () => setLightboxIndex(null);

  const prev = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
  }, [photos.length]);

  const next = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i + 1) % photos.length));
  }, [photos.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, prev, next]);

  if (photos.length === 0) return null;

  const current = lightboxIndex !== null ? photos[lightboxIndex] : null;

  return (
    <>
      <div className="mb-8">
        <h2 className="text-lg font-bold text-white mb-4">Photos</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((photo, idx) => (
            <button
              key={idx}
              onClick={() => setLightboxIndex(idx)}
              className="relative aspect-square rounded-xl overflow-hidden bg-gray-800 group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.title}
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-end p-2">
                <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity line-clamp-1">
                  {photo.title}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {current && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/50 text-sm">
            {lightboxIndex! + 1} / {photos.length}
          </div>

          {/* Prev */}
          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-4 text-white/70 hover:text-white p-2"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Image */}
          <div
            className="max-w-4xl max-h-[85vh] mx-16 flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={current.title}
              className="max-w-full max-h-[75vh] object-contain rounded-lg"
            />
            <div className="text-center">
              <p className="text-white font-medium">{current.title}</p>
              {current.location && (
                <p className="text-gray-400 text-sm mt-0.5">{current.location}</p>
              )}
            </div>
          </div>

          {/* Next */}
          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-4 text-white/70 hover:text-white p-2"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      )}
    </>
  );
}

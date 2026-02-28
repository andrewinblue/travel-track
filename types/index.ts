export type TripStatus = 'planned' | 'ongoing' | 'completed';

export type ActivityType =
  | 'sightseeing'
  | 'food'
  | 'transport'
  | 'accommodation'
  | 'adventure'
  | 'shopping'
  | 'other';

export interface Trip {
  id: string;
  userId: string;
  title: string;
  destination: string;
  country: string;
  startDate: string; // ISO date string YYYY-MM-DD
  endDate: string;
  description: string;
  status: TripStatus;
  coverPhotoUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PackingItem {
  id: string;
  tripId: string;
  userId: string;
  name: string;
  category: string;
  packed: boolean;
  createdAt: number;
}

export interface Activity {
  id: string;
  tripId: string;
  userId: string;
  title: string;
  type: ActivityType;
  date: string; // ISO date string YYYY-MM-DD
  notes: string;
  location?: string;
  photoUrl?: string;   // legacy single photo
  photoUrls?: string[]; // multiple photos
  createdAt: number;
}

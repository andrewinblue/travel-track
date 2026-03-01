'use client';

import { useState, useEffect } from 'react';

function weatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 65) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  if (code <= 99) return '⛈️';
  return '🌡️';
}

function weatherDesc(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Foggy';
  if (code <= 55) return 'Drizzle';
  if (code <= 65) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

function shortDay(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

interface WeatherWidgetProps {
  destination: string;
  country: string;
  startDate: string;
  endDate: string;
}

interface WeatherData {
  locationName: string;
  current: {
    temperature: number;
    code: number;
    windspeed: number;
    humidity: number;
  };
  daily: {
    date: string;
    max: number;
    min: number;
    code: number;
  }[];
}

export function WeatherWidget({ destination, startDate, endDate }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const isPast = endDate < today;
  const isUpcoming = startDate > today;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setFailed(false);
      try {
        // Geocode via Open-Meteo geocoding API
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=en&format=json`
        );
        const geoData = await geoRes.json();
        if (!geoData.results?.length) { setFailed(true); return; }

        const { latitude, longitude, name } = geoData.results[0];

        // Fetch current + 5-day forecast
        const wRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
          `&current=temperature_2m,relative_humidity_2m,weathercode,windspeed_10m` +
          `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
          `&forecast_days=5&timezone=auto`
        );
        const wData = await wRes.json();

        setWeather({
          locationName: name,
          current: {
            temperature: Math.round(wData.current.temperature_2m),
            code: wData.current.weathercode,
            windspeed: Math.round(wData.current.windspeed_10m),
            humidity: wData.current.relative_humidity_2m,
          },
          daily: wData.daily.time.map((date: string, i: number) => ({
            date,
            max: Math.round(wData.daily.temperature_2m_max[i]),
            min: Math.round(wData.daily.temperature_2m_min[i]),
            code: wData.daily.weathercode[i],
          })),
        });
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [destination]);

  if (failed) return null; // Silently hide if location not found

  return (
    <div className="mb-6 bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Weather</h2>
            {weather && (
              <p className="text-xs text-gray-500 mt-0.5">
                {isPast ? 'Current conditions at ' : isUpcoming ? 'Forecast for ' : 'Current conditions at '}
                {weather.locationName}
              </p>
            )}
          </div>
          {isPast && (
            <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded-lg">Past trip</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-3 animate-pulse">
            <div className="w-14 h-14 bg-gray-800 rounded-xl" />
            <div className="space-y-2">
              <div className="h-5 bg-gray-800 rounded w-24" />
              <div className="h-3 bg-gray-800 rounded w-16" />
            </div>
          </div>
        ) : weather ? (
          <>
            {/* Current conditions */}
            <div className="flex items-center gap-4 mb-5">
              <span className="text-5xl">{weatherEmoji(weather.current.code)}</span>
              <div>
                <div className="text-3xl font-bold text-white">{weather.current.temperature}°C</div>
                <div className="text-sm text-gray-400">{weatherDesc(weather.current.code)}</div>
              </div>
              <div className="ml-auto flex flex-col gap-1 text-right">
                <span className="text-xs text-gray-500">💧 {weather.current.humidity}%</span>
                <span className="text-xs text-gray-500">💨 {weather.current.windspeed} km/h</span>
              </div>
            </div>

            {/* 5-day forecast */}
            <div className="grid grid-cols-5 gap-1">
              {weather.daily.map((day) => (
                <div key={day.date} className="flex flex-col items-center gap-1 bg-gray-800 rounded-xl p-2">
                  <span className="text-xs text-gray-400 font-medium">{shortDay(day.date)}</span>
                  <span className="text-lg">{weatherEmoji(day.code)}</span>
                  <span className="text-xs font-semibold text-white">{day.max}°</span>
                  <span className="text-xs text-gray-500">{day.min}°</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

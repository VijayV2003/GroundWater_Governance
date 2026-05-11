/**
 * ApiStatusBanner.jsx
 * -------------------
 * Non-intrusive banner shown at the bottom of the page that tells
 * the user whether the ML backend is reachable or if mock data is
 * being displayed instead.
 */

import React from 'react';
import { Wifi, WifiOff, Server } from 'lucide-react';
import { useApiHealth } from '../hooks/useGroundwaterData';
import { BASE_URL } from '../api/groundwaterApi';

export default function ApiStatusBanner() {
  const online = useApiHealth();

  // Still probing
  if (online === null) return null;

  if (online) {
    return (
      <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-xs shadow-md z-50">
        <Wifi className="w-3.5 h-3.5" />
        <span>ML backend connected — <code className="font-mono">{BASE_URL}</code></span>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2 text-xs shadow-md z-50 max-w-xs">
      <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
      <span>
        <strong>Mock data mode</strong> — start the backend with{' '}
        <code className="font-mono">uvicorn main:app --port 8000</code>
      </span>
    </div>
  );
}

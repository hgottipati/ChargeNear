'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMapContext } from '../contexts/MapContext';

export default function RadiusCircle() {
  const searchParams = useSearchParams();
  const { map, userLocation } = useMapContext();
  const [circle, setCircle] = useState(null);

  useEffect(() => {
    if (!map || !userLocation) return;

    const distance = searchParams.get('distance');
    
    // Clear any existing circle
    if (circle) {
      circle.setMap(null);
    }

    // If no distance is selected, don't draw a circle
    if (!distance) {
      setCircle(null);
      return;
    }

    // Convert distance from miles to meters
    const radiusInMeters = parseFloat(distance) * 1609.34;

    const newCircle = new google.maps.Circle({
      map,
      center: userLocation,
      radius: radiusInMeters,
      fillColor: '#EEC218',
      fillOpacity: 0.2,
      strokeColor: '#EEC218',
      strokeOpacity: 0.8,
      strokeWeight: 2,
    });

    setCircle(newCircle);

    return () => {
      if (newCircle) newCircle.setMap(null);
    };
  }, [map, userLocation, searchParams]);

  return null;
} 
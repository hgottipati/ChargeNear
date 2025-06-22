'use client';

import { useEffect, useRef } from 'react';
import { useMapContext } from '../contexts/MapContext';
import RadiusCircle from './RadiusCircle';

export default function Map({ markers = [] }) {
  const mapRef = useRef(null);
  const { setMap, userLocation } = useMapContext();

  useEffect(() => {
    if (!mapRef.current) return;

    const initialCenter = userLocation || { lat: 37.7749, lng: -122.4194 }; // Default to SF
    
    const mapInstance = new google.maps.Map(mapRef.current, {
      center: initialCenter,
      zoom: 12,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
    });

    setMap(mapInstance);

    // Add user location marker if available
    if (userLocation) {
      new google.maps.Marker({
        position: userLocation,
        map: mapInstance,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#4285F4",
          fillOpacity: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: 2,
        },
        title: "Your Location",
      });
    }

    // Add markers for charging stations
    markers.forEach((marker) => {
      const position = { lat: marker.latitude, lng: marker.longitude };
      
      new google.maps.Marker({
        position,
        map: mapInstance,
        title: marker.name,
        icon: {
          url: '/charger-icon.png', // Assuming you have this icon
          scaledSize: new google.maps.Size(32, 32),
        },
      });
    });
  }, [markers, userLocation, setMap]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full" />
      <RadiusCircle />
    </div>
  );
} 
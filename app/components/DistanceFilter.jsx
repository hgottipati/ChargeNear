'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

const distanceOptions = [
  { label: 'Near Me', value: '0.5' },
  { label: '1 Mile', value: '1' },
  { label: '5 Miles', value: '5' },
  { label: '10 Miles', value: '10' },
];

export default function DistanceFilter() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [selectedDistance, setSelectedDistance] = useState(null);

  useEffect(() => {
    const distance = searchParams.get('distance');
    setSelectedDistance(distance);
  }, [searchParams]);

  const handleDistanceChange = (distance) => {
    const params = new URLSearchParams(searchParams);
    
    if (distance === selectedDistance) {
      params.delete('distance');
      setSelectedDistance(null);
    } else {
      params.set('distance', distance);
      setSelectedDistance(distance);
    }
    
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {distanceOptions.map((option) => (
        <button
          key={option.value}
          onClick={() => handleDistanceChange(option.value)}
          className={`px-4 py-2 text-sm rounded-full transition-colors ${
            selectedDistance === option.value
              ? 'bg-[#EEC218] text-black'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
} 
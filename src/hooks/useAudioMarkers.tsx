
import { useState, useCallback } from 'react';
import { AudioMarker } from './useAudioTypes';

export const useAudioMarkers = (formatTime: (time: number) => string) => {
  const [markers, setMarkers] = useState<AudioMarker[]>([]);
  
  const addMarker = useCallback((type: 'start' | 'end', currentTime: number) => {
    const newMarker: AudioMarker = {
      id: `${type}-${Date.now()}`,
      position: currentTime,
      type
    };
    
    setMarkers(prevMarkers => {
      // Filter out any existing marker of the same type
      const filteredMarkers = prevMarkers.filter(marker => marker.type !== type);
      return [...filteredMarkers, newMarker];
    });
  }, []);

  const removeMarker = useCallback((id: string) => {
    setMarkers(prevMarkers => prevMarkers.filter(marker => marker.id !== id));
  }, []);
  
  const initializeMarkers = useCallback((duration: number) => {
    const startMarkerId = `start-${Date.now()}`;
    const endMarkerId = `end-${Date.now() + 1}`;
    
    setMarkers([
      { id: startMarkerId, position: 0, type: 'start' },
      { id: endMarkerId, position: duration, type: 'end' }
    ]);
  }, []);

  return {
    markers,
    addMarker,
    removeMarker,
    initializeMarkers,
    setMarkers
  };
};

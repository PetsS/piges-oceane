import { useState, useCallback } from 'react';
import { toast } from 'sonner';
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
      const filteredMarkers = prevMarkers.filter(marker => marker.type !== type);
      return [...filteredMarkers, newMarker];
    });
    
    toast.success(`Marqueur ${type === 'start' ? 'début' : 'fin'} défini à ${formatTime(currentTime)}`);
  }, [formatTime]);

  const removeMarker = useCallback((id: string) => {
    setMarkers(markers.filter(marker => marker.id !== id));
  }, [markers]);
  
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


import { useRef, useCallback, useEffect } from 'react';

export const useAudioContext = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.error("Error creating AudioContext:", error);
      }
    }
    return audioContextRef.current;
  }, []);
  
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close().catch(console.error);
        } catch (error) {
          console.error("Error closing AudioContext:", error);
        }
      }
    };
  }, []);
  
  return {
    audioContextRef,
    getAudioContext
  };
};

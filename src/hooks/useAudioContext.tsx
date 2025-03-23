
import { useRef, useCallback, useEffect } from 'react';

export const useAudioContext = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass({
          latencyHint: 'interactive',
          sampleRate: 44100
        });
        
        console.log("Created new AudioContext, state:", audioContextRef.current.state);
        
        // Try to resume the context immediately if needed
        if (audioContextRef.current.state === 'suspended') {
          console.log("New AudioContext is suspended, attempting to resume");
          audioContextRef.current.resume()
            .then(() => console.log("Successfully resumed new AudioContext"))
            .catch(err => console.error("Failed to resume new AudioContext:", err));
        }
      } catch (error) {
        console.error("Error creating AudioContext:", error);
      }
    }
    return audioContextRef.current;
  }, []);
  
  // Setup one-time event listener for user interaction to resume AudioContext
  useEffect(() => {
    const resumeAudioContext = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        console.log("Resuming AudioContext on user interaction");
        audioContextRef.current.resume().catch(console.error);
      }
    };
    
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, resumeAudioContext, { once: true });
    });
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resumeAudioContext);
      });
    };
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

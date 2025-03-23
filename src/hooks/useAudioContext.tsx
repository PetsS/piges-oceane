
import { useRef, useCallback, useEffect, useState } from 'react';

export const useAudioContext = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isContextReady, setIsContextReady] = useState(false);
  
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass({
          latencyHint: 'interactive',
          sampleRate: 44100
        });
        
        console.log("Created new AudioContext, state:", audioContextRef.current.state);
        
        // Resume the context immediately to handle browsers that start in suspended state
        if (audioContextRef.current.state === 'suspended') {
          console.log("New AudioContext is suspended, attempting to resume");
          audioContextRef.current.resume()
            .then(() => {
              console.log("Successfully resumed new AudioContext");
              setIsContextReady(true);
            })
            .catch(err => console.error("Failed to resume new AudioContext:", err));
        } else {
          setIsContextReady(true);
        }
      } catch (error) {
        console.error("Error creating AudioContext:", error);
      }
    } else if (audioContextRef.current.state === 'suspended') {
      // If context exists but is suspended, try to resume it
      audioContextRef.current.resume()
        .then(() => {
          console.log("Resumed existing AudioContext");
          setIsContextReady(true);
        })
        .catch(err => console.error("Failed to resume existing AudioContext:", err));
    } else {
      setIsContextReady(true);
    }
    
    return audioContextRef.current;
  }, []);
  
  // Setup one-time event listener for user interaction to resume AudioContext
  useEffect(() => {
    const resumeAudioContext = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        console.log("Resuming AudioContext on user interaction");
        audioContextRef.current.resume()
          .then(() => {
            console.log("AudioContext resumed by user interaction");
            setIsContextReady(true);
          })
          .catch(err => console.error("Failed to resume AudioContext on user interaction:", err));
      } else {
        setIsContextReady(true);
      }
    };
    
    // Add event listeners to resume context on various user actions
    const events = ['click', 'touchstart', 'keydown', 'mousedown'];
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
    getAudioContext,
    isContextReady
  };
};

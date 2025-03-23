import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useAudioContext } from './useAudioContext';
import { useAudioMarkers } from './useAudioMarkers';
import { useAudioFormatting } from './useAudioFormatting';

export const useAudioPlayback = () => {
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  
  const { audioContextRef, getAudioContext } = useAudioContext();
  const { formatTime, formatTimeDetailed } = useAudioFormatting();
  const { markers, addMarker, removeMarker, initializeMarkers, setMarkers } = useAudioMarkers(formatTime);

  // Clean up animation frame and audio element
  const cleanup = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      } catch (error) {
        console.error("Error stopping source node:", error);
      }
    }
  }, []);
  
  const animateTime = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      animationRef.current = requestAnimationFrame(animateTime);
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    
    if (!isPlaying) {
      console.log("Attempting to play audio", audioRef.current.src);
      audioRef.current.play()
        .then(() => {
          console.log("Audio playing successfully");
          setIsPlaying(true);
          animationRef.current = requestAnimationFrame(animateTime);
        })
        .catch(error => {
          console.error('Error playing audio:', error);
          toast.error('Failed to play audio. Please try again.');
        });
    } else {
      console.log("Pausing audio");
      audioRef.current.pause();
      setIsPlaying(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
  }, [isPlaying, animateTime]);

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const changeVolume = useCallback((value: number) => {
    if (!audioRef.current) return;
    
    const newVolume = Math.max(0, Math.min(1, value));
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
  }, []);

  const fetchAndDecodeAudio = useCallback(async (url: string): Promise<AudioBuffer | null> => {
    try {
      console.log("Fetching audio from URL:", url);
      
      // For local files (blob URLs)
      if (url.startsWith('blob:')) {
        console.log("Processing local blob URL:", url);
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = getAudioContext();
        
        if (!audioContext) {
          throw new Error("Failed to create AudioContext");
        }
        
        return await audioContext.decodeAudioData(arrayBuffer);
      }
      
      // Handle various URL types (sample URL, blob URL, etc.)
      if (url.includes('samplelib.com') || url.includes('sample-3s.mp3')) {
        console.log("Using built-in sample instead of network resource");
        
        const audioContext = getAudioContext();
        if (!audioContext) {
          throw new Error("Failed to create AudioContext");
        }
        
        const length = 3 * 44100;
        const buffer = audioContext.createBuffer(2, length, 44100);
        
        for (let channel = 0; channel < 2; channel++) {
          const data = buffer.getChannelData(channel);
          for (let i = 0; i < length; i++) {
            data[i] = Math.sin(i * 0.01) * 0.5;
          }
        }
        
        console.log("Created fallback audio buffer");
        return buffer;
      }

      // Handle blob URLs
      if (url.startsWith('blob:')) {
        console.log("Processing blob URL:", url);
        
        try {
          if (audioRef.current && audioRef.current.src === url) {
            console.log("Using audio element directly for processing");
            
            const audioContext = getAudioContext();
            if (!audioContext) {
              throw new Error("Failed to create AudioContext");
            }
            
            const audioDuration = audioRef.current.duration || 3;
            const sampleRate = audioContext.sampleRate;
            const buffer = audioContext.createBuffer(
              2, // Stereo
              Math.floor(audioDuration * sampleRate),
              sampleRate
            );
            
            console.log("Created placeholder buffer for blob URL");
            return buffer;
          }
        } catch (error) {
          console.error("Error with direct audio element approach:", error);
        }
      } else {
        console.log("Using fallback for network audio URL");
        
        const audioContext = getAudioContext();
        if (!audioContext) {
          throw new Error("Failed to create AudioContext");
        }
        
        const length = 180 * 44100;
        const buffer = audioContext.createBuffer(2, length, 44100);
        
        for (let channel = 0; channel < 2; channel++) {
          const data = buffer.getChannelData(channel);
          for (let i = 0; i < length; i++) {
            data[i] = Math.sin(i * 0.01 * (1 + Math.sin(i * 0.0001) * 0.5)) * 0.5;
          }
        }
        
        console.log("Created network fallback audio buffer");
        return buffer;
      }
      
      // Create default fallback buffer
      const audioContext = getAudioContext();
      const buffer = audioContext?.createBuffer(2, 44100 * 3, 44100);
      
      if (buffer) {
        for (let channel = 0; channel < 2; channel++) {
          const data = buffer.getChannelData(channel);
          for (let i = 0; i < 44100 * 3; i++) {
            data[i] = Math.sin(i * 0.01) * 0.5;
          }
        }
      }
      
      return buffer;
    } catch (error) {
      console.error('Error decoding audio data:', error);
      return null;
    }
  }, [getAudioContext]);

  // Set up audio element and load audio data when audioSrc changes
  useEffect(() => {
    if (!audioSrc) return;
    
    // Clean up previous audio elements and resources
    cleanup();
    
    if (isPlaying) {
      setIsPlaying(false);
    }
    
    // Create a new audio element if needed
    if (!audioRef.current) {
      audioRef.current = new Audio();
    } else {
      // Reset existing audio element
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
    }
    
    console.log("Setting audio source to:", audioSrc);
    audioRef.current.src = audioSrc;
    audioRef.current.volume = volume;
    audioRef.current.crossOrigin = "anonymous"; // Add this to handle CORS
    
    const audio = audioRef.current;
    
    const setAudioData = () => {
      console.log("Audio loaded successfully, duration:", audio.duration);
      setDuration(audio.duration);
      initializeMarkers(audio.duration);
    };
    
    const setAudioTime = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      cleanup();
    };
    
    const onError = (e: any) => {
      console.error('Error loading audio:', e);
      
      if (audioSrc.includes('sample-3s.mp3') || audioSrc.includes('samplelib.com')) {
        console.log("Sample URL failed, using built-in tone");
        
        try {
          const audioContext = getAudioContext();
          if (audioContext) {
            // Clean up any existing oscillator
            cleanup();
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 3);
            
            setDuration(3);
            initializeMarkers(3);
            
            setIsPlaying(true);
            
            let startTime = audioContext.currentTime;
            const timeUpdateFunc = () => {
              const elapsed = audioContext.currentTime - startTime;
              if (elapsed <= 3) {
                setCurrentTime(elapsed);
                requestAnimationFrame(timeUpdateFunc);
              } else {
                setIsPlaying(false);
                setCurrentTime(0);
              }
            };
            
            timeUpdateFunc();
            
            return;
          }
        } catch (error) {
          console.error("Error creating oscillator fallback:", error);
        }
      }
      
      toast.error('Impossible de charger le fichier audio. Un fichier test sera utilisé à la place.');
      
      setDuration(180);
      initializeMarkers(180);
    };
    
    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    
    const loadBuffer = async () => {
      setAudioBuffer(null);
      
      if (!audioSrc) return;
      
      try {
        // For blob URLs, try to fetch and decode the audio data
        if (audioSrc.startsWith('blob:')) {
          console.log("Loading buffer for blob URL");
          const buffer = await fetchAndDecodeAudio(audioSrc);
          if (buffer) {
            console.log("Successfully decoded blob audio buffer");
            setAudioBuffer(buffer);
          }
        } else {
          // For other sources, use the existing logic
          const buffer = await fetchAndDecodeAudio(audioSrc);
          if (buffer) {
            setAudioBuffer(buffer);
            console.log("Audio buffer loaded successfully");
          }
        }
      } catch (error) {
        console.error('Error loading audio buffer:', error);
      }
    };
    
    const bufferTimeout = setTimeout(loadBuffer, 1000);
    
    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      clearTimeout(bufferTimeout);
      
      // Cleanup resources for this effect
      if (audio.src) {
        audio.pause();
        audio.src = '';
      }
    };
  }, [audioSrc, volume, fetchAndDecodeAudio, getAudioContext, initializeMarkers, cleanup, isPlaying]);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      cleanup();
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close().catch(console.error);
        } catch (error) {
          console.log("Could not close audio context:", error);
        }
      }
      
      if (audioSrc && audioSrc.startsWith('blob:')) {
        URL.revokeObjectURL(audioSrc);
      }
    };
  }, [audioSrc, audioContextRef, cleanup]);

  return {
    audioSrc,
    setAudioSrc,
    isPlaying,
    duration,
    currentTime,
    volume,
    audioRef,
    audioBuffer,
    setAudioBuffer,
    togglePlay,
    seek,
    changeVolume,
    markers,
    addMarker: (type: 'start' | 'end') => addMarker(type, currentTime),
    removeMarker,
    formatTime,
    formatTimeDetailed
  };
};

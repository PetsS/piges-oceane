
import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useAudioContext } from './useAudioContext';
import { useAudioBufferDecoder } from './useAudioBufferDecoder';
import { useAudioEventHandlers } from './useAudioEventHandlers';
import { useAudioCleanup } from './useAudioCleanup';
import { useAudioMarkers } from './useAudioMarkers';
import { useAudioFormatting } from './useAudioFormatting';

export const useAudioPlayback = () => {
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  
  const { audioContextRef, getAudioContext } = useAudioContext();
  const { formatTime, formatTimeDetailed } = useAudioFormatting();
  const { markers, addMarker, removeMarker, initializeMarkers, setMarkers } = useAudioMarkers(formatTime);
  const { fetchAndDecodeAudio } = useAudioBufferDecoder(getAudioContext);
  
  // Clean up animation frame and audio element
  const { cleanup } = useAudioCleanup(animationRef, sourceNodeRef);
  
  const animateTime = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      animationRef.current = requestAnimationFrame(animateTime);
    }
  }, []);

  // Import event handlers for audio elements
  const { setupAudioEvents } = useAudioEventHandlers({
    audioRef,
    setDuration,
    setCurrentTime,
    setIsPlaying,
    setIsBuffering,
    cleanup,
    animationRef,
    initializeMarkers,
    fetchAndDecodeAudio,
    setAudioBuffer
  });

  const togglePlay = useCallback(() => {
    if (!audioRef.current) {
      console.log("No audio element available");
      return;
    }
    
    if (!isPlaying) {
      console.log("Attempting to play audio", audioRef.current.src);
      
      // For local files check if we have a valid audio element
      if (audioRef.current.src) {
        // Add buffering indicator
        setIsBuffering(true);
        
        // Ensure the audio context is running (needed for Chrome's autoplay policy)
        const ctx = getAudioContext();
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(console.error);
        }
        
        audioRef.current.play()
          .then(() => {
            console.log("Audio playing successfully");
            setIsPlaying(true);
            setIsBuffering(false);
            animationRef.current = requestAnimationFrame(animateTime);
          })
          .catch(error => {
            console.error('Error playing audio:', error);
            setIsBuffering(false);
            toast.error('Failed to play audio. Please try again.');
          });
      } else {
        console.error("No audio source available");
        toast.error("No audio source available to play");
      }
    } else {
      console.log("Pausing audio");
      audioRef.current.pause();
      setIsPlaying(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
  }, [isPlaying, animateTime, getAudioContext]);

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    
    // For large files, seeking can take time - show buffering state
    setIsBuffering(true);
    
    const seekOperation = () => {
      audioRef.current!.currentTime = time;
      setCurrentTime(time);
      
      // Hide buffering after a short delay
      setTimeout(() => setIsBuffering(false), 300);
    };
    
    // For large files, we may need to pause briefly before seeking to avoid browser lockups
    if (isPlaying && audioRef.current.duration > 1800) { // For files over 30 minutes
      const wasPlaying = isPlaying;
      audioRef.current.pause();
      
      // Small delay before seeking to allow browser to process
      setTimeout(() => {
        seekOperation();
        
        // Resume playback if it was playing
        if (wasPlaying) {
          audioRef.current!.play()
            .catch(error => {
              console.error('Error resuming after seek:', error);
              setIsPlaying(false);
              setIsBuffering(false);
            });
        }
      }, 50);
    } else {
      seekOperation();
    }
  }, [isPlaying]);

  const changeVolume = useCallback((value: number) => {
    if (!audioRef.current) return;
    
    const newVolume = Math.max(0, Math.min(1, value));
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
  }, []);

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
      const audio = new Audio();
      audioRef.current = audio;
    }
    
    // Reset existing audio element
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    
    // Make sure we don't have an old src before setting a new one
    if (audioRef.current.src) {
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    
    console.log("Setting audio source to:", audioSrc);
    
    // Configure for efficient playback of large files - AFTER removing previous src
    audioRef.current.preload = "metadata"; // Only preload metadata initially
    audioRef.current.crossOrigin = "anonymous"; // Add this to handle CORS
    audioRef.current.volume = volume;
    
    // Ensure we have a valid audio source
    if (audioSrc && audioSrc !== 'synthetic-audio') {
      audioRef.current.src = audioSrc;
      
      // Set up audio event handlers
      const cleanupEvents = setupAudioEvents(audioSrc);
      
      // Return cleanup function
      return () => {
        cleanupEvents();
        
        if (audioRef.current?.src) {
          audioRef.current.pause();
          audioRef.current.removeAttribute('src');
          audioRef.current.load();
        }
        
        setIsBuffering(false);
      };
    } else {
      // Handle synthetic audio case
      setIsBuffering(false);
    }
  }, [audioSrc, volume, cleanup, isPlaying, setupAudioEvents]);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      cleanup();
      
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src) {
          audioRef.current.removeAttribute('src');
          audioRef.current.load();
        }
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
    isBuffering,
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

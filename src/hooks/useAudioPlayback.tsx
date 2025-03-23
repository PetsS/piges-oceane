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
  
  const { cleanup } = useAudioCleanup(animationRef, sourceNodeRef);
  
  const animateTime = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      animationRef.current = requestAnimationFrame(animateTime);
    }
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      console.log("Creating new Audio element");
      const audio = new Audio();
      audio.volume = volume;
      audio.preload = "auto";
      audio.crossOrigin = "anonymous";
      audioRef.current = audio;
    }
  }, [volume]);

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
      console.error("No audio element available");
      toast.error("Audio player not initialized");
      return;
    }
    
    console.log("Toggle play called, current state:", isPlaying ? "playing" : "paused");
    console.log("Audio element current src:", audioRef.current.src);
    console.log("Audio element readyState:", audioRef.current.readyState);
    
    if (!isPlaying) {
      setIsBuffering(true);
      
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        console.log("Resuming suspended AudioContext");
        ctx.resume().catch(err => console.error("Failed to resume AudioContext:", err));
      }
      
      if (!audioRef.current.src && audioSrc) {
        console.log("Setting audio src to:", audioSrc);
        audioRef.current.src = audioSrc;
        audioRef.current.load();
      }
      
      setTimeout(() => {
        console.log("Attempting to play audio after delay");
        const playPromise = audioRef.current?.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log("Audio playing successfully");
              setIsPlaying(true);
              setIsBuffering(false);
              animationRef.current = requestAnimationFrame(animateTime);
            })
            .catch(error => {
              console.error('Error playing audio:', error);
              setIsBuffering(false);
              
              toast.error("Failed to play audio. Try clicking the play button again.");
              
              const audioCtx = getAudioContext();
              if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume()
                  .then(() => {
                    console.log("AudioContext resumed, try playing again");
                  })
                  .catch(err => {
                    console.error('Failed to resume audio context:', err);
                  });
              }
            });
        } else {
          console.error("Play promise undefined");
          setIsBuffering(false);
          toast.error("Cannot play this audio file");
        }
      }, 100);
    } else {
      console.log("Pausing audio");
      audioRef.current.pause();
      setIsPlaying(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
  }, [isPlaying, animateTime, getAudioContext, audioSrc]);

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    
    setIsBuffering(true);
    
    const seekOperation = () => {
      audioRef.current!.currentTime = time;
      setCurrentTime(time);
      
      setTimeout(() => setIsBuffering(false), 300);
    };
    
    if (isPlaying && audioRef.current.duration > 1800) {
      const wasPlaying = isPlaying;
      audioRef.current.pause();
      
      setTimeout(() => {
        seekOperation();
        
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

  useEffect(() => {
    if (!audioSrc) return;
    
    console.log("Audio source changed to:", audioSrc);
    cleanup();
    
    if (isPlaying) {
      setIsPlaying(false);
    }
    
    if (!audioRef.current) {
      console.log("Creating new Audio element for new source");
      const audio = new Audio();
      audioRef.current = audio;
    }
    
    const audio = audioRef.current;
    
    audio.pause();
    audio.currentTime = 0;
    
    if (audio.src) {
      console.log("Removing existing audio source");
      audio.removeAttribute('src');
      audio.load();
    }
    
    console.log("Setting up new audio with source:", audioSrc);
    
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    audio.volume = volume;
    
    if (audioSrc && audioSrc !== 'synthetic-audio') {
      console.log("Setting audio src attribute to:", audioSrc);
      audio.src = audioSrc;
      
      const cleanupEvents = setupAudioEvents(audioSrc);
      
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
      console.log("Using synthetic audio, not setting src directly");
      setIsBuffering(false);
    }
  }, [audioSrc, volume, cleanup, isPlaying, setupAudioEvents, getAudioContext]);

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

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
      
      if (audioRef.current.src) {
        setIsBuffering(true);
        
        const ctx = getAudioContext();
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(console.error);
        }
        
        audioRef.current.load();
        
        setTimeout(() => {
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
                
                if (ctx && ctx.state === 'suspended') {
                  ctx.resume()
                    .then(() => {
                      audioRef.current?.play()
                        .then(() => {
                          setIsPlaying(true);
                          setIsBuffering(false);
                          animationRef.current = requestAnimationFrame(animateTime);
                        })
                        .catch(secondError => {
                          console.error('Second attempt to play audio failed:', secondError);
                          toast.error('Failed to play audio. Please try again.');
                        });
                    })
                    .catch(err => {
                      console.error('Failed to resume audio context:', err);
                      toast.error('Failed to play audio. Please try again.');
                    });
                } else {
                  toast.error('Failed to play audio. Please try again.');
                }
              });
          } else {
            setIsBuffering(false);
            toast.error('Cannot play this audio file');
          }
        }, 100);
      } else {
        console.error("No audio source available");
        toast.error("No audio source available to play");
        setIsBuffering(false);
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
    
    cleanup();
    
    if (isPlaying) {
      setIsPlaying(false);
    }
    
    if (!audioRef.current) {
      const audio = new Audio();
      audioRef.current = audio;
    }
    
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    
    if (audioRef.current.src) {
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    
    console.log("Setting audio source to:", audioSrc);
    
    audioRef.current.preload = "auto";
    audioRef.current.crossOrigin = "anonymous";
    audioRef.current.volume = volume;
    
    if (audioSrc && audioSrc !== 'synthetic-audio') {
      audioRef.current.src = audioSrc;
      
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

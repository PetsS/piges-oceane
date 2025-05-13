
import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { AudioMarker } from './useAudioTypes';
import { useAudioContext } from './useAudioContext';

export const useAudioControls = ({
  audioRef,
  isPlaying,
  setIsPlaying,
  currentTime,
  setCurrentTime,
  duration,
  setDuration,
  volume, 
  setVolume,
  audioSrc,
  markers,
  setMarkers,
  isBuffering,
  setIsBuffering,
  formatTime
}) => {
  const { getAudioContext } = useAudioContext();

  // Add marker at current time
  const addMarker = useCallback((type: 'start' | 'end') => {
    // If we don't have any markers yet and the user adds a marker,
    // let's automatically add the other one at the appropriate position
    if (markers.length === 0) {
      const otherType = type === 'start' ? 'end' : 'start';
      const otherPosition = type === 'start' ? duration : 0;
      
      const otherMarker: AudioMarker = {
        id: `${otherType}-${Date.now() + 1}`,
        position: otherPosition,
        type: otherType as 'start' | 'end'
      };
      
      setMarkers([otherMarker]);
    }
    
    const filteredMarkers = markers.filter(marker => marker.type !== type);
    
    const newMarker: AudioMarker = {
      id: `${type}-${Date.now()}`,
      position: currentTime,
      type
    };
    
    setMarkers([...filteredMarkers, newMarker]);
    
    toast.success(`Marqueur ${type === 'start' ? 'début' : 'fin'} défini à ${formatTime(currentTime)}`);
  }, [markers, currentTime, duration, setMarkers, formatTime]);
  
  // Remove marker by ID
  const removeMarker = useCallback((id: string) => {
    setMarkers(markers.filter(marker => marker.id !== id));
  }, [markers, setMarkers]);
  
  // Toggle play/pause with direct HTMLAudioElement usage
  const togglePlay = useCallback(() => {
    if (!audioRef.current) {
      console.error("No audio element available");
      return;
    }
    
    // First ensure AudioContext is running
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      console.log("Resuming suspended AudioContext before playback");
      ctx.resume().catch(err => console.error("Failed to resume AudioContext:", err));
    }
    
    console.log("Toggle play called, current state:", isPlaying ? "playing" : "paused");
    console.log("Audio element readyState:", audioRef.current.readyState);
    
    if (!isPlaying) {
      setIsBuffering(true);
      
      // Ensure source is set
      if (!audioRef.current.src && audioSrc) {
        console.log("Setting audio src to:", audioSrc);
        audioRef.current.src = audioSrc;
        audioRef.current.load();
      }
      
      // Small delay to ensure UI updates and any browser policies are satisfied
      setTimeout(() => {
        if (!audioRef.current) return;
        
        console.log("Attempting to play audio");
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log("Audio playing successfully");
              setIsPlaying(true);
              setIsBuffering(false);
            })
            .catch(error => {
              console.error('Error playing audio:', error);
              setIsBuffering(false);
              toast.error("Failed to play audio. Please try again.");
              
              // Try resuming the context again on error
              const audioCtx = getAudioContext();
              if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume().catch(err => {
                  console.error('Failed to resume audio context:', err);
                });
              }
            });
        } else {
          console.error("Play promise undefined");
          setIsBuffering(false);
        }
      }, 100);
    } else {
      console.log("Pausing audio");
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isPlaying, setIsPlaying, setIsBuffering, audioRef, audioSrc, getAudioContext]);
  
  // Seek to time
  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    
    setIsBuffering(true);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
    
    // Hide buffering after a small delay
    setTimeout(() => setIsBuffering(false), 300);
  }, [audioRef, setCurrentTime, setIsBuffering]);
  
  // Change volume
  const changeVolume = useCallback((value: number) => {
    if (!audioRef.current) return;
    
    const newVolume = Math.max(0, Math.min(1, value));
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
  }, [audioRef, setVolume]);
  
  // Update time display from audio element
  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;
    
    const timeUpdateHandler = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const loadedDataHandler = () => {
      setDuration(audio.duration);
      setIsBuffering(false);
    };
    
    const playHandler = () => {
      console.log("Audio play event triggered");
      setIsPlaying(true);
      setIsBuffering(false);
    };
    
    const pauseHandler = () => {
      console.log("Audio pause event triggered");
      setIsPlaying(false);
    };
    
    const endedHandler = () => {
      console.log("Audio ended event triggered");
      setIsPlaying(false);
      setCurrentTime(0);
    };
    
    const errorHandler = (e) => {
      console.error("Audio error:", e);
      setIsBuffering(false);
      setIsPlaying(false);
      toast.error("Error playing audio");
    };
    
    // Add event listeners
    audio.addEventListener('timeupdate', timeUpdateHandler);
    audio.addEventListener('loadeddata', loadedDataHandler);
    audio.addEventListener('play', playHandler);
    audio.addEventListener('pause', pauseHandler);
    audio.addEventListener('ended', endedHandler);
    audio.addEventListener('error', errorHandler);
    
    // Clean up
    return () => {
      audio.removeEventListener('timeupdate', timeUpdateHandler);
      audio.removeEventListener('loadeddata', loadedDataHandler);
      audio.removeEventListener('play', playHandler);
      audio.removeEventListener('pause', pauseHandler);
      audio.removeEventListener('ended', endedHandler);
      audio.removeEventListener('error', errorHandler);
    };
  // }, [audioRef, setCurrentTime, setDuration, setIsPlaying, setIsBuffering]);
  }, [audioRef.current]);
  
  return {
    addMarker,
    removeMarker,
    togglePlay,
    seek,
    changeVolume
  };
};

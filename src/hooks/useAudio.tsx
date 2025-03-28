
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useAudioContext } from './useAudioContext';
import { useAudioFormatting } from './useAudioFormatting';
import { useAudioPlayback } from './useAudioPlayback';
import { useAudioFiles } from './useAudioFiles';
import { AudioMarker, AudioFile } from './useAudioTypes';

export type { AudioMarker, AudioFile };

export const useAudio = () => {
  // Initialize internal state
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [markers, setMarkers] = useState<AudioMarker[]>([]);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showMarkerControls, setShowMarkerControls] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  
  // Create refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const processingRef = useRef<boolean>(false);
  
  // Initialize context and utils
  const { getAudioContext, isContextReady } = useAudioContext();
  const { formatTime, formatTimeDetailed } = useAudioFormatting();
  
  // Initialize files management
  const { 
    audioFiles, 
    isLoading, 
    currentAudioFile, 
    loadAudioFile, 
    loadFilesFromUNC 
  } = useAudioFiles(
    setAudioSrc,
    setAudioBuffer,
    setIsPlaying,
    setCurrentTime,
    (duration) => {
      // Don't automatically initialize markers - we'll let the user add them
      // when they want to edit
      setDuration(duration);
    },
    getAudioContext,
    audioRef,
    audioSrc
  );
  
  // Add marker at current time
  const addMarker = (type: 'start' | 'end') => {
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
  };
  
  // Remove marker by ID
  const removeMarker = (id: string) => {
    setMarkers(markers.filter(marker => marker.id !== id));
  };
  
  // Initialize audio element if it doesn't exist
  useEffect(() => {
    if (!audioRef.current) {
      console.log("Creating new Audio element in useAudio");
      const audio = new Audio();
      audio.volume = volume;
      audio.preload = "auto";
      audio.crossOrigin = "anonymous";
      audioRef.current = audio;
    }
  }, [volume]);
  
  // Toggle play/pause with direct HTMLAudioElement usage
  const togglePlay = () => {
    if (!audioRef.current) {
      console.error("No audio element available");
      toast.error("Audio player not initialized");
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
      
      // For synthetic audio or network files, play a silent audio buffer
      if (audioSrc === 'synthetic-audio' && audioBuffer) {
        console.log("Playing synthetic audio from buffer");
        
        try {
          const context = getAudioContext();
          if (!context) {
            throw new Error("AudioContext not available");
          }
          
          // Create a source node
          const source = context.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(context.destination);
          
          // Set up time tracking
          let startTime = context.currentTime;
          
          const updateTimer = () => {
            if (isPlaying) {
              const elapsedTime = context.currentTime - startTime;
              setCurrentTime(elapsedTime);
              requestAnimationFrame(updateTimer);
            }
          };
          
          // Start playback
          source.start(0);
          setIsPlaying(true);
          setIsBuffering(false);
          requestAnimationFrame(updateTimer);
          
          // Handle when playback ends
          source.onended = () => {
            setIsPlaying(false);
            console.log("Synthetic audio playback ended");
          };
        } catch (error) {
          console.error("Error playing synthetic audio:", error);
          setIsBuffering(false);
          toast.error("Error playing audio");
        }
        return;
      }
      
      // Ensure source is set for regular audio files
      if (audioSrc && audioSrc !== 'synthetic-audio') {
        console.log("Setting audio src to:", audioSrc);
        audioRef.current.src = audioSrc;
        audioRef.current.load();
      } else if (!audioSrc && currentAudioFile) {
        console.log("No audio src but have file, setting src to:", currentAudioFile.path);
        audioRef.current.src = currentAudioFile.path;
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
  };
  
  // Seek to time
  const seek = (time: number) => {
    if (!audioRef.current) return;
    
    setIsBuffering(true);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
    
    // Hide buffering after a small delay
    setTimeout(() => setIsBuffering(false), 300);
  };
  
  // Change volume
  const changeVolume = (value: number) => {
    if (!audioRef.current) return;
    
    const newVolume = Math.max(0, Math.min(1, value));
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
  };
  
  // Update time display from audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
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
  }, []);

  // Placeholder function that always returns false to disable export
  const exportTrimmedAudio = () => {
    toast.info("Fonction d'export désactivée", {
      description: "La fonctionnalité d'export a été désactivée temporairement."
    });
  };
  
  return {
    audioSrc,
    isPlaying,
    duration,
    currentTime,
    volume,
    markers,
    audioFiles,
    isLoading,
    currentAudioFile,
    isBuffering,
    showMarkerControls,
    isExporting: false, // Always false since we've removed export functionality
    exportProgress: 0,
    exportError: null,
    setShowMarkerControls,
    togglePlay,
    seek,
    changeVolume,
    addMarker,
    removeMarker,
    exportTrimmedAudio,
    loadAudioFile,
    loadFilesFromUNC,
    formatTime,
    formatTimeDetailed
  };
};

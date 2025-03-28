import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useAudioContext } from './useAudioContext';
import { useAudioFormatting } from './useAudioFormatting';
import { useAudioPlayback } from './useAudioPlayback';
import { useAudioFiles } from './useAudioFiles';
import { useAudioMarkers } from './useAudioMarkers';
import { AudioMarker, AudioFile } from './useAudioTypes';
import * as lamejs from 'lamejs';

export type { AudioMarker, AudioFile };

export const useAudio = () => {
  // Initialize internal state
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
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
  
  // Get the marker utilities
  const { markers, addMarker, removeMarker, setMarkers } = useAudioMarkers(formatTime);
  
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
    setDuration,
    getAudioContext,
    audioRef,
    audioSrc
  );
  
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
  
  // Add marker at current time without moving playback position
  const handleAddMarker = (type: 'start' | 'end', time: number) => {
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
    
    // Add the marker at the specified time without changing playback position
    addMarker(type, time);
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

  // Export trimmed audio using the original file format
  const exportTrimmedAudio = async () => {
    const startMarker = markers.find(marker => marker.type === 'start');
    const endMarker = markers.find(marker => marker.type === 'end');
    
    if (!startMarker || !endMarker) {
      toast.error("Les marqueurs de début et de fin doivent être définis");
      return;
    }
    
    if (startMarker.position >= endMarker.position) {
      toast.error("Le marqueur de début doit être avant le marqueur de fin");
      return;
    }
    
    if (!audioRef.current && !audioBuffer) {
      toast.error("Aucun fichier audio chargé");
      return;
    }
    
    setIsExporting(true);
    setExportProgress(0);
    setExportError(null);
    
    try {
      const ctx = getAudioContext();
      if (!ctx) {
        throw new Error("Impossible d'accéder au contexte audio");
      }
      
      const startTime = startMarker.position;
      const endTime = endMarker.position;
      const duration = endTime - startTime;
      
      // Create offline audio context for processing
      const offlineCtx = new OfflineAudioContext(
        2, // stereo
        Math.ceil(duration * ctx.sampleRate),
        ctx.sampleRate
      );
      
      // Get audio data - either from audio element or from existing buffer
      let sourceBuffer: AudioBuffer;
      
      if (audioBuffer) {
        // Use existing buffer
        sourceBuffer = audioBuffer;
      } else {
        // Need to fetch and decode the audio
        const audioElement = audioRef.current;
        if (!audioElement || !audioElement.src) {
          throw new Error("Source audio non disponible");
        }
        
        setExportProgress(5);
        
        // Fetch the audio file
        const response = await fetch(audioElement.src);
        const arrayBuffer = await response.arrayBuffer();
        
        setExportProgress(20);
        
        // Decode the audio data
        sourceBuffer = await ctx.decodeAudioData(arrayBuffer);
        setExportProgress(40);
      }
      
      // Create buffer source
      const source = offlineCtx.createBufferSource();
      source.buffer = sourceBuffer;
      
      // Connect source to offline context
      source.connect(offlineCtx.destination);
      
      // Start the source at the appropriate offset
      source.start(0, startTime, duration);
      
      setExportProgress(50);
      
      // Render the audio
      const renderedBuffer = await offlineCtx.startRendering();
      
      setExportProgress(70);
      
      // Determine file type from original source
      const originalFileType = currentAudioFile ? 
        (currentAudioFile.name.toLowerCase().endsWith('.wav') ? 'audio/wav' : 'audio/mp3') : 
        'audio/mp3';
      
      // Create a media stream source
      const audioCtx = new AudioContext();
      const mediaStreamDest = audioCtx.createMediaStreamDestination();
      const sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = renderedBuffer;
      sourceNode.connect(mediaStreamDest);
      
      // Create a media recorder to capture the stream with the appropriate format
      const mediaRecorder = new MediaRecorder(mediaStreamDest.stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
      });
      
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        setExportProgress(90);
        
        // Create the blob from all chunks
        const blob = new Blob(chunks, { type: originalFileType });
        const url = URL.createObjectURL(blob);
        
        // Get appropriate file extension
        const fileExt = originalFileType === 'audio/wav' ? '.wav' : '.mp3';
        
        // Trigger download
        const fileName = currentAudioFile 
          ? `${currentAudioFile.name.replace(/\.[^/.]+$/, '')}_trim${fileExt}`
          : `audio_trim_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}${fileExt}`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setExportProgress(100);
          toast.success("Export réussi");
          
          setTimeout(() => {
            setIsExporting(false);
            setExportProgress(0);
          }, 1000);
        }, 100);
      };
      
      // Start recording and then stop immediately after source has played
      mediaRecorder.start();
      sourceNode.start(0);
      
      // Stop after duration
      setTimeout(() => {
        sourceNode.stop();
        mediaRecorder.stop();
        audioCtx.close();
      }, duration * 1000 + 100);
      
      setExportProgress(80);
      
    } catch (error) {
      console.error("Error exporting audio:", error);
      setExportError(`Erreur: ${error.message || "Échec de l'export"}`);
      toast.error(`Erreur lors de l'export: ${error.message || "Échec de l'export"}`);
      setIsExporting(false);
    }
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
    isExporting,
    exportProgress,
    exportError,
    setShowMarkerControls,
    togglePlay,
    seek,
    changeVolume,
    addMarker: handleAddMarker,
    removeMarker,
    exportTrimmedAudio,
    loadAudioFile,
    loadFilesFromUNC,
    formatTime,
    formatTimeDetailed
  };
};

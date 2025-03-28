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
  
  // Get the utility function for adding markers
  const { addMarker: addMarkerUtil } = useAudioMarkers(formatTime);
  
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
  
  // Add marker at current time without moving playback position
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
    
    // Don't need to modify playback position
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

  // Export trimmed audio using lamejs
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
      
      // Convert to MP3 using lamejs
      const channels = renderedBuffer.numberOfChannels;
      const sampleRate = renderedBuffer.sampleRate;
      const bitRate = 192;
      
      // Create encoder without using MPEGMode since it's causing issues
      const mp3Encoder = new lamejs.Mp3Encoder(channels, sampleRate, bitRate);
      
      const mp3Data = [];
      const sampleBlockSize = 1152; // Must be a multiple of 576 for lamejs
      
      // Process each channel
      for (let i = 0; i < renderedBuffer.length; i += sampleBlockSize) {
        // Update progress periodically
        if (i % (sampleBlockSize * 10) === 0) {
          const progress = 70 + Math.min(25, (i / renderedBuffer.length) * 25);
          setExportProgress(progress);
        }
        
        // Create samples arrays for processing
        const leftSamples = new Int16Array(sampleBlockSize);
        const rightSamples = new Int16Array(sampleBlockSize);
        
        // Get channel data
        const leftChannel = renderedBuffer.getChannelData(0);
        const rightChannel = renderedBuffer.numberOfChannels > 1 
          ? renderedBuffer.getChannelData(1) 
          : renderedBuffer.getChannelData(0); // Mono to stereo if needed
        
        // Fill sample blocks and convert float32 to int16
        for (let j = 0; j < sampleBlockSize; j++) {
          if (i + j < renderedBuffer.length) {
            // Convert float (-1 to 1) to int16 (-32768 to 32767)
            leftSamples[j] = Math.min(1, Math.max(-1, leftChannel[i + j])) * 32767;
            rightSamples[j] = Math.min(1, Math.max(-1, rightChannel[i + j])) * 32767;
          } else {
            // Pad with silence if we're at the end
            leftSamples[j] = 0;
            rightSamples[j] = 0;
          }
        }
        
        // Encode this chunk
        const mp3buf = mp3Encoder.encodeBuffer(leftSamples, rightSamples);
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
      }
      
      // Get the final part of the mp3
      const mp3buf = mp3Encoder.flush();
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
      
      setExportProgress(95);
      
      // Combine the mp3 data into a single Uint8Array
      let mp3Size = 0;
      for (let i = 0; i < mp3Data.length; i++) {
        mp3Size += mp3Data[i].length;
      }
      
      const mp3Result = new Uint8Array(mp3Size);
      let offset = 0;
      for (let i = 0; i < mp3Data.length; i++) {
        mp3Result.set(mp3Data[i], offset);
        offset += mp3Data[i].length;
      }
      
      // Create blob and download
      const blob = new Blob([mp3Result], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      
      // Create and trigger download
      const fileName = currentAudioFile 
        ? `${currentAudioFile.name.replace(/\.[^/.]+$/, '')}_trim.mp3`
        : `audio_trim_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.mp3`;
      
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
        
        // Reset export state after a moment
        setTimeout(() => {
          setIsExporting(false);
          setExportProgress(0);
        }, 1000);
      }, 100);
      
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
    addMarker,
    removeMarker,
    exportTrimmedAudio,
    loadAudioFile,
    loadFilesFromUNC,
    formatTime,
    formatTimeDetailed
  };
};

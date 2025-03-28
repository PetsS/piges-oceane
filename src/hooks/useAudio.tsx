import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useAudioContext } from './useAudioContext';
import { useAudioFormatting } from './useAudioFormatting';
import { useAudioPlayback } from './useAudioPlayback';
import { useAudioFiles } from './useAudioFiles';
import { useAudioMarkers } from './useAudioMarkers';
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
    (duration) => {
      setDuration(duration);
      initializeMarkers(duration);
    },
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

  // Initialize markers with duration
  const initializeMarkers = (audioDuration: number) => {
    if (audioDuration > 0 && (!markers || markers.length === 0)) {
      setMarkers([
        {
          id: `start-${Date.now()}`,
          position: 0,
          type: 'start'
        },
        {
          id: `end-${Date.now() + 1}`,
          position: audioDuration,
          type: 'end'
        }
      ]);
    }
  };
  
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
  const handleAddMarker = (type: 'start' | 'end') => {
    // Store current playback state and position
    const wasPlaying = isPlaying;
    const currentPosition = currentTime;
    
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
    
    // Add the marker at the current time without changing playback position
    addMarker(type, currentPosition);
    
    // Don't change the current playback position or state
    toast.success(`Marqueur ${type === 'start' ? 'début' : 'fin'} défini à ${formatTime(currentPosition)}`);
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

  // Export trimmed audio with marker timestamps in filename
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
    
    // Save playback state to restore later
    const wasPlaying = isPlaying;
    const originalPosition = currentTime;
    
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
    
    setIsExporting(true);
    setExportProgress(5);
    setExportError(null);
    
    try {
      // Get audio data from the current source
      const audioElement = audioRef.current;
      if (!audioElement || !audioElement.src) {
        throw new Error("Source audio non disponible");
      }
      
      const startTime = startMarker.position;
      const endTime = endMarker.position;
      const duration = endTime - startTime;
      
      // Format start and end times for filename
      const startTimeFormatted = formatTime(startTime).replace(':', 'm') + 's';
      const endTimeFormatted = formatTime(endTime).replace(':', 'm') + 's';
      
      // Determine file type from original source
      const originalFileType = currentAudioFile ? 
        (currentAudioFile.name.toLowerCase().endsWith('.wav') ? 'audio/wav' : 'audio/mpeg') : 
        'audio/mpeg';
      
      setExportProgress(15);
      toast.info("Préparation de l'export...");
      
      // Create a temporary audio element for the source that won't affect our UI
      const tempAudio = new Audio();
      tempAudio.src = audioElement.src;
      tempAudio.crossOrigin = "anonymous";
      
      setExportProgress(25);
      
      // Set up audio processing
      const ctx = new AudioContext();
      const destination = ctx.createMediaStreamDestination();
      
      // Wait for the temp audio to be ready
      tempAudio.addEventListener('canplay', () => {
        try {
          const source = ctx.createMediaElementSource(tempAudio);
          source.connect(destination);
          
          setExportProgress(35);
          
          // Determine the best MIME type for recording
          const getMimeType = () => {
            // For compatibility reasons, use webm as fallback
            if (MediaRecorder.isTypeSupported('audio/webm')) {
              return 'audio/webm';
            }
            
            if (MediaRecorder.isTypeSupported('audio/mp4')) {
              return 'audio/mp4';
            }
            
            // Return empty string to let the browser decide
            return '';
          };
          
          const mimeType = getMimeType();
          console.log("Using MIME type for export:", mimeType);
          
          // Create MediaRecorder with appropriate options
          const mediaRecorder = mimeType ? 
            new MediaRecorder(destination.stream, { mimeType }) : 
            new MediaRecorder(destination.stream);
          
          const chunks: Blob[] = [];
          
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunks.push(e.data);
            }
          };
          
          mediaRecorder.onstop = () => {
            setExportProgress(85);
            toast.info("Finalisation de l'export...");
            
            // Get appropriate file extension
            const fileExt = originalFileType === 'audio/wav' ? '.wav' : '.mp3';
            
            // Create the blob from all chunks
            const blob = new Blob(chunks, { type: mimeType || originalFileType });
            const url = URL.createObjectURL(blob);
            
            // Include marker timestamps in filename
            const fileName = currentAudioFile 
              ? `${currentAudioFile.name.replace(/\.[^/.]+$/, '')}_${startTimeFormatted}_${endTimeFormatted}${fileExt}`
              : `audio_trim_${startTimeFormatted}_${endTimeFormatted}${fileExt}`;
            
            setExportProgress(95);
            
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
              ctx.close();
              setExportProgress(100);
              
              toast.success("Export réussi");
              
              // Restore original playback position
              if (audioRef.current) {
                audioRef.current.currentTime = originalPosition;
                setCurrentTime(originalPosition);
                
                // Resume playback if it was playing before
                if (wasPlaying) {
                  audioRef.current.play()
                    .then(() => setIsPlaying(true))
                    .catch(console.error);
                }
              }
              
              setTimeout(() => {
                setIsExporting(false);
                setExportProgress(0);
              }, 1000);
            }, 100);
          };
          
          // Start recording - use small chunk size for better memory usage
          mediaRecorder.start(100);
          setExportProgress(45);
          toast.info("Enregistrement en cours...");
          
          // Set the position and play just the part we want to export
          tempAudio.currentTime = startTime;
          
          tempAudio.addEventListener('timeupdate', function timeUpdateHandler() {
            const progress = ((tempAudio.currentTime - startTime) / duration) * 40 + 45;
            setExportProgress(Math.min(85, progress));
            
            if (tempAudio.currentTime >= endTime) {
              tempAudio.removeEventListener('timeupdate', timeUpdateHandler);
              tempAudio.pause();
              mediaRecorder.stop();
            }
          });
          
          tempAudio.play().catch(playError => {
            console.error("Error playing audio for export:", playError);
            throw new Error("Erreur lors de la lecture pour l'export");
          });
          
        } catch (processingError) {
          console.error("Error processing audio:", processingError);
          throw new Error(`Erreur de traitement audio: ${processingError.message}`);
        }
      }, { once: true });
      
      // Handle loading errors on the temp audio
      tempAudio.addEventListener('error', (e) => {
        console.error("Error loading audio for export:", e);
        throw new Error("Erreur de chargement du fichier audio pour l'export");
      }, { once: true });
      
      // Start loading the audio
      tempAudio.load();
      
    } catch (error) {
      console.error("Error exporting audio:", error);
      setExportError(`Erreur: ${error.message || "Échec de l'export"}`);
      toast.error(`Erreur lors de l'export: ${error.message || "Échec de l'export"}`);
      
      // Always restore original playback state on error
      if (audioRef.current) {
        audioRef.current.currentTime = originalPosition;
        setCurrentTime(originalPosition);
      }
      
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

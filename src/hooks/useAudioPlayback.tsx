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
  const [isBuffering, setIsBuffering] = useState(false);
  
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
      
      // Add buffering indicator
      setIsBuffering(true);
      
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

  const fetchAndDecodeAudio = useCallback(async (url: string): Promise<AudioBuffer | null> => {
    try {
      console.log("Fetching audio from URL:", url);
      
      // For local files (blob URLs)
      if (url.startsWith('blob:')) {
        console.log("Processing local blob URL:", url);
        
        // For large files, we only need a small portion for waveform visualization
        // Fetch only the first 5MB of data for efficiency
        const response = await fetch(url, {
          headers: {
            Range: 'bytes=0-5242880' // First 5MB only
          }
        }).catch(() => {
          // If Range header is not supported, fall back to regular fetch
          console.log("Range header not supported, fetching full file");
          return fetch(url);
        });
        
        // Read only part of the file if it's very large
        let arrayBuffer;
        
        // Only read a portion of large files to avoid memory issues
        if (response.headers.get('Content-Length') && 
            parseInt(response.headers.get('Content-Length')!) > 20 * 1024 * 1024) {
          console.log("Large file detected, processing partial data");
          const reader = response.body?.getReader();
          
          if (reader) {
            // Read only first 5MB for processing
            const maxBytes = 5 * 1024 * 1024;
            let bytesRead = 0;
            const chunks = [];
            
            while (bytesRead < maxBytes) {
              const {done, value} = await reader.read();
              if (done) break;
              
              chunks.push(value);
              bytesRead += value.length;
            }
            
            // Combine chunks into a single ArrayBuffer
            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const combinedArray = new Uint8Array(totalLength);
            
            let position = 0;
            for (const chunk of chunks) {
              combinedArray.set(chunk, position);
              position += chunk.length;
            }
            
            arrayBuffer = combinedArray.buffer;
          } else {
            arrayBuffer = await response.arrayBuffer();
          }
        } else {
          arrayBuffer = await response.arrayBuffer();
        }
        
        const audioContext = getAudioContext();
        
        if (!audioContext) {
          throw new Error("Failed to create AudioContext");
        }
        
        // For very large files (> 100MB), create a minimal buffer instead of decoding
        if (arrayBuffer.byteLength > 100 * 1024 * 1024) {
          console.log("File too large for full decoding, creating sample buffer");
          
          // Create a small buffer just for visualization (10 seconds)
          const sampleRate = audioContext.sampleRate;
          const buffer = audioContext.createBuffer(2, 10 * sampleRate, sampleRate);
          
          for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < data.length; i++) {
              data[i] = Math.sin(i * 0.01) * 0.5;
            }
          }
          
          return buffer;
        }
        
        // Try to decode the audio data
        try {
          return await audioContext.decodeAudioData(arrayBuffer);
        } catch (decodeError) {
          console.error("Error decoding audio data:", decodeError);
          
          // Create a fallback buffer
          const buffer = audioContext.createBuffer(2, 10 * audioContext.sampleRate, audioContext.sampleRate);
          for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < data.length; i++) {
              data[i] = Math.sin(i * 0.01) * 0.5;
            }
          }
          return buffer;
        }
      }
      
      // ... keep existing code (for handling sample URLs and network audio)
      
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
      const audio = new Audio();
      // Configure for efficient playback of large files
      audio.preload = "metadata"; // Only preload metadata initially
      audioRef.current = audio;
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
    
    // For large files, reduce buffering amount to save memory
    if (typeof audioRef.current.preload !== 'undefined') {
      audioRef.current.preload = "metadata";
    }
    
    const audio = audioRef.current;
    
    const setAudioData = () => {
      console.log("Audio loaded successfully, duration:", audio.duration);
      setDuration(audio.duration);
      initializeMarkers(audio.duration);
      setIsBuffering(false);
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
      setIsBuffering(false);
      
      // ... keep existing code (for fallback tone generation)
      
      toast.error('Impossible de charger le fichier audio. Un fichier test sera utilisé à la place.');
      
      // Set to 1 hour (3600 seconds) for duration to match expected file size
      setDuration(3600);
      initializeMarkers(3600);
    };
    
    // Add buffering event listeners for large files
    const onWaiting = () => {
      setIsBuffering(true);
    };
    
    const onCanPlay = () => {
      setIsBuffering(false);
    };
    
    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('loadedmetadata', setAudioData); // Also listen for metadata loaded
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    
    // Show buffering state while loading
    setIsBuffering(true);
    
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
      } finally {
        setIsBuffering(false);
      }
    };
    
    // Delay buffer loading to prioritize metadata and UI responsiveness
    const bufferTimeout = setTimeout(loadBuffer, 2000);
    
    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      clearTimeout(bufferTimeout);
      
      // Cleanup resources for this effect
      if (audio.src) {
        audio.pause();
        audio.src = '';
      }
      
      setIsBuffering(false);
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

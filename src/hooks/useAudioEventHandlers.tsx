
import { useCallback } from 'react';
import { toast } from 'sonner';

interface EventHandlerProps {
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  setDuration: (duration: number) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setIsBuffering: (isBuffering: boolean) => void;
  cleanup: () => void;
  animationRef: React.MutableRefObject<number | null>;
  initializeMarkers: (duration: number) => void;
  fetchAndDecodeAudio: (url: string) => Promise<AudioBuffer | null>;
  setAudioBuffer: (buffer: AudioBuffer | null) => void;
}

export const useAudioEventHandlers = ({
  audioRef,
  setDuration,
  setCurrentTime,
  setIsPlaying,
  setIsBuffering,
  cleanup,
  initializeMarkers,
  fetchAndDecodeAudio,
  setAudioBuffer
}: EventHandlerProps) => {
  
  const setupAudioEvents = useCallback((audioSrc: string) => {
    if (!audioRef.current) return () => {};
    
    const audio = audioRef.current;
    
    const setAudioData = () => {
      if (!audio.duration || !isFinite(audio.duration)) {
        console.warn("Audio duration is invalid:", audio.duration);
        return;
      }
      
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
    
    const onError = (e: Event) => {
      console.error('Error loading audio:', e, audio.error);
      setIsBuffering(false);
      
      toast.error('Impossible de charger le fichier audio. Un fichier test sera utilisé à la place.');
      
      // Set to 1 hour (3600 seconds) for duration to match expected file size
      setDuration(3600);
      initializeMarkers(3600);
    };
    
    // Add buffering event listeners for large files
    const onWaiting = () => {
      console.log("Audio waiting/buffering");
      setIsBuffering(true);
    };
    
    const onCanPlay = () => {
      console.log("Audio can play now");
      setIsBuffering(false);
    };
    
    const onPlay = () => {
      console.log("Audio play event triggered");
    };
    
    const onCanPlayThrough = () => {
      console.log("Audio canplaythrough event - enough data is loaded to play without interruption");
      setIsBuffering(false);
    };
    
    // Remove existing event listeners (in case this function is called multiple times)
    audio.removeEventListener('loadeddata', setAudioData);
    audio.removeEventListener('loadedmetadata', setAudioData);
    audio.removeEventListener('timeupdate', setAudioTime);
    audio.removeEventListener('ended', onEnded);
    audio.removeEventListener('error', onError);
    audio.removeEventListener('waiting', onWaiting);
    audio.removeEventListener('canplay', onCanPlay);
    audio.removeEventListener('play', onPlay);
    audio.removeEventListener('canplaythrough', onCanPlayThrough);
    
    // Add event listeners
    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('canplaythrough', onCanPlayThrough);
    
    // Show buffering state while loading
    setIsBuffering(true);
    
    // Manually trigger a load to ensure metadata loads
    audio.load();
    
    const loadBuffer = async () => {
      setAudioBuffer(null);
      
      if (!audioSrc) return;
      
      try {
        // For blob URLs, try to fetch and decode the audio data
        if (audioSrc.startsWith('blob:')) {
          console.log("Loading buffer for blob URL:", audioSrc);
          
          const buffer = await fetchAndDecodeAudio(audioSrc);
          if (buffer) {
            console.log("Successfully decoded blob audio buffer, duration:", buffer.duration);
            setAudioBuffer(buffer);
          } else {
            console.warn("Failed to decode audio buffer from blob URL");
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
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('canplaythrough', onCanPlayThrough);
      clearTimeout(bufferTimeout);
    };
  }, [audioRef, setDuration, setCurrentTime, setIsPlaying, setIsBuffering, cleanup, initializeMarkers, fetchAndDecodeAudio, setAudioBuffer]);

  return {
    setupAudioEvents
  };
};


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
    };
  }, [audioRef, setDuration, setCurrentTime, setIsPlaying, setIsBuffering, cleanup, initializeMarkers, fetchAndDecodeAudio, setAudioBuffer]);

  return {
    setupAudioEvents
  };
};

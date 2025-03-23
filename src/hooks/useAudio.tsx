
import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { useAudioContext } from './useAudioContext';
import { useAudioFormatting } from './useAudioFormatting';
import { useAudioPlayback } from './useAudioPlayback';
import { useAudioExport } from './useAudioExport';
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
  
  // Create refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const processingRef = useRef<boolean>(false);
  
  // Initialize context and utils
  const { getAudioContext } = useAudioContext();
  const { formatTime, formatTimeDetailed } = useAudioFormatting();
  
  // Initialize playback controls with partial dependencies to avoid circular dependencies
  const playback = useAudioPlayback();
  
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
      const startMarkerId = `start-${Date.now()}`;
      const endMarkerId = `end-${Date.now() + 1}`;
      
      setMarkers([
        { id: startMarkerId, position: 0, type: 'start' },
        { id: endMarkerId, position: duration, type: 'end' }
      ]);
      setDuration(duration);
    },
    getAudioContext,
    audioRef,
    audioSrc
  );
  
  // Initialize export functionality
  const { exportTrimmedAudio } = useAudioExport(
    audioBuffer, 
    markers, 
    duration, 
    formatTime, 
    audioRef, 
    currentAudioFile
  );
  
  // Add marker at current time
  const addMarker = (type: 'start' | 'end') => {
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
  
  // Toggle play/pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (!isPlaying) {
      setIsBuffering(true);
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
        })
        .catch(error => {
          console.error('Error playing audio:', error);
          setIsBuffering(false);
          toast.error('Failed to play audio. Please try again.');
        });
    } else {
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

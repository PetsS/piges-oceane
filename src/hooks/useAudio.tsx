
import { useEffect } from 'react';
import { useAudioContext } from './useAudioContext';
import { useAudioFormatting } from './useAudioFormatting';
import { useAudioExport } from './useAudioExport';
import { useAudioFiles } from './useAudioFiles';
import { useAudioState } from './useAudioState';
import { useAudioControls } from './useAudioControls';
import { AudioMarker, AudioFile } from './useAudioTypes';

export type { AudioMarker, AudioFile };

export const useAudio = () => {
  // Initialize audio state
  const {
    isPlaying,
    setIsPlaying,
    duration,
    setDuration,
    currentTime,
    setCurrentTime,
    volume,
    setVolume,
    audioSrc,
    setAudioSrc,
    audioBuffer,
    setAudioBuffer,
    markers,
    setMarkers,
    isBuffering,
    setIsBuffering,
    showMarkerControls,
    setShowMarkerControls,
    audioRef,
    processingRef
  } = useAudioState();
  
  // Initialize context and utils
  const { getAudioContext, isContextReady } = useAudioContext();
  const { formatTime, formatTimeDetailed } = useAudioFormatting();
  
  // Initialize controls with state dependencies
  const {
    addMarker,
    removeMarker,
    togglePlay,
    seek,
    changeVolume
  } = useAudioControls({
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
  });
  
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
  }, [volume, audioRef]);
  
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
  
  // Initialize export functionality
  const { exportTrimmedAudio } = useAudioExport(
    audioBuffer, 
    markers, 
    duration, 
    formatTime, 
    audioRef, 
    currentAudioFile
  );
  
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
    formatTimeDetailed,
    audioRef
  };
};

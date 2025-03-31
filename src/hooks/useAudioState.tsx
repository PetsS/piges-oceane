
import { useState, useRef } from 'react';
import { AudioMarker, AudioFile } from './useAudioTypes';

export const useAudioState = () => {
  // Initialize state
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [markers, setMarkers] = useState<AudioMarker[]>([]);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showMarkerControls, setShowMarkerControls] = useState(false);
  
  // Create refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const processingRef = useRef<boolean>(false);
  
  return {
    // State
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
    
    // Refs
    audioRef,
    processingRef
  };
};

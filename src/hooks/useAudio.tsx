
import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export interface AudioMarker {
  id: string;
  position: number; // in seconds
  type: 'start' | 'end';
}

export interface AudioFile {
  name: string;
  path: string;
  size: string;
  type: string;
  lastModified: string;
}

export const useAudio = () => {
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [markers, setMarkers] = useState<AudioMarker[]>([]);
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // This is a mock function to simulate loading files from a UNC path
  // In a real implementation, this would connect to a backend service
  const loadFilesFromUNC = useCallback(async (path: string) => {
    setIsLoading(true);
    
    // Simulate API call to get files from UNC path
    setTimeout(() => {
      const mockFiles: AudioFile[] = [
        {
          name: 'Piano Sonata.mp3',
          path: '/audio/piano_sonata.mp3',
          size: '8.2 MB',
          type: 'audio/mpeg',
          lastModified: '2024-06-10'
        },
        {
          name: 'Jazz Ensemble.wav',
          path: '/audio/jazz_ensemble.wav',
          size: '24.6 MB',
          type: 'audio/wav',
          lastModified: '2024-06-12'
        },
        {
          name: 'Podcast Interview.mp3',
          path: '/audio/podcast_interview.mp3',
          size: '18.7 MB',
          type: 'audio/mpeg',
          lastModified: '2024-06-15'
        },
        {
          name: 'Classical Symphony.mp3',
          path: '/audio/classical_symphony.mp3',
          size: '32.1 MB',
          type: 'audio/mpeg',
          lastModified: '2024-06-02'
        }
      ];
      
      setAudioFiles(mockFiles);
      setIsLoading(false);
    }, 1500);
  }, []);

  // Initialize with demo audio
  useEffect(() => {
    // In a real implementation, we would not hardcode this URL
    setAudioSrc('https://audio-samples.github.io/samples/mp3/blizzard_biased/blizzard_01.mp3');
    loadFilesFromUNC('\\\\server\\music');
  }, [loadFilesFromUNC]);

  // Create audio element when source changes
  useEffect(() => {
    if (!audioSrc) return;
    
    if (!audioRef.current) {
      audioRef.current = new Audio(audioSrc);
    } else {
      audioRef.current.src = audioSrc;
    }
    
    const audio = audioRef.current;
    
    const setAudioData = () => {
      setDuration(audio.duration);
    };
    
    const setAudioTime = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
    
    // Audio events
    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', onEnded);
    
    // Set volume
    audio.volume = volume;
    
    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioSrc, volume]);

  // Animation frame for smoother time updates
  const animateTime = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      animationRef.current = requestAnimationFrame(animateTime);
    }
  };

  // Play/Pause functionality
  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (!isPlaying) {
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          animationRef.current = requestAnimationFrame(animateTime);
        })
        .catch(error => {
          console.error('Error playing audio:', error);
          toast.error('Failed to play audio. Please try again.');
        });
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
  };

  // Seek functionality
  const seek = (time: number) => {
    if (!audioRef.current) return;
    
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  // Set volume
  const changeVolume = (value: number) => {
    if (!audioRef.current) return;
    
    const newVolume = Math.max(0, Math.min(1, value));
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
  };

  // Add marker at current position
  const addMarker = (type: 'start' | 'end') => {
    // Remove existing marker of the same type
    const filteredMarkers = markers.filter(marker => marker.type !== type);
    
    const newMarker: AudioMarker = {
      id: `${type}-${Date.now()}`,
      position: currentTime,
      type
    };
    
    setMarkers([...filteredMarkers, newMarker]);
    
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} marker set at ${formatTime(currentTime)}`);
  };

  // Remove marker
  const removeMarker = (id: string) => {
    setMarkers(markers.filter(marker => marker.id !== id));
  };

  // Export trimmed audio
  const exportTrimmedAudio = async () => {
    if (!audioRef.current || !audioSrc) {
      toast.error('No audio loaded');
      return;
    }
    
    const startMarker = markers.find(marker => marker.type === 'start');
    const endMarker = markers.find(marker => marker.type === 'end');
    
    if (!startMarker && !endMarker) {
      toast.error('You need to set at least one marker');
      return;
    }
    
    const startTime = startMarker ? startMarker.position : 0;
    const endTime = endMarker ? endMarker.position : duration;
    
    if (startTime >= endTime) {
      toast.error('Start marker must be before end marker');
      return;
    }
    
    // In a real implementation, we would send this to a backend for processing
    // Here we'll just show a mock download process
    toast.success('Processing audio...', { duration: 2000 });
    
    // Simulate processing time
    setTimeout(() => {
      const fileName = audioSrc.split('/').pop() || 'trimmed_audio.mp3';
      const trimmedFileName = `trimmed_${fileName}`;
      
      // In a real app, this would be the URL to the processed file
      const mockDownloadUrl = audioSrc;
      
      toast.success(`Download ready: ${trimmedFileName}`, {
        description: `Trimmed from ${formatTime(startTime)} to ${formatTime(endTime)}`,
        action: {
          label: 'Download',
          onClick: () => window.open(mockDownloadUrl, '_blank')
        },
        duration: 5000
      });
    }, 3000);
  };

  // Load a selected audio file
  const loadAudioFile = (file: AudioFile) => {
    // In a real implementation, this would resolve the UNC path
    // For now, we'll just use our demo URL again but with a delay to simulate loading
    setIsLoading(true);
    
    setTimeout(() => {
      setAudioSrc('https://audio-samples.github.io/samples/mp3/blizzard_biased/blizzard_01.mp3');
      setMarkers([]);
      setIsPlaying(false);
      setCurrentTime(0);
      setIsLoading(false);
      
      toast.success(`Loaded: ${file.name}`);
    }, 1500);
  };

  // Format time in MM:SS format
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format time for display with milliseconds
  const formatTimeDetailed = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time % 1) * 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
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

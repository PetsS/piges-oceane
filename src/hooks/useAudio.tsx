import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';

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

  const loadFilesFromUNC = useCallback(async (path: string, date: Date, hour: string | null) => {
    setIsLoading(true);
    
    setTimeout(() => {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      if (hour) {
        const mockFile: AudioFile = {
          name: `${hour}.mp3`,
          path: `\\\\server\\audioLogs\\${dateStr}\\${hour}.mp3`,
          size: '58.2 MB',
          type: 'audio/mpeg',
          lastModified: format(date, 'yyyy-MM-dd')
        };
        
        setAudioFiles([mockFile]);
        
        loadAudioFile(mockFile);
      } else {
        const mockFiles: AudioFile[] = Array.from({ length: 24 }, (_, i) => {
          const hourStr = i.toString().padStart(2, '0');
          return {
            name: `${hourStr}.mp3`,
            path: `\\\\server\\audioLogs\\${dateStr}\\${hourStr}.mp3`,
            size: `${Math.floor(50 + Math.random() * 10)}.${Math.floor(Math.random() * 10)}MB`,
            type: 'audio/mpeg',
            lastModified: format(date, 'yyyy-MM-dd')
          };
        });
        
        setAudioFiles(mockFiles);
      }
      
      setIsLoading(false);
    }, 1500);
  }, []);

  useEffect(() => {
    const today = new Date();
    const currentHour = today.getHours().toString().padStart(2, '0');
    
    loadFilesFromUNC(`\\\\server\\audioLogs`, today, currentHour);
  }, [loadFilesFromUNC]);

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
    
    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', onEnded);
    
    audio.volume = volume;
    
    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioSrc, volume]);

  const animateTime = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      animationRef.current = requestAnimationFrame(animateTime);
    }
  };

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

  const seek = (time: number) => {
    if (!audioRef.current) return;
    
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const changeVolume = (value: number) => {
    if (!audioRef.current) return;
    
    const newVolume = Math.max(0, Math.min(1, value));
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
  };

  const addMarker = (type: 'start' | 'end') => {
    const filteredMarkers = markers.filter(marker => marker.type !== type);
    
    const newMarker: AudioMarker = {
      id: `${type}-${Date.now()}`,
      position: currentTime,
      type
    };
    
    setMarkers([...filteredMarkers, newMarker]);
    
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} marker set at ${formatTime(currentTime)}`);
  };

  const removeMarker = (id: string) => {
    setMarkers(markers.filter(marker => marker.id !== id));
  };

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
    
    toast.success('Processing audio segment...', { duration: 2000 });
    
    const pathParts = audioSrc.split('\\');
    const fileName = pathParts[pathParts.length - 1];
    const dateFolder = pathParts[pathParts.length - 2];
    
    const exportFileName = `${dateFolder}_${fileName.replace('.mp3', '')}_${formatTime(startTime).replace(':', '')}-${formatTime(endTime).replace(':', '')}.mp3`;
    
    setTimeout(() => {
      const mockDownloadUrl = audioSrc;
      
      toast.success(`Export ready: ${exportFileName}`, {
        description: `Trimmed from ${formatTime(startTime)} to ${formatTime(endTime)}`,
        action: {
          label: 'Download',
          onClick: () => window.open(mockDownloadUrl, '_blank')
        },
        duration: 5000
      });
    }, 3000);
  };

  const loadAudioFile = (file: AudioFile) => {
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

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

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


import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { AudioFile } from './useAudioTypes';

export const useAudioFiles = (
  setAudioSrc: (src: string | null) => void,
  setAudioBuffer: (buffer: AudioBuffer | null) => void,
  setIsPlaying: (isPlaying: boolean) => void,
  setCurrentTime: (time: number) => void,
  initializeMarkers: (duration: number) => void,
  getAudioContext: () => AudioContext | null,
  audioRef: React.RefObject<HTMLAudioElement>,
  audioSrc: string | null
) => {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAudioFile, setCurrentAudioFile] = useState<AudioFile | null>(null);

  const loadFilesFromUNC = useCallback(async (path: string, city: string, date: Date, hour: string | null) => {
    setIsLoading(true);
    
    setTimeout(() => {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      if (hour) {
        const mockFile: AudioFile = {
          name: `${hour}.mp3`,
          path: `${path}\\${hour}.mp3`,
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
            path: `${path}\\${hourStr}.mp3`,
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

  // Initialize with default files on component mount
  useEffect(() => {
    const today = new Date();
    const currentHour = today.getHours().toString().padStart(2, '0');
    const defaultCity = 'paris';
    
    const savedSettings = localStorage.getItem("appSettings");
    let audioFolderPath = `\\\\server\\audioLogs`;
    
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.audioFolderPath) {
          audioFolderPath = settings.audioFolderPath;
        }
      } catch (error) {
        console.error("Error parsing settings:", error);
      }
    }
    
    loadFilesFromUNC(`${audioFolderPath}\\${defaultCity}\\${format(today, 'yyyy-MM-dd')}`, defaultCity, today, currentHour);
  }, [loadFilesFromUNC]);

  const loadAudioFile = useCallback((file: AudioFile) => {
    setIsLoading(true);
    setCurrentAudioFile(file);
    
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioSrc && audioSrc.startsWith('blob:')) {
        URL.revokeObjectURL(audioSrc);
      }
    }
    
    setAudioBuffer(null);
    
    if (file.path.startsWith('blob:') || file.path.startsWith('http')) {
      console.log("Loading direct file:", file.name, file.path);
      setAudioSrc(file.path);
      setIsPlaying(false);
      setCurrentTime(0);
      setIsLoading(false);
    } else {
      console.log("Loading mock network file:", file.name);
      setTimeout(() => {
        try {
          console.log("Creating synthetic audio for network file");
          const ctx = getAudioContext();
          if (ctx) {
            setAudioSrc('synthetic-audio');
            setIsPlaying(false);
            setCurrentTime(0);
            setIsLoading(false);
            
            const duration = 3600;
            
            initializeMarkers(duration);
            
            const buffer = ctx.createBuffer(2, duration * ctx.sampleRate, ctx.sampleRate);
            for (let channel = 0; channel < 2; channel++) {
              const data = buffer.getChannelData(channel);
              for (let i = 0; i < data.length; i++) {
                data[i] = Math.sin(i * 0.01 * (1 + Math.sin(i * 0.0001) * 0.5)) * 0.5;
              }
            }
            setAudioBuffer(buffer);
            
            toast.info("Fichier audio réseau simulé chargé avec succès.");
            return;
          }
        } catch (error) {
          console.error("Error creating synthetic audio:", error);
        }
        
        toast.info("Remarque: L'accès aux fichiers réseau est simulé. Un fichier de test est disponible.");
      }, 1000);
    }
  }, [audioSrc, getAudioContext, setAudioSrc, setAudioBuffer, setIsPlaying, setCurrentTime, initializeMarkers, audioRef]);

  return {
    audioFiles,
    isLoading,
    currentAudioFile,
    loadAudioFile,
    loadFilesFromUNC
  };
};

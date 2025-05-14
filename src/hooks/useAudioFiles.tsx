
import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { AudioFile } from './useAudioTypes';
import { useSettings } from '@/contexts/SettingsContext';
import citiesConfig from "@/config/cities.json";

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
  const { settings } = useSettings();
  
  const loadAudioFileRef = useRef<(file: AudioFile) => void>();

  const loadAudioFile = useCallback((file: AudioFile): Promise<void> =>{
    return new Promise((resolve, reject) => {
      setIsLoading(true);
      setCurrentAudioFile(file);
      
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioSrc && audioSrc.startsWith('blob:')) {
          URL.revokeObjectURL(audioSrc);
        }
      }
      
      setAudioBuffer(null);
      
      if (file.path.startsWith('/') || file.path.startsWith('blob:') || file.path.startsWith('http')) {
        console.log("Loading large local file:", file.name, file.path);

        const normalizedPath = encodeURI(file.path.replace(/\\/g, '/'));
        console.log("Normalized path:", normalizedPath);
        
        if (audioRef.current) {
          const audio = audioRef.current;

          audio.removeAttribute('src');
          audio.load();
    
          audio.src = normalizedPath;
          audio.preload = "metadata";
    
          const onLoadedMetadata = () => {
            console.log("Audio metadata loaded:", file.name, "Duration:", audio.duration);
            setAudioSrc(normalizedPath);
            setIsPlaying(false);
            setCurrentTime(0);
            setIsLoading(false);
    
            if (audio.duration) {
              initializeMarkers(audio.duration);
            }
    
            toast.success(`Audio file loaded: ${file.name}`);
            resolve();
          };
    
          const onError = (e: any) => {
            console.error("Error loading audio file:", e);
            toast.error(`Couldn't load audio file: ${file.name}`);
            setIsLoading(false);
            reject(e);
          };
    
          audio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
          audio.addEventListener('error', onError, { once: true });
    
          audio.load();
        }
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
              
              const buffer = ctx.createBuffer(2, Math.min(duration * ctx.sampleRate, 10 * ctx.sampleRate), ctx.sampleRate);
              
              for (let channel = 0; channel < 2; channel++) {
                const data = buffer.getChannelData(channel);
                const sampleLength = Math.min(data.length, 10 * ctx.sampleRate);
                for (let i = 0; i < sampleLength; i++) {
                  data[i] = Math.sin(i * 0.01 * (1 + Math.sin(i * 0.0001) * 0.5)) * 0.5;
                }
              }
              
              setAudioBuffer(buffer);
              
              toast.info("Simulated network audio loaded.");
              resolve();
              return;
            }
          } catch (error) {
            console.error("Error creating synthetic audio:", error);
            reject(error);
          }
          
          toast.info("Remarque: L'accès aux fichiers réseau est simulé. Un fichier de test est disponible.");
        }, 1000);
      }
    });
  }, [audioSrc, getAudioContext, setAudioSrc, setAudioBuffer, setIsPlaying, setCurrentTime, initializeMarkers, audioRef]);

  useEffect(() => {
    loadAudioFileRef.current = loadAudioFile;
  }, [loadAudioFile]);
  
  const loadFilesFromUNC = useCallback(async (path: string, city: string, date: Date, hour: string | null) => {
    setIsLoading(true);
    
    setTimeout(() => {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      if (hour) {
        const mockFile: AudioFile = {
          name: `${hour}.mp3`,
          path: path,
          size: '140 MB',
          type: 'audio/mpeg',
          lastModified: format(date, 'yyyy-MM-dd')
        };
        
        setAudioFiles([mockFile]);
        
        if (loadAudioFileRef.current) {
          loadAudioFileRef.current(mockFile);
        }
      } else {
        const mockFiles: AudioFile[] = Array.from({ length: 24 }, (_, i) => {
          const hourStr = i.toString().padStart(2, '0');
          const basePath = path.includes('\\\\') 
            ? path.substring(0, path.lastIndexOf('\\')) 
            : path.substring(0, path.lastIndexOf('/'));
          
          return {
            name: `${hourStr}.mp3`,
            path: `${basePath}\\${hourStr}.mp3`,
            size: '140 MB',
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
    if (!settings) return;
    
    const today = new Date();
    
    // Load the previous hour's file by default
    let prevHour = today.getHours() - 1;
    if (prevHour < 0) {
      prevHour = 23;
      today.setDate(today.getDate() - 1);
    }
    
    const prevHourString = prevHour.toString().padStart(2, '0');
    
    // Use the first city from settings or config
    const defaultCity = settings.cities && settings.cities.length > 0 
      ? settings.cities[0].folderName 
      : citiesConfig[0].folderName;
    
    const audioFolderPath = settings.audioFolderPath || '\\\\server\\audioLogs';
    
    // Default type (departs)
    // const defaultType = 'departs';
    const defaultType = 'Départs';
    
    loadFilesFromUNC(
      `${audioFolderPath}\\${defaultType}\\${defaultCity}\\${format(today, 'yyyy-MM-dd')}\\${prevHourString}.mp3`, 
      defaultCity, 
      today, 
      prevHourString
    );
  }, [settings, loadFilesFromUNC]);

  return {
    audioFiles,
    isLoading,
    currentAudioFile,
    loadAudioFile,
    loadFilesFromUNC
  };
};

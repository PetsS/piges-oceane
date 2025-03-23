import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { ExportFormat } from '@/pages/Admin';
import lamejs from 'lamejs';

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
  const [currentAudioFile, setCurrentAudioFile] = useState<AudioFile | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("wav");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);

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
        if (settings.exportFormat) {
          setExportFormat(settings.exportFormat);
        }
      } catch (error) {
        console.error("Error parsing settings:", error);
      }
    }
    
    loadFilesFromUNC(`${audioFolderPath}\\${defaultCity}\\${format(today, 'yyyy-MM-dd')}`, defaultCity, today, currentHour);
  }, [loadFilesFromUNC]);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  const fetchAndDecodeAudio = async (url: string): Promise<AudioBuffer | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = getAudioContext();
      return await audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error('Error decoding audio data:', error);
      return null;
    }
  };

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
      
      const startMarkerId = `start-${Date.now()}`;
      const endMarkerId = `end-${Date.now() + 1}`;
      
      setMarkers([
        { id: startMarkerId, position: 0, type: 'start' },
        { id: endMarkerId, position: audio.duration, type: 'end' }
      ]);
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
    
    const onError = (e) => {
      console.error('Error loading audio:', e);
      toast.error('Impossible de charger le fichier audio. Format non supporté ou fichier inaccessible.');
    };
    
    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    
    audio.volume = volume;
    
    const loadBuffer = async () => {
      try {
        if (!audioSrc) {
          setAudioBuffer(null);
          return;
        }
        
        const buffer = await fetchAndDecodeAudio(audioSrc);
        setAudioBuffer(buffer);
        
        if (!buffer) {
          toast.error('Impossible de décoder le fichier audio. Essayez un autre format.');
        }
      } catch (error) {
        console.error('Error loading audio buffer:', error);
        setAudioBuffer(null);
        toast.error('Erreur lors du chargement du fichier audio');
      }
    };
    
    loadBuffer();
    
    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
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
    
    toast.success(`Marqueur ${type === 'start' ? 'début' : 'fin'} défini à ${formatTime(currentTime)}`);
  };

  const removeMarker = (id: string) => {
    setMarkers(markers.filter(marker => marker.id !== id));
  };

  const exportTrimmedAudio = async () => {
    if (!audioBuffer || !currentAudioFile) {
      toast.error('Aucun audio chargé ou fichier non compatible avec l\'export');
      return;
    }
    
    const startMarker = markers.find(marker => marker.type === 'start');
    const endMarker = markers.find(marker => marker.type === 'end');
    
    if (!startMarker && !endMarker) {
      toast.error('Vous devez définir au moins un marqueur');
      return;
    }
    
    const startTime = startMarker ? startMarker.position : 0;
    const endTime = endMarker ? endMarker.position : duration;
    
    if (startTime >= endTime) {
      toast.error('Le marqueur de début doit être avant celui de fin');
      return;
    }
    
    toast.success('Traitement du segment audio...', { duration: 2000 });
    
    try {
      const audioContext = getAudioContext();
      
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(startTime * sampleRate);
      const endSample = Math.min(Math.floor(endTime * sampleRate), audioBuffer.length);
      const frameCount = endSample - startSample;
      
      if (frameCount <= 0) {
        toast.error('Sélection audio invalide');
        return;
      }
      
      const trimmedBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        frameCount,
        sampleRate
      );
      
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const channelData = new Float32Array(frameCount);
        audioBuffer.copyFromChannel(channelData, channel, startSample);
        trimmedBuffer.copyToChannel(channelData, channel);
      }
      
      const savedSettings = localStorage.getItem("appSettings");
      let currentExportFormat = exportFormat;
      
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings);
          if (settings.exportFormat) {
            currentExportFormat = settings.exportFormat;
          }
        } catch (error) {
          console.error("Error parsing settings:", error);
        }
      }
      
      let trimmedAudioBlob: Blob;
      let fileExtension: string;
      
      if (currentExportFormat === "wav") {
        trimmedAudioBlob = await bufferToWav(trimmedBuffer);
        fileExtension = "wav";
      } else {
        const bitrate = parseInt(currentExportFormat.split('-')[1]);
        trimmedAudioBlob = await bufferToMp3(trimmedBuffer, bitrate);
        fileExtension = "mp3";
      }
      
      const originalName = currentAudioFile.name.replace(/\.[^/.]+$/, "");
      const exportFileName = `${originalName}_${formatTime(startTime).replace(':', '')}-${formatTime(endTime).replace(':', '')}.${fileExtension}`;
      
      const downloadUrl = URL.createObjectURL(trimmedAudioBlob);
      
      toast.success(`Export prêt: ${exportFileName}`, {
        description: `Découpé de ${formatTime(startTime)} à ${formatTime(endTime)} (${currentExportFormat})`,
        action: {
          label: 'Télécharger',
          onClick: () => {
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = exportFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
          }
        },
        duration: 5000
      });
    } catch (error) {
      console.error('Error exporting audio:', error);
      toast.error('Erreur lors de l\'export du fichier audio');
    }
  };

  const bufferToWav = (buffer: AudioBuffer): Promise<Blob> => {
    return new Promise((resolve) => {
      const numOfChannels = buffer.numberOfChannels;
      const length = buffer.length * numOfChannels * 2;
      const sampleRate = buffer.sampleRate;
      
      const wavBuffer = new ArrayBuffer(44 + length);
      const view = new DataView(wavBuffer);
      
      writeString(view, 0, 'RIFF');
      view.setUint32(4, 36 + length, true);
      writeString(view, 8, 'WAVE');
      writeString(view, 12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numOfChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * numOfChannels * 2, true);
      view.setUint16(32, numOfChannels * 2, true);
      view.setUint16(34, 16, true);
      writeString(view, 36, 'data');
      view.setUint32(40, length, true);
      
      const offset = 44;
      let pos = offset;
      
      for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numOfChannels; channel++) {
          const sample = buffer.getChannelData(channel)[i];
          const int = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
          view.setInt16(pos, int, true);
          pos += 2;
        }
      }
      
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      resolve(blob);
    });
  };

  const bufferToMp3 = (buffer: AudioBuffer, bitrate = 128): Promise<Blob> => {
    return new Promise((resolve) => {
      const sampleRate = buffer.sampleRate;
      const numChannels = buffer.numberOfChannels;
      
      const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);
      const mp3Data: Int8Array[] = [];
      
      const channelData: Float32Array[] = [];
      for (let i = 0; i < numChannels; i++) {
        channelData.push(buffer.getChannelData(i));
      }
      
      const sampleBlockSize = 1152;
      const totalSamples = buffer.length;
      
      for (let i = 0; i < totalSamples; i += sampleBlockSize) {
        const leftChunk = new Int16Array(sampleBlockSize);
        const rightChunk = numChannels > 1 ? new Int16Array(sampleBlockSize) : undefined;
        
        for (let j = 0; j < sampleBlockSize; j++) {
          if (i + j < totalSamples) {
            leftChunk[j] = channelData[0][i + j] * 0x7FFF;
            if (rightChunk && numChannels > 1) {
              rightChunk[j] = channelData[1][i + j] * 0x7FFF;
            }
          } else {
            leftChunk[j] = 0;
            if (rightChunk) {
              rightChunk[j] = 0;
            }
          }
        }
        
        let mp3buf;
        if (numChannels === 1) {
          mp3buf = mp3encoder.encodeBuffer(leftChunk);
        } else {
          mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
        }
        
        if (mp3buf && mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
      }
      
      const finalMp3buf = mp3encoder.flush();
      if (finalMp3buf && finalMp3buf.length > 0) {
        mp3Data.push(finalMp3buf);
      }
      
      let totalLength = 0;
      for (const data of mp3Data) {
        totalLength += data.length;
      }
      
      const mergedBuffer = new Int8Array(totalLength);
      let offset = 0;
      for (const data of mp3Data) {
        mergedBuffer.set(data, offset);
        offset += data.length;
      }
      
      const blob = new Blob([mergedBuffer], { type: 'audio/mp3' });
      resolve(blob);
    });
  };

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const loadAudioFile = (file: AudioFile) => {
    setIsLoading(true);
    setCurrentAudioFile(file);
    
    if (file.path.startsWith('blob:') || file.path.startsWith('http')) {
      setAudioSrc(file.path);
      setIsPlaying(false);
      setCurrentTime(0);
      setIsLoading(false);
    } else {
      setTimeout(() => {
        setAudioSrc('https://audio-samples.github.io/samples/mp3/blizzard_biased/blizzard_01.mp3');
        setIsPlaying(false);
        setCurrentTime(0);
        setIsLoading(false);
        
        toast.info("Remarque: L'accès aux fichiers réseau est simulé. Un fichier de test est chargé à la place.");
      }, 1500);
    }
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
    currentAudioFile,
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


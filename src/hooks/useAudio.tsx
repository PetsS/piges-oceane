import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const processingRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, []);

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
      } catch (error) {
        console.error("Error parsing settings:", error);
      }
    }
    
    loadFilesFromUNC(`${audioFolderPath}\\${defaultCity}\\${format(today, 'yyyy-MM-dd')}`, defaultCity, today, currentHour);
  }, [loadFilesFromUNC]);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const fetchAndDecodeAudio = useCallback(async (url: string): Promise<AudioBuffer | null> => {
    try {
      console.log("Fetching audio from URL:", url);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = getAudioContext();
      
      if (arrayBuffer.byteLength > 50 * 1024 * 1024) {
        toast.info('Large audio file detected. Processing may take longer.');
      }
      
      console.log("Successfully fetched audio, decoding...");
      return await audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error('Error decoding audio data:', error);
      return null;
    }
  }, [getAudioContext]);

  useEffect(() => {
    if (!audioSrc) return;
    
    if (audioRef.current && audioRef.current.src !== audioSrc) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    audioRef.current.src = audioSrc;
    audioRef.current.volume = volume;
    
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
    
    const loadBuffer = async () => {
      setAudioBuffer(null);
      
      if (!audioSrc) return;
      
      try {
        const buffer = await fetchAndDecodeAudio(audioSrc);
        
        if (!buffer) {
          toast.error('Impossible de décoder le fichier audio. Essayez un autre format.');
          return;
        }
        
        setAudioBuffer(buffer);
      } catch (error) {
        console.error('Error loading audio buffer:', error);
        toast.error('Erreur lors du chargement du fichier audio');
      }
    };
    
    const bufferTimeout = setTimeout(loadBuffer, 1000);
    
    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      clearTimeout(bufferTimeout);
    };
  }, [audioSrc, volume, fetchAndDecodeAudio]);

  const animateTime = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      animationRef.current = requestAnimationFrame(animateTime);
    }
  }, []);

  const togglePlay = useCallback(() => {
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
  }, [isPlaying, animateTime]);

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const changeVolume = useCallback((value: number) => {
    if (!audioRef.current) return;
    
    const newVolume = Math.max(0, Math.min(1, value));
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
  }, []);

  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const formatTimeDetailed = useCallback((time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time % 1) * 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }, []);

  const addMarker = useCallback((type: 'start' | 'end') => {
    const filteredMarkers = markers.filter(marker => marker.type !== type);
    
    const newMarker: AudioMarker = {
      id: `${type}-${Date.now()}`,
      position: currentTime,
      type
    };
    
    setMarkers([...filteredMarkers, newMarker]);
    
    toast.success(`Marqueur ${type === 'start' ? 'début' : 'fin'} défini à ${formatTime(currentTime)}`);
  }, [markers, currentTime, formatTime]);

  const removeMarker = useCallback((id: string) => {
    setMarkers(markers.filter(marker => marker.id !== id));
  }, [markers]);

  const bufferToMp3 = useCallback((buffer: AudioBuffer, bitrate = 192): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      try {
        console.log("Starting MP3 encoding process...");
        const sampleRate = buffer.sampleRate;
        const numChannels = Math.min(buffer.numberOfChannels, 2);
        
        const mp3encoder = new lamejs.Mp3Encoder(
          numChannels,
          sampleRate,
          bitrate
        );
        
        const mp3Data: Int8Array[] = [];
        
        const channelData: Float32Array[] = [];
        for (let i = 0; i < numChannels; i++) {
          channelData.push(buffer.getChannelData(i));
        }
        
        const sampleBlockSize = 1152;
        const totalSamples = buffer.length;
        
        const processChunkSize = 50000;
        
        const processChunk = async (startIndex: number) => {
          const endIndex = Math.min(startIndex + processChunkSize, totalSamples);
          
          for (let i = startIndex; i < endIndex; i += sampleBlockSize) {
            const leftChunk = new Int16Array(sampleBlockSize);
            const rightChunk = numChannels > 1 ? new Int16Array(sampleBlockSize) : undefined;
            
            for (let j = 0; j < sampleBlockSize; j++) {
              if (i + j < totalSamples) {
                leftChunk[j] = Math.max(-32768, Math.min(32767, channelData[0][i + j] * 32767));
                if (rightChunk && numChannels > 1) {
                  rightChunk[j] = Math.max(-32768, Math.min(32767, channelData[1][i + j] * 32767));
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
          
          if (endIndex < totalSamples) {
            await new Promise(r => setTimeout(r, 0));
            return processChunk(endIndex);
          }
          
          const finalMp3buf = mp3encoder.flush();
          if (finalMp3buf && finalMp3buf.length > 0) {
            mp3Data.push(finalMp3buf);
          }
          
          const blob = new Blob(mp3Data, { type: 'audio/mp3' });
          console.log("MP3 encoding completed successfully!");
          resolve(blob);
        };
        
        processChunk(0).catch(reject);
      } catch (error) {
        console.error("Error in MP3 encoding:", error);
        console.log("MP3 encoding failed, falling back to WAV export");
        bufferToWav(buffer)
          .then(resolve)
          .catch(reject);
      }
    });
  }, []);

  const bufferToWav = useCallback((buffer: AudioBuffer): Promise<Blob> => {
    return new Promise((resolve) => {
      const numOfChannels = Math.min(buffer.numberOfChannels, 2);
      const length = buffer.length * numOfChannels * 2;
      const sampleRate = buffer.sampleRate;
      
      const wavBuffer = new ArrayBuffer(44 + length);
      const view = new DataView(wavBuffer);
      
      const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };
      
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
      
      const chunkSize = 10000;
      
      for (let i = 0; i < buffer.length; i += chunkSize) {
        const blockSize = Math.min(chunkSize, buffer.length - i);
        
        for (let j = 0; j < blockSize; j++) {
          for (let channel = 0; channel < numOfChannels; channel++) {
            const sample = buffer.getChannelData(channel)[i + j];
            const int = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
            view.setInt16(pos, int, true);
            pos += 2;
          }
        }
      }
      
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      resolve(blob);
    });
  }, []);

  const exportTrimmedAudio = useCallback(async () => {
    if (processingRef.current) {
      toast.info('Traitement en cours, veuillez patienter...');
      return;
    }
    
    processingRef.current = true;
    
    try {
      if (!audioBuffer) {
        console.log("No audio buffer available, creating from audio element...");
        
        if (!audioRef.current || !audioRef.current.src) {
          toast.error('Aucun audio chargé');
          processingRef.current = false;
          return;
        }
        
        toast.info('Préparation de l\'audio pour l\'export...');
        
        try {
          const url = audioRef.current.src;
          console.log("Fetching audio buffer from URL:", url);
          const buffer = await fetchAndDecodeAudio(url);
          
          if (!buffer) {
            toast.error('Impossible de préparer l\'audio pour l\'export');
            processingRef.current = false;
            return;
          }
          
          setAudioBuffer(buffer);
          console.log("Successfully created audio buffer from element, proceeding with export");
        } catch (error) {
          console.error("Error creating buffer from audio element:", error);
          toast.error('Erreur lors de la préparation de l\'audio');
          processingRef.current = false;
          return;
        }
      }
      
      if (!audioBuffer) {
        toast.error('Impossible de préparer l\'audio pour l\'export');
        processingRef.current = false;
        return;
      }
      
      const startMarker = markers.find(marker => marker.type === 'start');
      const endMarker = markers.find(marker => marker.type === 'end');
      
      if (!startMarker && !endMarker) {
        toast.error('Vous devez définir au moins un marqueur');
        processingRef.current = false;
        return;
      }
      
      const startTime = startMarker ? startMarker.position : 0;
      const endTime = endMarker ? endMarker.position : duration;
      
      if (startTime >= endTime) {
        toast.error('Le marqueur de début doit être avant celui de fin');
        processingRef.current = false;
        return;
      }
      
      toast.success('Traitement du segment audio...', { duration: 2000 });
      
      const audioContext = getAudioContext();
      
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(startTime * sampleRate);
      const endSample = Math.min(Math.floor(endTime * sampleRate), audioBuffer.length);
      const frameCount = endSample - startSample;
      
      if (frameCount <= 0) {
        toast.error('Sélection audio invalide');
        processingRef.current = false;
        return;
      }
      
      console.log(`Creating trimmed buffer with parameters:
        - Channels: ${Math.min(2, audioBuffer.numberOfChannels)}
        - Frame count: ${frameCount}
        - Sample rate: ${sampleRate}
        - Start sample: ${startSample}
        - End sample: ${endSample}
      `);
      
      const trimmedBuffer = audioContext.createBuffer(
        Math.min(2, audioBuffer.numberOfChannels),
        frameCount,
        sampleRate
      );
      
      for (let channel = 0; channel < Math.min(2, audioBuffer.numberOfChannels); channel++) {
        console.log(`Processing channel ${channel}`);
        const channelData = new Float32Array(frameCount);
        audioBuffer.copyFromChannel(channelData, channel, startSample);
        trimmedBuffer.copyToChannel(channelData, channel);
      }
      
      console.log("Trimmed buffer created successfully, proceeding to MP3 encoding");
      
      const fileExtension = "mp3";
      const bitrate = 192;
      
      console.log(`Starting encoding to ${fileExtension} with bitrate ${bitrate}kbps`);
      const trimmedAudioBlob = await bufferToMp3(trimmedBuffer, bitrate);
      console.log(`Successfully encoded to ${fileExtension}, blob size: ${trimmedAudioBlob.size} bytes`);
      
      const fileName = currentAudioFile ? 
                      currentAudioFile.name.replace(/\.[^/.]+$/, "") : 
                      "audio";
      const exportFileName = `${fileName}_${formatTime(startTime).replace(':', '')}-${formatTime(endTime).replace(':', '')}.${fileExtension}`;
      
      const downloadUrl = URL.createObjectURL(trimmedAudioBlob);
      
      toast.success(`Export prêt: ${exportFileName}`, {
        description: `Découpé de ${formatTime(startTime)} à ${formatTime(endTime)} (MP3 ${bitrate}kbps)`,
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
      
      console.log(`Export completed successfully: ${exportFileName}`);
    } catch (error) {
      console.error('Error exporting audio:', error);
      toast.error('Erreur lors de l\'export du fichier audio');
    } finally {
      processingRef.current = false;
    }
  }, [audioBuffer, markers, duration, formatTime, getAudioContext, currentAudioFile, fetchAndDecodeAudio, bufferToMp3]);

  const loadAudioFile = useCallback((file: AudioFile) => {
    setIsLoading(true);
    setCurrentAudioFile(file);
    
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioSrc) {
        URL.revokeObjectURL(audioSrc);
      }
    }
    
    setAudioBuffer(null);
    
    if (file.path.startsWith('blob:') || file.path.startsWith('http')) {
      setAudioSrc(file.path);
      setIsPlaying(false);
      setCurrentTime(0);
      setIsLoading(false);
    } else {
      setTimeout(() => {
        setAudioSrc('https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3');
        setIsPlaying(false);
        setCurrentTime(0);
        setIsLoading(false);
        
        toast.info("Remarque: L'accès aux fichiers réseau est simulé. Un fichier de test est chargé à la place.");
      }, 1000);
    }
  }, [audioSrc]);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
      }
      
      if (audioSrc && audioSrc.startsWith('blob:')) {
        URL.revokeObjectURL(audioSrc);
      }
    };
  }, [audioSrc]);

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

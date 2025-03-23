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
  const processingRef = useRef<boolean>(false);

  // Clean up audio context when component unmounts
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
        if (settings.exportFormat) {
          setExportFormat(settings.exportFormat);
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

  // More efficient audio decoding with proper error handling
  const fetchAndDecodeAudio = useCallback(async (url: string): Promise<AudioBuffer | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = getAudioContext();
      
      // Handle very large files more efficiently
      if (arrayBuffer.byteLength > 50 * 1024 * 1024) { // 50MB
        toast.info('Large audio file detected. Processing may take longer.');
      }
      
      return await audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error('Error decoding audio data:', error);
      return null;
    }
  }, [getAudioContext]);

  useEffect(() => {
    if (!audioSrc) return;
    
    // Clean up any previous audio elements
    if (audioRef.current && audioRef.current.src !== audioSrc) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    
    // Create a new audio element or reset the existing one
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
    
    // Only load the buffer when needed for export
    const loadBuffer = async () => {
      // Clear previous buffer to free memory
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
    
    // Only load full buffer when needed (delayed)
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

  const addMarker = useCallback((type: 'start' | 'end') => {
    const filteredMarkers = markers.filter(marker => marker.type !== type);
    
    const newMarker: AudioMarker = {
      id: `${type}-${Date.now()}`,
      position: currentTime,
      type
    };
    
    setMarkers([...filteredMarkers, newMarker]);
    
    toast.success(`Marqueur ${type === 'start' ? 'début' : 'fin'} défini à ${formatTime(currentTime)}`);
  }, [markers, currentTime]);

  const removeMarker = useCallback((id: string) => {
    setMarkers(markers.filter(marker => marker.id !== id));
  }, [markers]);

  // Memory-optimized MP3 encoding function
  const bufferToMp3 = useCallback((buffer: AudioBuffer, bitrate = 128): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      try {
        const sampleRate = buffer.sampleRate;
        const numChannels = Math.min(buffer.numberOfChannels, 2); // Limit to stereo
        
        // Initialize LAME encoder with proper settings
        const mp3encoder = new lamejs.Mp3Encoder(
          numChannels,  // number of channels (1 for mono, 2 for stereo)
          sampleRate,   // sample rate (e.g., 44100)
          bitrate       // bitrate (e.g., 128, 192, 256, 320)
        );
        
        const mp3Data: Int8Array[] = [];
        
        // Get channel data
        const channelData: Float32Array[] = [];
        for (let i = 0; i < numChannels; i++) {
          channelData.push(buffer.getChannelData(i));
        }
        
        const sampleBlockSize = 1152; // LAME recommends 1152 samples per frame
        const totalSamples = buffer.length;
        
        // Process in larger chunks to improve performance
        const processChunkSize = 50000; // ~1 second of audio at 44.1kHz
        
        const processChunk = async (startIndex: number) => {
          const endIndex = Math.min(startIndex + processChunkSize, totalSamples);
          
          for (let i = startIndex; i < endIndex; i += sampleBlockSize) {
            const leftChunk = new Int16Array(sampleBlockSize);
            const rightChunk = numChannels > 1 ? new Int16Array(sampleBlockSize) : undefined;
            
            // Fill with audio data or silence if past the end of file
            for (let j = 0; j < sampleBlockSize; j++) {
              if (i + j < totalSamples) {
                // Scale Float32 [-1,1] to Int16 [-32768,32767]
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
          
          // Allow the browser to perform garbage collection
          if (endIndex < totalSamples) {
            await new Promise(r => setTimeout(r, 0));
            return processChunk(endIndex);
          }
          
          // Finalize the MP3
          const finalMp3buf = mp3encoder.flush();
          if (finalMp3buf && finalMp3buf.length > 0) {
            mp3Data.push(finalMp3buf);
          }
          
          // Create the blob
          const blob = new Blob(mp3Data, { type: 'audio/mp3' });
          resolve(blob);
        };
        
        // Start processing
        processChunk(0).catch(reject);
        
      } catch (error) {
        console.error("Error in MP3 encoding:", error);
        reject(error);
      }
    });
  }, []);

  // Memory-efficient export function
  const exportTrimmedAudio = useCallback(async () => {
    // Prevent multiple export operations
    if (processingRef.current) {
      toast.info('Traitement en cours, veuillez patienter...');
      return;
    }
    
    if (!audioBuffer || !currentAudioFile) {
      // Only now load the buffer if needed for export
      if (audioSrc && !audioBuffer) {
        toast.info('Chargement du fichier audio pour export...');
        try {
          const buffer = await fetchAndDecodeAudio(audioSrc);
          if (buffer) {
            setAudioBuffer(buffer);
            // Continue with export after buffer is loaded
            setTimeout(() => exportTrimmedAudio(), 500);
          } else {
            toast.error('Impossible de charger l\'audio pour l\'export');
          }
        } catch (error) {
          console.error('Error loading buffer for export:', error);
          toast.error('Erreur lors du chargement pour l\'export');
        }
        return;
      }
      
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
    processingRef.current = true;
    
    try {
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
      
      // More efficient memory usage by processing in smaller chunks for large files
      const isLargeFile = frameCount > 5000000; // ~2 minutes of stereo audio at 44.1kHz
      
      let trimmedBuffer;
      if (isLargeFile) {
        // For large files, use a more memory-efficient approach
        toast.info('Fichier volumineux détecté. Traitement optimisé en cours...');
        
        // Create buffer with reduced channel count if possible
        const effectiveChannels = Math.min(2, audioBuffer.numberOfChannels);
        trimmedBuffer = audioContext.createBuffer(
          effectiveChannels,
          frameCount,
          sampleRate
        );
        
        // Process one channel at a time to reduce peak memory usage
        for (let channel = 0; channel < effectiveChannels; channel++) {
          const newChannelData = new Float32Array(frameCount);
          // Copy in smaller chunks to reduce memory spikes
          const chunkSize = 100000;
          for (let i = 0; i < frameCount; i += chunkSize) {
            const blockSize = Math.min(chunkSize, frameCount - i);
            const tempChunk = new Float32Array(blockSize);
            audioBuffer.copyFromChannel(tempChunk, channel, startSample + i);
            newChannelData.set(tempChunk, i);
            // Allow browser to garbage collect
            await new Promise(r => setTimeout(r, 0));
          }
          trimmedBuffer.copyToChannel(newChannelData, channel);
        }
      } else {
        // Standard approach for smaller files
        trimmedBuffer = audioContext.createBuffer(
          audioBuffer.numberOfChannels,
          frameCount,
          sampleRate
        );
        
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
          const channelData = new Float32Array(frameCount);
          audioBuffer.copyFromChannel(channelData, channel, startSample);
          trimmedBuffer.copyToChannel(channelData, channel);
        }
      }
      
      // Get the export format - default to MP3 128kbps
      const savedSettings = localStorage.getItem("appSettings");
      let currentExportFormat: ExportFormat = "mp3-128";
      
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
      
      setExportFormat(currentExportFormat);
      
      let trimmedAudioBlob: Blob;
      let fileExtension: string;
      
      // Default to MP3 export with fallback to WAV
      try {
        if (currentExportFormat === "wav") {
          trimmedAudioBlob = await bufferToWav(trimmedBuffer);
          fileExtension = "wav";
        } else {
          const bitrate = parseInt(currentExportFormat.split('-')[1]);
          trimmedAudioBlob = await bufferToMp3(trimmedBuffer, bitrate);
          fileExtension = "mp3";
        }
      } catch (error) {
        console.error("Error in audio encoding:", error);
        toast.error("Erreur lors de l'encodage. Export en WAV à la place.");
        trimmedAudioBlob = await bufferToWav(trimmedBuffer);
        fileExtension = "wav";
        currentExportFormat = "wav";
      }
      
      const originalName = currentAudioFile.name.replace(/\.[^/.]+$/, "");
      const exportFileName = `${originalName}_${formatTime(startTime).replace(':', '')}-${formatTime(endTime).replace(':', '')}.${fileExtension}`;
      
      const downloadUrl = URL.createObjectURL(trimmedAudioBlob);
      
      toast.success(`Export prêt: ${exportFileName}`, {
        description: `Découpé de ${formatTime(startTime)} à ${formatTime(endTime)} (${fileExtension === "mp3" ? currentExportFormat : "wav"})`,
        action: {
          label: 'Télécharger',
          onClick: () => {
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = exportFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            // Release object URL immediately after download starts
            setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
          }
        },
        duration: 5000
      });
    } catch (error) {
      console.error('Error exporting audio:', error);
      toast.error('Erreur lors de l\'export du fichier audio');
    } finally {
      processingRef.current = false;
    }
  }, [audioBuffer, audioSrc, currentAudioFile, duration, bufferToWav, fetchAndDecodeAudio, formatTime, getAudioContext, markers]);

  // The bufferToWav function (more memory efficient)
  const bufferToWav = useCallback((buffer: AudioBuffer): Promise<Blob> => {
    return new Promise((resolve) => {
      const numOfChannels = Math.min(buffer.numberOfChannels, 2); // Limit to stereo to save memory
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
      
      // Process in smaller chunks to reduce memory pressure
      const chunkSize = 10000; // Number of samples to process at once
      
      for (let i = 0; i < buffer.length; i += chunkSize) {
        const blockSize = Math.min(chunkSize, buffer.length - i);
        
        // For each chunk, process all channels
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

  const loadAudioFile = useCallback((file: AudioFile) => {
    setIsLoading(true);
    setCurrentAudioFile(file);
    
    // Clean up previous resources
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioSrc) {
        URL.revokeObjectURL(audioSrc);
      }
    }
    
    // Clear audio buffer to free memory
    setAudioBuffer(null);
    
    if (file.path.startsWith('blob:') || file.path.startsWith('http')) {
      setAudioSrc(file.path);
      setIsPlaying(false);
      setCurrentTime(0);
      setIsLoading(false);
    } else {
      setTimeout(() => {
        // Use a more reliable audio sample
        setAudioSrc('https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3');
        setIsPlaying(false);
        setCurrentTime(0);
        setIsLoading(false);
        
        toast.info("Remarque: L'accès aux fichiers réseau est simulé. Un fichier de test est chargé à la place.");
      }, 1000);
    }
  }, [audioSrc]);

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

  // Clean up resources when component unmounts
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
      
      // Release any object URLs
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
    exportFormat,
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

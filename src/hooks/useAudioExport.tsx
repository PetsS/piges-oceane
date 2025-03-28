
import { useRef, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { AudioMarker } from './useAudioTypes';
import { useAudioContext } from './useAudioContext';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

export const useAudioExport = (
  audioBuffer: AudioBuffer | null,
  markers: AudioMarker[],
  duration: number,
  formatTime: (time: number) => string,
  audioRef: React.RefObject<HTMLAudioElement>,
  currentAudioFile: { name: string } | null
) => {
  const processingRef = useRef<boolean>(false);
  const { getAudioContext } = useAudioContext();
  const [ffmpegLoaded, setFfmpegLoaded] = useState<boolean>(false);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  // Helper function to convert AudioBuffer to WAV for processing
  const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
    const numOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numOfChannels * bytesPerSample;
    
    // Create buffer with space for the header
    const numSamples = buffer.length;
    const dataSize = numSamples * numOfChannels * bytesPerSample;
    const bufferSize = 44 + dataSize;
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);
    
    // Write WAV container header
    writeString(view, 0, 'RIFF'); // RIFF identifier
    view.setUint32(4, 36 + dataSize, true); // file length minus RIFF identifier length and file description length
    writeString(view, 8, 'WAVE'); // WAVE identifier
    writeString(view, 12, 'fmt '); // format chunk identifier
    view.setUint32(16, 16, true); // format chunk length
    view.setUint16(20, format, true); // sample format (1 is PCM)
    view.setUint16(22, numOfChannels, true); // channel count
    view.setUint32(24, sampleRate, true); // sample rate
    view.setUint32(28, sampleRate * blockAlign, true); // byte rate (sample rate * block align)
    view.setUint16(32, blockAlign, true); // block align (channel count * bytes per sample)
    view.setUint16(34, bitDepth, true); // bits per sample
    writeString(view, 36, 'data'); // data chunk identifier
    view.setUint32(40, dataSize, true); // data chunk length
    
    // Write the PCM samples
    const channelData = [];
    for (let i = 0; i < numOfChannels; i++) {
      channelData.push(buffer.getChannelData(i));
    }
    
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      for (let channel = 0; channel < numOfChannels; channel++) {
        // Convert float32 to int16
        const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
        const int16Sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, int16Sample, true);
        offset += bytesPerSample;
      }
    }
    
    return arrayBuffer;
  };
  
  // Helper to write string to DataView
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // Initialize FFmpeg
  const loadFFmpeg = async () => {
    if (ffmpegRef.current || ffmpegLoaded) return;
    
    try {
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;
      
      // Load FFmpeg with CDN build (for browser support)
      await ffmpeg.load({
        coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/ffmpeg-core.js',
        wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/ffmpeg-core.wasm',
      });
      
      setFfmpegLoaded(true);
      console.log('FFmpeg loaded successfully');
    } catch (error) {
      console.error('Error loading FFmpeg:', error);
      toast.error('Error initializing audio converter');
    }
  };

  const exportTrimmedAudio = useCallback(async () => {
    if (processingRef.current) {
      toast.info('Traitement en cours, veuillez patienter...');
      return;
    }
    
    processingRef.current = true;
    
    try {
      toast.info('Préparation de l\'audio pour l\'export...');
      
      // Load FFmpeg if not already loaded
      if (!ffmpegRef.current || !ffmpegLoaded) {
        await loadFFmpeg();
      }
      
      let bufferToExport = audioBuffer;
      
      if (!bufferToExport) {
        console.log("No audio buffer available, creating from audio element...");
        
        if (!audioRef.current || !audioRef.current.src) {
          toast.error('Aucun audio chargé');
          processingRef.current = false;
          return;
        }
        
        const url = audioRef.current.src;
        console.log("Attempting to fetch audio buffer from URL:", url);
        
        try {
          const audioContext = getAudioContext();
          if (!audioContext) {
            throw new Error("Failed to create AudioContext");
          }
          
          const audioDuration = audioRef.current.duration || 0;
          if (audioDuration <= 0) {
            throw new Error("Invalid audio duration");
          }
          
          if (url.startsWith('blob:')) {
            const response = await fetch(url);
            
            if (!response.ok) {
              throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            console.log("Blob URL fetched successfully, buffer size:", arrayBuffer.byteLength);
            
            if (arrayBuffer.byteLength === 0) {
              console.error("Error: Empty array buffer received");
              throw new Error("Empty audio file");
            }
            
            // Double-check audioContext is still valid
            if (audioContext.state === 'closed') {
              console.log("AudioContext was closed, creating a new one");
              const newContext = getAudioContext();
              if (!newContext) {
                throw new Error("Failed to create new AudioContext");
              }
              
              if (newContext.state === 'suspended') {
                await newContext.resume();
              }
              
              const audioBuffer = await newContext.decodeAudioData(arrayBuffer.slice(0));
              console.log("Audio data decoded successfully with new context, duration:", audioBuffer.duration);
              bufferToExport = audioBuffer;
            } else {
              try {
                // Create a copy of the buffer to avoid potential issues with buffer reuse
                const bufferCopy = arrayBuffer.slice(0);
                
                // Decode the audio data
                console.log("Attempting to decode audio data, context state:", audioContext.state);
                const audioBuffer = await audioContext.decodeAudioData(bufferCopy);
                console.log("Audio data decoded successfully, duration:", audioBuffer.duration);
                bufferToExport = audioBuffer;
              } catch (decodeError) {
                console.error("Error decoding audio data:", decodeError);
                throw decodeError;
              }
            }
          }
        } catch (error) {
          console.error("Error fetching blob URL:", error);
          throw error;
        }
      }
      
      if (!bufferToExport) {
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
      if (!audioContext) {
        throw new Error("Failed to create AudioContext");
      }
      
      const sampleRate = bufferToExport.sampleRate;
      const startSample = Math.floor(startTime * sampleRate);
      const endSample = Math.min(Math.floor(endTime * sampleRate), bufferToExport.length);
      const frameCount = endSample - startSample;
      
      if (frameCount <= 0) {
        toast.error('Sélection audio invalide');
        processingRef.current = false;
        return;
      }
      
      console.log(`Creating trimmed buffer with parameters:
        - Channels: ${Math.min(2, bufferToExport.numberOfChannels)}
        - Frame count: ${frameCount}
        - Sample rate: ${sampleRate}
        - Start sample: ${startSample}
        - End sample: ${endSample}
      `);
      
      const trimmedBuffer = audioContext.createBuffer(
        Math.min(2, bufferToExport.numberOfChannels),
        frameCount,
        sampleRate
      );
      
      for (let channel = 0; channel < trimmedBuffer.numberOfChannels; channel++) {
        if (channel < bufferToExport.numberOfChannels) {
          const channelData = new Float32Array(frameCount);
          bufferToExport.copyFromChannel(channelData, channel, startSample);
          trimmedBuffer.copyToChannel(channelData, channel);
        }
      }
      
      console.log("Trimmed buffer created successfully, proceeding to MP3 export with FFmpeg");
      
      // Convert trimmed AudioBuffer to WAV for FFmpeg processing
      const wavData = audioBufferToWav(trimmedBuffer);
      const wavBlob = new Blob([wavData], { type: 'audio/wav' });
      
      // Use FFmpeg to convert WAV to MP3
      const ffmpeg = ffmpegRef.current;
      if (!ffmpeg) {
        throw new Error("FFmpeg not initialized");
      }
      
      // Create input filename for FFmpeg
      const inputFileName = 'input.wav';
      const outputFileName = 'output.mp3';
      
      // Write the WAV file to FFmpeg's virtual file system
      await ffmpeg.writeFile(inputFileName, await fetchFile(wavBlob));
      
      // Run FFmpeg command to convert WAV to MP3 with high quality
      await ffmpeg.exec([
        '-i', inputFileName,
        '-c:a', 'libmp3lame',
        '-q:a', '2', // High quality (0-best, 9-worst)
        outputFileName
      ]);
      
      // Read the output file from FFmpeg's virtual file system
      const outputData = await ffmpeg.readFile(outputFileName);
      const mp3Blob = new Blob([outputData], { type: 'audio/mp3' });
      
      // Generate filename for the exported audio
      const fileName = currentAudioFile ? 
                      currentAudioFile.name.replace(/\.[^/.]+$/, "") : 
                      "audio";
      const exportFileName = `${fileName}_${formatTime(startTime).replace(':', '')}-${formatTime(endTime).replace(':', '')}.mp3`;
      
      const downloadUrl = URL.createObjectURL(mp3Blob);
      
      // Show toast with download action
      toast.success(`Export prêt: ${exportFileName}`, {
        description: `Découpé de ${formatTime(startTime)} à ${formatTime(endTime)} (MP3 format)`,
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
        duration: 10000 // Longer duration to give user time to click
      });

      // Also trigger automatic download
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = exportFileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      
      console.log(`Export completed successfully: ${exportFileName}`);
    } catch (error) {
      console.error('Error exporting audio:', error);
      toast.error('Erreur lors de l\'export du fichier audio');
    } finally {
      processingRef.current = false;
    }
  }, [audioBuffer, markers, duration, formatTime, getAudioContext, currentAudioFile, audioRef, ffmpegLoaded, loadFFmpeg]);

  return {
    exportTrimmedAudio
  };
};

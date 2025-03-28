
import { useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { AudioMarker } from './useAudioTypes';
import { useAudioContext } from './useAudioContext';
import lamejs from 'lamejs';

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

  const exportTrimmedAudio = useCallback(async () => {
    if (processingRef.current) {
      toast.info('Traitement en cours, veuillez patienter...');
      return;
    }
    
    processingRef.current = true;
    
    try {
      toast.info('Préparation de l\'audio pour l\'export...');
      
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
      
      console.log("Trimmed buffer created successfully, proceeding to MP3 export");
      
      // Convert to MP3 using lamejs
      const mp3Data = encodeToMp3(trimmedBuffer);
      
      const fileName = currentAudioFile ? 
                      currentAudioFile.name.replace(/\.[^/.]+$/, "") : 
                      "audio";
      const exportFileName = `${fileName}_${formatTime(startTime).replace(':', '')}-${formatTime(endTime).replace(':', '')}.mp3`;
      
      const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
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
  }, [audioBuffer, markers, duration, formatTime, getAudioContext, currentAudioFile, audioRef]);
  
  // Encode AudioBuffer to MP3 using lamejs
  function encodeToMp3(buffer: AudioBuffer): Uint8Array[] {
    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    
    // MP3 encoding parameters
    const bitRate = 128; // 128kbps
    const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, bitRate);
    
    const mp3Data: Uint8Array[] = [];
    
    // Process in chunks to avoid memory issues with large files
    const chunkSize = 1152; // MPEG frames have 1152 samples per frame
    const totalSamples = buffer.length;
    
    // Get samples from the AudioBuffer
    const samples = Array(channels).fill(0).map((_, channel) => {
      const channelData = new Float32Array(buffer.length);
      buffer.copyFromChannel(channelData, channel);
      return channelData;
    });
    
    // Process audio in chunks
    for (let i = 0; i < totalSamples; i += chunkSize) {
      const remaining = Math.min(chunkSize, totalSamples - i);
      
      // Convert float32 audio data to int16
      const left = new Int16Array(remaining);
      const right = channels > 1 ? new Int16Array(remaining) : null;
      
      for (let j = 0; j < remaining; j++) {
        // Convert float (-1 to 1) to int16 (-32768 to 32767)
        const idx = i + j;
        left[j] = Math.max(-32768, Math.min(32767, Math.floor(samples[0][idx] * 32768)));
        
        if (channels > 1 && right) {
          right[j] = Math.max(-32768, Math.min(32767, Math.floor(samples[1][idx] * 32768)));
        }
      }
      
      let mp3Buffer;
      if (channels === 1) {
        mp3Buffer = mp3encoder.encodeBuffer(left);
      } else {
        mp3Buffer = mp3encoder.encodeBuffer(left, right);
      }
      
      if (mp3Buffer && mp3Buffer.length > 0) {
        mp3Data.push(mp3Buffer);
      }
    }
    
    // Get the last buffer of data
    const finalBuffer = mp3encoder.flush();
    if (finalBuffer && finalBuffer.length > 0) {
      mp3Data.push(finalBuffer);
    }
    
    return mp3Data;
  }

  return {
    exportTrimmedAudio
  };
};

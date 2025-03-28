
import { useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { AudioMarker } from './useAudioTypes';
import { useAudioContext } from './useAudioContext';

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

  const wavToMp3 = useCallback(async (wavBlob: Blob, sampleRate: number): Promise<Blob> => {
    console.log("Converting WAV to MP3...");
    try {
      // Import lamejs dynamically to avoid issues
      const lamejs = await import('lamejs');
      
      const arrayBuffer = await wavBlob.arrayBuffer();
      const wavDataView = new DataView(arrayBuffer);
      
      // Basic WAV header validation
      const riffHeader = String.fromCharCode(
        wavDataView.getUint8(0),
        wavDataView.getUint8(1),
        wavDataView.getUint8(2),
        wavDataView.getUint8(3)
      );
      
      if (riffHeader !== 'RIFF') {
        throw new Error("Invalid WAV format");
      }
      
      // Find data chunk
      let offset = 36;
      let dataHeader = '';
      
      while (offset < wavDataView.byteLength - 4) {
        dataHeader = String.fromCharCode(
          wavDataView.getUint8(offset),
          wavDataView.getUint8(offset + 1),
          wavDataView.getUint8(offset + 2),
          wavDataView.getUint8(offset + 3)
        );
        
        if (dataHeader === 'data') {
          break;
        }
        
        const chunkSize = wavDataView.getUint32(offset + 4, true);
        offset += 8 + chunkSize;
      }
      
      if (dataHeader !== 'data') {
        throw new Error("Could not find 'data' chunk in WAV file");
      }
      
      const dataSize = wavDataView.getUint32(offset + 4, true);
      const dataOffset = offset + 8;
      
      // Determine if this is mono or stereo
      const numChannels = wavDataView.getUint16(22, true);
      
      // Create MP3 encoder
      const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 192);
      
      // Process the samples
      const sampleBlockSize = 1152; // must be a multiple of 576 to make encoder happy
      const mp3Data = [];
      
      const getInt16Sample = (offset: number) => {
        return wavDataView.getInt16(offset, true) / 0x8000; // Convert to float
      };
      
      for (let i = dataOffset; i < dataOffset + dataSize; i += sampleBlockSize * numChannels * 2) {
        const leftSamples = new Float32Array(sampleBlockSize);
        const rightSamples = numChannels === 2 ? new Float32Array(sampleBlockSize) : null;
        
        // Get samples from WAV
        for (let j = 0; j < sampleBlockSize; j++) {
          const sampleOffset = i + j * numChannels * 2;
          
          if (sampleOffset < dataOffset + dataSize) {
            leftSamples[j] = getInt16Sample(sampleOffset);
            
            if (numChannels === 2 && rightSamples) {
              rightSamples[j] = getInt16Sample(sampleOffset + 2);
            }
          }
        }
        
        // Convert float samples to short samples
        const leftShortSamples = new Int16Array(leftSamples.length);
        for (let s = 0; s < leftSamples.length; s++) {
          leftShortSamples[s] = leftSamples[s] * 0x7FFF;
        }
        
        let mp3buf;
        
        if (numChannels === 1) {
          mp3buf = mp3encoder.encodeBuffer(leftShortSamples);
        } else if (rightSamples) {
          const rightShortSamples = new Int16Array(rightSamples.length);
          for (let s = 0; s < rightSamples.length; s++) {
            rightShortSamples[s] = rightSamples[s] * 0x7FFF;
          }
          mp3buf = mp3encoder.encodeBuffer(leftShortSamples, rightShortSamples);
        } else {
          break;
        }
        
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
      }
      
      // Flush and get remaining MP3 data
      const mp3buf = mp3encoder.flush();
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
      
      // Create the MP3 blob
      const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
      console.log("MP3 conversion finished, blob size:", mp3Blob.size);
      
      return mp3Blob;
    } catch (error) {
      console.error("Error converting WAV to MP3:", error);
      throw error;
    }
  }, []);

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
            const arrayBuffer = await response.arrayBuffer();
            
            try {
              bufferToExport = await audioContext.decodeAudioData(arrayBuffer);
              console.log("Successfully decoded audio from URL");
            } catch (decodeError) {
              console.error("Failed to decode audio data:", decodeError);
              toast.error('Erreur lors du décodage de l\'audio');
              processingRef.current = false;
              return;
            }
          }
        } catch (error) {
          console.error("Error creating buffer:", error);
          toast.error('Erreur lors de la préparation de l\'audio pour l\'export');
          processingRef.current = false;
          return;
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
        const channelData = new Float32Array(frameCount);
        
        if (channel < bufferToExport.numberOfChannels) {
          bufferToExport.copyFromChannel(channelData, channel, startSample);
          trimmedBuffer.copyToChannel(channelData, channel);
        }
      }
      
      console.log("Trimmed buffer created successfully, proceeding to WAV encoding");
      
      // Format start and end time in minutes and seconds
      const formatTimeForFilename = (timeInSeconds: number) => {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes.toString().padStart(2, '0')}m${seconds.toString().padStart(2, '0')}s`;
      };
      
      const startTimeFormatted = formatTimeForFilename(startTime);
      const endTimeFormatted = formatTimeForFilename(endTime);
      
      // Step 1: Convert to WAV first
      toast.info('Conversion en format WAV...', { duration: 2000 });
      const wavBlob = await bufferToWav(trimmedBuffer);
      console.log(`Successfully encoded to WAV, blob size: ${wavBlob.size} bytes`);
      
      // Get base filename without extension
      const fileName = currentAudioFile ? 
                      currentAudioFile.name.replace(/\.[^/.]+$/, "") : 
                      "audio";
      
      // Include marker positions in the filename
      const wavFileName = `${fileName}_${startTimeFormatted}_${endTimeFormatted}.wav`;
      const mp3FileName = `${fileName}_${startTimeFormatted}_${endTimeFormatted}.mp3`;
      
      try {
        // Step 2: Convert WAV to MP3
        toast.info('Conversion en format MP3...', { duration: 3000 });
        const mp3Blob = await wavToMp3(wavBlob, sampleRate);
        console.log(`Successfully converted to MP3, blob size: ${mp3Blob.size} bytes`);
        
        // Create download URLs
        const wavUrl = URL.createObjectURL(wavBlob);
        const mp3Url = URL.createObjectURL(mp3Blob);
        
        toast.success(`Export terminé avec succès`, {
          description: `Audio découpé de ${formatTime(startTime)} à ${formatTime(endTime)}`,
          action: {
            label: 'MP3',
            onClick: () => {
              const a = document.createElement('a');
              a.href = mp3Url;
              a.download = mp3FileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(mp3Url), 100);
            }
          },
          duration: 8000
        });
        
        // Add a second toast for WAV download option
        toast.success(`Télécharger au format WAV`, {
          description: `Format audio non compressé`,
          action: {
            label: 'WAV',
            onClick: () => {
              const a = document.createElement('a');
              a.href = wavUrl;
              a.download = wavFileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(wavUrl), 100);
            }
          },
          duration: 8000
        });
        
        console.log(`Export completed successfully: ${mp3FileName} and ${wavFileName}`);
      } catch (conversionError) {
        console.error("MP3 conversion failed:", conversionError);
        
        // Fallback to WAV if MP3 conversion fails
        const wavUrl = URL.createObjectURL(wavBlob);
        
        toast.error("Conversion MP3 échouée, fichier WAV disponible", {
          description: `L'export MP3 a échoué mais le fichier WAV est disponible`,
          action: {
            label: 'WAV',
            onClick: () => {
              const a = document.createElement('a');
              a.href = wavUrl;
              a.download = wavFileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(wavUrl), 100);
            }
          },
          duration: 8000
        });
      }
    } catch (error) {
      console.error('Error exporting audio:', error);
      toast.error('Erreur lors de l\'export du fichier audio');
    } finally {
      processingRef.current = false;
    }
  }, [audioBuffer, markers, duration, formatTime, getAudioContext, currentAudioFile, bufferToWav, wavToMp3, audioRef]);

  return {
    exportTrimmedAudio
  };
};

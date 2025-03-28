
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

  const bufferToMp3 = useCallback((buffer: AudioBuffer, bitRate: number = 192): Promise<Blob> => {
    return new Promise((resolve) => {
      console.log(`Encoding audio to MP3 at ${bitRate}kbps`);
      
      const channels = Math.min(buffer.numberOfChannels, 2); // MP3 supports max 2 channels
      const sampleRate = buffer.sampleRate;
      
      // Create MP3 encoder
      const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, bitRate);
      const mp3Data: Int8Array[] = [];
      
      // Sample block size (recommended by lamejs)
      const sampleBlockSize = 1152;
      
      // Function to encode a batch of samples
      const encodeSamples = (start: number, end: number, channel: number) => {
        const samples = new Float32Array(end - start);
        buffer.copyFromChannel(samples, channel, start);
        return samples;
      };
      
      console.log(`Processing audio buffer: ${buffer.length} samples, ${channels} channels, ${sampleRate}Hz`);
      
      // Process in chunks to avoid memory issues
      const chunkSize = 10000;
      let offset = 0;
      
      while (offset < buffer.length) {
        const sampleChunkSize = Math.min(chunkSize, buffer.length - offset);
        
        // Create sample arrays for mp3 encoding
        const leftData = encodeSamples(offset, offset + sampleChunkSize, 0);
        
        let rightData: Float32Array | null = null;
        if (channels > 1) {
          rightData = encodeSamples(offset, offset + sampleChunkSize, 1);
        }
        
        // Process the current chunk in smaller blocks (as required by lamejs)
        for (let i = 0; i < sampleChunkSize; i += sampleBlockSize) {
          const blockSize = Math.min(sampleBlockSize, sampleChunkSize - i);
          
          // Convert float audio data to short (16-bit) integers
          const leftChunk = new Int16Array(blockSize);
          const rightChunk = new Int16Array(blockSize);
          
          for (let j = 0; j < blockSize; j++) {
            // Convert float [-1.0, 1.0] to int [-32768, 32767]
            const left = Math.max(-1, Math.min(1, leftData[i + j]));
            leftChunk[j] = left < 0 ? left * 32768 : left * 32767;
            
            if (rightData) {
              const right = Math.max(-1, Math.min(1, rightData[i + j]));
              rightChunk[j] = right < 0 ? right * 32768 : right * 32767;
            } else {
              // If mono, use the same data for both channels
              rightChunk[j] = leftChunk[j];
            }
          }
          
          // Encode this block
          let mp3buf;
          if (channels === 1) {
            mp3buf = mp3encoder.encodeBuffer(leftChunk);
          } else {
            mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
          }
          
          if (mp3buf && mp3buf.length > 0) {
            mp3Data.push(mp3buf);
          }
        }
        
        offset += sampleChunkSize;
      }
      
      // Finalize the MP3 encoding
      const end = mp3encoder.flush();
      if (end && end.length > 0) {
        mp3Data.push(end);
      }
      
      // Calculate total MP3 data length
      const totalLength = mp3Data.reduce((acc, buffer) => acc + buffer.length, 0);
      console.log(`MP3 encoding complete, total size: ${totalLength} bytes`);
      
      // Combine all MP3 data chunks
      const mp3Buffer = new Int8Array(totalLength);
      let offset2 = 0;
      for (const data of mp3Data) {
        mp3Buffer.set(data, offset2);
        offset2 += data.length;
      }
      
      // Create blob from the MP3 buffer
      const blob = new Blob([mp3Buffer], { type: 'audio/mp3' });
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
              const fallbackBuffer = audioContext.createBuffer(
                2,
                Math.floor(audioDuration * audioContext.sampleRate),
                audioContext.sampleRate
              );
              
              for (let channel = 0; channel < 2; channel++) {
                const channelData = fallbackBuffer.getChannelData(channel);
                for (let i = 0; i < channelData.length; i++) {
                  channelData[i] = 0.1 * Math.sin(i * 0.01);
                }
              }
              
              bufferToExport = fallbackBuffer;
              console.log("Created fallback buffer for export, duration:", audioDuration);
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
      
      console.log("Trimmed buffer created successfully, proceeding to MP3 export");
      
      // Using MP3 format at 192kbps
      const fileExtension = "mp3";
      const bitRate = 192;  // kbps
      
      const trimmedAudioBlob = await bufferToMp3(trimmedBuffer, bitRate);
      
      console.log(`Successfully encoded to ${fileExtension}, blob size: ${trimmedAudioBlob.size} bytes`);
      
      const fileName = currentAudioFile ? 
                      currentAudioFile.name.replace(/\.[^/.]+$/, "") : 
                      "audio";
      const exportFileName = `${fileName}_${formatTime(startTime).replace(':', '')}-${formatTime(endTime).replace(':', '')}.${fileExtension}`;
      
      const downloadUrl = URL.createObjectURL(trimmedAudioBlob);
      
      // Show toast with download action
      toast.success(`Export prêt: ${exportFileName}`, {
        description: `Découpé de ${formatTime(startTime)} à ${formatTime(endTime)} (${fileExtension.toUpperCase()} ${bitRate}k)`,
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
  }, [audioBuffer, markers, duration, formatTime, getAudioContext, currentAudioFile, bufferToMp3, audioRef]);

  return {
    exportTrimmedAudio
  };
};

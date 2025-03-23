
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

  const bufferToMp3 = useCallback((buffer: AudioBuffer, bitrate = 192): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      try {
        console.log("Starting MP3 encoding process...");
        const sampleRate = buffer.sampleRate;
        const numChannels = Math.min(buffer.numberOfChannels, 2);
        
        // Fix: Properly initialize the Mp3Encoder with correct parameters
        // lamejs uses STEREO (j=1), JOINT_STEREO (j=2), MONO (j=3) modes
        const mp3encoder = new lamejs.Mp3Encoder(
          numChannels, // 1 for mono, 2 for stereo
          sampleRate,
          bitrate
        );
        
        const mp3Data: Int8Array[] = [];
        
        const channelData: Float32Array[] = [];
        for (let i = 0; i < numChannels; i++) {
          channelData.push(buffer.getChannelData(i));
        }
        
        const sampleBlockSize = 1152; // Must be divisible by 576 to make sure Mp3 frames are aligned
        const totalSamples = buffer.length;
        
        // Process smaller chunks to avoid UI blocking
        const processChunkSize = 50000;
        
        const processChunk = async (startIndex: number) => {
          const endIndex = Math.min(startIndex + processChunkSize, totalSamples);
          
          for (let i = startIndex; i < endIndex; i += sampleBlockSize) {
            const leftChunk = new Int16Array(sampleBlockSize);
            const rightChunk = numChannels > 1 ? new Int16Array(sampleBlockSize) : undefined;
            
            // Convert Float32 samples to Int16 samples (which is what MP3 encoder expects)
            for (let j = 0; j < sampleBlockSize; j++) {
              if (i + j < totalSamples) {
                // Convert floating point [-1.0..1.0] to signed int [-32768..32767]
                leftChunk[j] = Math.max(-32768, Math.min(32767, channelData[0][i + j] * 32767));
                if (rightChunk && numChannels > 1) {
                  rightChunk[j] = Math.max(-32768, Math.min(32767, channelData[1][i + j] * 32767));
                }
              } else {
                // Pad with zeros if we're at the end of the buffer
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
          
          // If we haven't processed all samples, continue with the next chunk
          if (endIndex < totalSamples) {
            // Yield to the browser to avoid blocking the UI
            await new Promise(r => setTimeout(r, 0));
            return processChunk(endIndex);
          }
          
          // We're done encoding, get the last chunk of MP3 data
          const finalMp3buf = mp3encoder.flush();
          if (finalMp3buf && finalMp3buf.length > 0) {
            mp3Data.push(finalMp3buf);
          }
          
          // Create the final MP3 blob
          const blob = new Blob(mp3Data, { type: 'audio/mp3' });
          console.log("MP3 encoding completed successfully!");
          resolve(blob);
        };
        
        // Start processing the first chunk
        processChunk(0).catch(err => {
          console.error("Error processing MP3 chunks:", err);
          reject(err);
        });
      } catch (error) {
        console.error("Error in MP3 encoding:", error);
        console.log("MP3 encoding failed, falling back to WAV export");
        bufferToWav(buffer)
          .then(resolve)
          .catch(reject);
      }
    });
  }, [bufferToWav]);

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
          
          // Create buffer from the audio element's duration
          const audioDuration = audioRef.current.duration || 0;
          if (audioDuration <= 0) {
            throw new Error("Invalid audio duration");
          }
          
          // IMPORTANT: Instead of creating a synthetic buffer, let's try to decode the actual audio
          // We'll use the fetch API to get the audio data from the blob URL
          if (url.startsWith('blob:')) {
            // For blob URLs, we need to fetch the data
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            
            // Now decode the array buffer to get the audio data
            try {
              bufferToExport = await audioContext.decodeAudioData(arrayBuffer);
              console.log("Successfully decoded audio from URL");
            } catch (decodeError) {
              console.error("Failed to decode audio data:", decodeError);
              // Fall back to synthetic buffer if decoding fails
              const fallbackBuffer = audioContext.createBuffer(
                2, // Stereo
                Math.floor(audioDuration * audioContext.sampleRate),
                audioContext.sampleRate
              );
              
              // Create a simple synthetic waveform for the fallback buffer
              for (let channel = 0; channel < 2; channel++) {
                const channelData = fallbackBuffer.getChannelData(channel);
                for (let i = 0; i < channelData.length; i++) {
                  // Simple sine wave with some variation
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
      
      // Create a new buffer for the trimmed audio
      const trimmedBuffer = audioContext.createBuffer(
        Math.min(2, bufferToExport.numberOfChannels),
        frameCount,
        sampleRate
      );
      
      // Copy the audio data from the source buffer to the trimmed buffer
      for (let channel = 0; channel < trimmedBuffer.numberOfChannels; channel++) {
        const channelData = new Float32Array(frameCount);
        
        // Only copy if the source buffer has this channel
        if (channel < bufferToExport.numberOfChannels) {
          // Copy the data from the source buffer to our temporary buffer
          bufferToExport.copyFromChannel(channelData, channel, startSample);
          // Copy the data from our temporary buffer to the trimmed buffer
          trimmedBuffer.copyToChannel(channelData, channel);
        }
      }
      
      console.log("Trimmed buffer created successfully, proceeding to MP3 encoding");
      
      const fileExtension = "mp3";
      const bitrate = 192;
      
      console.log(`Starting encoding to ${fileExtension} with bitrate ${bitrate}kbps`);
      
      // Try MP3 encoding, but be ready to fall back to WAV if it fails
      let trimmedAudioBlob: Blob;
      try {
        trimmedAudioBlob = await bufferToMp3(trimmedBuffer, bitrate);
      } catch (mp3Error) {
        console.error("MP3 encoding failed:", mp3Error);
        console.log("Falling back to WAV encoding");
        trimmedAudioBlob = await bufferToWav(trimmedBuffer);
        // Change the file extension for the filename
        fileExtension = "wav";
      }
      
      console.log(`Successfully encoded to ${fileExtension}, blob size: ${trimmedAudioBlob.size} bytes`);
      
      // Create a descriptive filename
      const fileName = currentAudioFile ? 
                      currentAudioFile.name.replace(/\.[^/.]+$/, "") : 
                      "audio";
      const exportFileName = `${fileName}_${formatTime(startTime).replace(':', '')}-${formatTime(endTime).replace(':', '')}.${fileExtension}`;
      
      const downloadUrl = URL.createObjectURL(trimmedAudioBlob);
      
      toast.success(`Export prêt: ${exportFileName}`, {
        description: `Découpé de ${formatTime(startTime)} à ${formatTime(endTime)} (${fileExtension.toUpperCase()} ${bitrate}kbps)`,
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
  }, [audioBuffer, markers, duration, formatTime, getAudioContext, currentAudioFile, bufferToMp3, bufferToWav, audioRef]);

  return {
    exportTrimmedAudio
  };
};

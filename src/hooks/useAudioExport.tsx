
import { useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { AudioMarker } from './useAudioTypes';
import { useAudioContext } from './useAudioContext';
import * as lamejs from 'lamejs';

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
      
      // Use lamejs to convert to MP3
      const mp3Data = audioBufferToMp3(trimmedBuffer);
      const trimmedAudioBlob = new Blob(mp3Data, { type: 'audio/mp3' });
      
      console.log(`Successfully encoded to MP3, blob size: ${trimmedAudioBlob.size} bytes`);
      
      const fileName = currentAudioFile ? 
                      currentAudioFile.name.replace(/\.[^/.]+$/, "") : 
                      "audio";
      const exportFileName = `${fileName}_${formatTime(startTime).replace(':', '')}-${formatTime(endTime).replace(':', '')}.mp3`;
      
      const downloadUrl = URL.createObjectURL(trimmedAudioBlob);
      
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
  
  // Convert AudioBuffer to MP3 format using lamejs library
  function audioBufferToMp3(buffer: AudioBuffer): Uint8Array[] {
    try {
      console.log("Starting MP3 encoding with lamejs...");
      
      // Get buffer parameters
      const channels = buffer.numberOfChannels;
      const sampleRate = buffer.sampleRate;
      const samples = buffer.getChannelData(0);
      
      // For stereo, get right channel samples
      const rightChannel = channels > 1 ? buffer.getChannelData(1) : samples;
      
      // Set MP3 encoding parameters
      const bitRate = 192; // 192kbps is a good quality
      const sampleBlockSize = 1152; // Default MP3 sample block size
      
      // Create MP3 encoder - using integer constants instead of enum values
      // For reference: STEREO = 0, JOINT_STEREO = 1, DUAL_CHANNEL = 2, MONO = 3
      const mp3encoder = channels > 1 
        ? new lamejs.Mp3Encoder(2, sampleRate, bitRate) // Stereo
        : new lamejs.Mp3Encoder(1, sampleRate, bitRate); // Mono
      
      const mp3Data: Uint8Array[] = [];
      
      if (channels === 1) {
        // Mono encoding
        console.log("Encoding MP3 in mono mode");
        const samplesInt16 = floatTo16BitPCM(samples);
        let remaining = samplesInt16.length;
        let offset = 0;
        
        while (remaining >= sampleBlockSize) {
          const sampleChunk = samplesInt16.subarray(offset, offset + sampleBlockSize);
          const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
          if (mp3buf.length > 0) {
            mp3Data.push(new Uint8Array(mp3buf));
          }
          offset += sampleBlockSize;
          remaining -= sampleBlockSize;
        }
        
        // Flush the encoder
        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) {
          mp3Data.push(new Uint8Array(mp3buf));
        }
      } else {
        // Stereo encoding
        console.log("Encoding MP3 in stereo mode");
        const leftSamplesInt16 = floatTo16BitPCM(samples);
        const rightSamplesInt16 = floatTo16BitPCM(rightChannel);
        let remaining = leftSamplesInt16.length;
        let offset = 0;
        
        while (remaining >= sampleBlockSize) {
          const leftChunk = leftSamplesInt16.subarray(offset, offset + sampleBlockSize);
          const rightChunk = rightSamplesInt16.subarray(offset, offset + sampleBlockSize);
          const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
          if (mp3buf.length > 0) {
            mp3Data.push(new Uint8Array(mp3buf));
          }
          offset += sampleBlockSize;
          remaining -= sampleBlockSize;
        }
        
        // Flush the encoder
        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) {
          mp3Data.push(new Uint8Array(mp3buf));
        }
      }
      
      console.log(`MP3 encoding successful - created ${mp3Data.length} chunks`);
      return mp3Data;
    } catch (error) {
      console.error("Error in MP3 encoding:", error);
      throw new Error(`MP3 encoding failed: ${error.message}`);
    }
  }
  
  // Helper function to convert float audio data to 16-bit PCM
  function floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  }

  return {
    exportTrimmedAudio
  };
};

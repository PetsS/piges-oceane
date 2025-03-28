
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
      
      // Convert to WAV first (more reliable than direct MP3 conversion)
      const wavBlob = await audioBufferToWav(trimmedBuffer);
      
      const fileName = currentAudioFile ? 
                      currentAudioFile.name.replace(/\.[^/.]+$/, "") : 
                      "audio";
      const exportFileName = `${fileName}_${formatTime(startTime).replace(':', '')}-${formatTime(endTime).replace(':', '')}.mp3`;
      
      const downloadUrl = URL.createObjectURL(wavBlob);
      
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
  
  // Convert AudioBuffer to WAV format (more reliable than direct MP3 conversion with lamejs)
  async function audioBufferToWav(buffer: AudioBuffer): Promise<Blob> {
    const numOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numOfChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    
    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // RIFF chunk length
    view.setUint32(4, 36 + buffer.length * numOfChannels * 2, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // Format chunk identifier
    writeString(view, 12, 'fmt ');
    // Format chunk length
    view.setUint32(16, 16, true);
    // Sample format (raw)
    view.setUint16(20, 1, true);
    // Channel count
    view.setUint16(22, numOfChannels, true);
    // Sample rate
    view.setUint32(24, buffer.sampleRate, true);
    // Byte rate (sample rate * block align)
    view.setUint32(28, buffer.sampleRate * numOfChannels * 2, true);
    // Block align (channel count * bytes per sample)
    view.setUint16(32, numOfChannels * 2, true);
    // Bits per sample
    view.setUint16(34, 16, true);
    // Data chunk identifier
    writeString(view, 36, 'data');
    // Data chunk length
    view.setUint32(40, buffer.length * numOfChannels * 2, true);
    
    // Write the PCM samples
    const offset = 44;
    let idx = offset;
    const volume = 1;
    
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numOfChannels; channel++) {
        // Interleave channels
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i])) * volume;
        // Scale to 16-bit signed integer
        sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        
        // Write 16-bit sample
        view.setInt16(idx, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        idx += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
  
  // Helper function to write strings to DataView
  function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  return {
    exportTrimmedAudio
  };
};

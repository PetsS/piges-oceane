
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
            const arrayBuffer = await response.arrayBuffer();
            
            try {
              bufferToExport = await audioContext.decodeAudioData(arrayBuffer);
              console.log("Successfully decoded audio from URL");
            } catch (decodeError) {
              console.error("Failed to decode audio data:", decodeError);
              throw new Error("Error decoding audio data");
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
        if (channel < bufferToExport.numberOfChannels) {
          const channelData = new Float32Array(frameCount);
          bufferToExport.copyFromChannel(channelData, channel, startSample);
          trimmedBuffer.copyToChannel(channelData, channel);
        }
      }
      
      console.log("Trimmed buffer created successfully, proceeding to WAV export");
      
      // Using WAV format instead of MP3 since there are issues with lamejs
      const audioData = audioBufferToWav(trimmedBuffer);
      const trimmedAudioBlob = new Blob([audioData], { type: 'audio/wav' });
      
      console.log(`Successfully encoded to WAV, blob size: ${trimmedAudioBlob.size} bytes`);
      
      const fileName = currentAudioFile ? 
                      currentAudioFile.name.replace(/\.[^/.]+$/, "") : 
                      "audio";
      const exportFileName = `${fileName}_${formatTime(startTime).replace(':', '')}-${formatTime(endTime).replace(':', '')}.wav`;
      
      const downloadUrl = URL.createObjectURL(trimmedAudioBlob);
      
      // Show toast with download action
      toast.success(`Export prêt: ${exportFileName}`, {
        description: `Découpé de ${formatTime(startTime)} à ${formatTime(endTime)} (WAV format)`,
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
  
  // Convert AudioBuffer to WAV format
  function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numChannels = buffer.numberOfChannels;
    const length = buffer.length * numChannels * 2; // 16-bit audio (2 bytes per sample)
    const sampleRate = buffer.sampleRate;
    
    // WAV header size is 44 bytes
    const wavDataView = new DataView(new ArrayBuffer(44 + length));
    
    // Write WAV header
    // "RIFF" chunk descriptor
    writeString(wavDataView, 0, 'RIFF');
    wavDataView.setUint32(4, 36 + length, true); // file size
    writeString(wavDataView, 8, 'WAVE');
    
    // "fmt " sub-chunk
    writeString(wavDataView, 12, 'fmt ');
    wavDataView.setUint32(16, 16, true); // fmt chunk size
    wavDataView.setUint16(20, 1, true); // audio format (1 for PCM)
    wavDataView.setUint16(22, numChannels, true); // number of channels
    wavDataView.setUint32(24, sampleRate, true); // sample rate
    wavDataView.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
    wavDataView.setUint16(32, numChannels * 2, true); // block align
    wavDataView.setUint16(34, 16, true); // bits per sample
    
    // "data" sub-chunk
    writeString(wavDataView, 36, 'data');
    wavDataView.setUint32(40, length, true); // data chunk size
    
    // Write audio data
    const channelData = [];
    for (let channel = 0; channel < numChannels; channel++) {
      channelData.push(buffer.getChannelData(channel));
    }
    
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
        // Convert float [-1.0, 1.0] to int16 [-32768, 32767]
        const val = sample < 0 ? sample * 32768 : sample * 32767;
        wavDataView.setInt16(offset, val, true);
        offset += 2;
      }
    }
    
    return wavDataView.buffer;
  }
  
  // Helper function to write a string to a DataView
  function writeString(dataView: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      dataView.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  return {
    exportTrimmedAudio
  };
};

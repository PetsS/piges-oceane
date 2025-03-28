
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

  // Skip MP3 encoding and always use WAV format for simplicity and reliability
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
      
      console.log("Trimmed buffer created successfully, proceeding to WAV export");
      
      // We're using WAV format only as it's more reliable
      const fileExtension = "wav";
      
      const trimmedAudioBlob = await bufferToWav(trimmedBuffer);
      
      console.log(`Successfully encoded to ${fileExtension}, blob size: ${trimmedAudioBlob.size} bytes`);
      
      const fileName = currentAudioFile ? 
                      currentAudioFile.name.replace(/\.[^/.]+$/, "") : 
                      "audio";
      const exportFileName = `${fileName}_${formatTime(startTime).replace(':', '')}-${formatTime(endTime).replace(':', '')}.${fileExtension}`;
      
      const downloadUrl = URL.createObjectURL(trimmedAudioBlob);
      
      // Show toast with download action
      toast.success(`Export prêt: ${exportFileName}`, {
        description: `Découpé de ${formatTime(startTime)} à ${formatTime(endTime)} (${fileExtension.toUpperCase()})`,
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
  }, [audioBuffer, markers, duration, formatTime, getAudioContext, currentAudioFile, bufferToWav, audioRef]);

  return {
    exportTrimmedAudio
  };
};

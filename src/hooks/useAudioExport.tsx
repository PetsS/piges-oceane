
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

  // conversion to MP3 using lamejs 
  const bufferToMp3 = useCallback((buffer: AudioBuffer): Blob | null => {
    const lamejs = (window as any).lamejs;

    if (!lamejs || !lamejs.Mp3Encoder) {
      console.error('LameJS is not loaded or Mp3Encoder is undefined');
      toast.error("LameJS (encodeur MP3) n'est pas chargé. Vérifiez que le script est bien inclus.");
      return null;
    }
    
    const Mp3Encoder = lamejs.Mp3Encoder;

    const sampleRate = buffer.sampleRate;
    const numChannels = buffer.numberOfChannels;
    const mp3Encoder = new Mp3Encoder(numChannels, sampleRate, 128);
    const samplesLeft = buffer.getChannelData(0);
    const samplesRight = numChannels > 1 ? buffer.getChannelData(1) : samplesLeft;
    const mp3Data: Uint8Array[] = [];
  
    const convertFloatToInt16 = (buffer: Float32Array) => {
      const l = buffer.length;
      const result = new Int16Array(l);
      for (let i = 0; i < l; i++) {
        result[i] = Math.max(-1, Math.min(1, buffer[i])) * 32767;
      }
      return result;
    };
  
    const samplesLeft16 = convertFloatToInt16(samplesLeft);
    const samplesRight16 = convertFloatToInt16(samplesRight);
  
    const chunkSize = 1152;
    for (let i = 0; i < samplesLeft16.length; i += chunkSize) {
      const leftChunk = samplesLeft16.subarray(i, i + chunkSize);
      const rightChunk = samplesRight16.subarray(i, i + chunkSize);
      const mp3buf = mp3Encoder.encodeBuffer(leftChunk, rightChunk);
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }
  
    const mp3End = mp3Encoder.flush();
    if (mp3End.length > 0) {
      mp3Data.push(mp3End);
    }
  
    return new Blob(mp3Data, { type: 'audio/mpeg' });
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
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();

          if (arrayBuffer.byteLength === 0) {
            throw new Error("ArrayBuffer is empty. Cannot decode.");
          }

          const audioContext = getAudioContext();
          if (!audioContext) {
            throw new Error("Failed to create AudioContext");
          }

          try {
            bufferToExport = await audioContext.decodeAudioData(arrayBuffer);
            console.log("Successfully decoded audio from URL");
          } catch (decodeError) {
            console.error("Audio Decoding Failed:", decodeError);
            toast.error(`Erreur de décodage audio: ${decodeError.message}`);
            processingRef.current = false;
            return;
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
      
      console.log("Trimmed buffer created successfully, proceeding to MP3 encoding");
      
      // Format start and end time in minutes and seconds
      const formatTimeForFilename = (timeInSeconds: number) => {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes.toString().padStart(2, '0')}m${seconds.toString().padStart(2, '0')}s`;
      };
      
      const startTimeFormatted = formatTimeForFilename(startTime);
      const endTimeFormatted = formatTimeForFilename(endTime);

      // Convert to MP3
      toast.info('Conversion en format MP3...', { duration: 2000 });
      const mp3Blob = bufferToMp3(trimmedBuffer);
      if (!mp3Blob) {
        toast.error('Erreur lors de la conversion en MP3');
        processingRef.current = false;
        return;
      }
      console.log(`Successfully encoded to MP3, blob size: ${mp3Blob.size} bytes`);
      
      // Get base filename without extension
      const fileName = currentAudioFile ? 
                      currentAudioFile.name.replace(/\.[^/.]+$/, "") : 
                      "audio";
      
      // Include marker positions in the filename
      const mp3FileName = `${fileName}_${startTimeFormatted}_${endTimeFormatted}.mp3`;
      
      // Create download URL for MP3
      const mp3Url = URL.createObjectURL(mp3Blob);

      // Trigger immediate download of MP3 file
      const mp3DownloadLink = document.createElement('a');
      mp3DownloadLink.href = mp3Url;
      mp3DownloadLink.download = mp3FileName;
      document.body.appendChild(mp3DownloadLink);
      mp3DownloadLink.click();
      document.body.removeChild(mp3DownloadLink);
      
      toast.success(`Export MP3 terminé avec succès`, {
        description: `Audio découpé de ${formatTime(startTime)} à ${formatTime(endTime)}`,
        duration: 8000
      });
      
      // Clean up blob URL
      setTimeout(() => URL.revokeObjectURL(mp3Url), 3000);
      
      console.log(`Export completed successfully: ${mp3FileName}`);
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

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

  const bufferToMp3 = useCallback((buffer: AudioBuffer): Promise<Blob> => {
    return new Promise((resolve) => {
      const bitRate = 192;
      
      const numOfChannels = Math.min(buffer.numberOfChannels, 2);
      const sampleRate = buffer.sampleRate;
      
      const mp3encoder = new lamejs.Mp3Encoder(numOfChannels, sampleRate, bitRate);
      const mp3Data = [];
      
      const sampleBlockSize = 1152;
      
      const leftChannel = buffer.getChannelData(0);
      const rightChannel = numOfChannels > 1 ? buffer.getChannelData(1) : leftChannel;
      
      for (let i = 0; i < buffer.length; i += sampleBlockSize) {
        const leftChunk = new Int16Array(sampleBlockSize);
        const rightChunk = new Int16Array(sampleBlockSize);
        
        for (let j = 0; j < sampleBlockSize; j++) {
          if (i + j < buffer.length) {
            const left = leftChannel[i + j];
            const right = rightChannel[i + j];
            
            leftChunk[j] = left < 0 ? Math.max(-32768, left * 32768) : Math.min(32767, left * 32768);
            rightChunk[j] = right < 0 ? Math.max(-32768, right * 32768) : Math.min(32767, right * 32768);
          }
        }
        
        let mp3buf;
        if (numOfChannels === 1) {
          mp3buf = mp3encoder.encodeBuffer(leftChunk);
        } else {
          mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
        }
        
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
      }
      
      const mp3buf = mp3encoder.flush();
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
      
      let totalLength = 0;
      for (let i = 0; i < mp3Data.length; i++) {
        totalLength += mp3Data[i].length;
      }
      
      const mp3Buffer = new Uint8Array(totalLength);
      let offset = 0;
      for (let i = 0; i < mp3Data.length; i++) {
        mp3Buffer.set(mp3Data[i], offset);
        offset += mp3Data[i].length;
      }
      
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
      
      const formatTimeForFilename = (timeInSeconds: number) => {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes.toString().padStart(2, '0')}m${seconds.toString().padStart(2, '0')}s`;
      };
      
      const startTimeFormatted = formatTimeForFilename(startTime);
      const endTimeFormatted = formatTimeForFilename(endTime);
      
      const fileName = currentAudioFile ? 
                      currentAudioFile.name.replace(/\.[^/.]+$/, "") : 
                      "audio";
      
      const wavFileName = `${fileName}_${startTimeFormatted}_${endTimeFormatted}.wav`;
      const mp3FileName = `${fileName}_${startTimeFormatted}_${endTimeFormatted}.mp3`;
      
      const wavBlob = await bufferToWav(trimmedBuffer);
      const mp3Blob = await bufferToMp3(trimmedBuffer);
      
      const wavUrl = URL.createObjectURL(wavBlob);
      const mp3Url = URL.createObjectURL(mp3Blob);
      
      const wavDownloadLink = document.createElement('a');
      wavDownloadLink.href = wavUrl;
      wavDownloadLink.download = wavFileName;
      document.body.appendChild(wavDownloadLink);
      wavDownloadLink.click();
      document.body.removeChild(wavDownloadLink);
      
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
      
      setTimeout(() => {
        URL.revokeObjectURL(wavUrl);
        URL.revokeObjectURL(mp3Url);
      }, 3000);
      
      console.log(`Export completed successfully: ${mp3FileName}`);
    } catch (error) {
      console.error('Error exporting audio:', error);
      toast.error('Erreur lors de l\'export du fichier audio');
    } finally {
      processingRef.current = false;
    }
  }, [audioBuffer, markers, duration, formatTime, getAudioContext, currentAudioFile, bufferToWav, bufferToMp3, audioRef]);

  return {
    exportTrimmedAudio
  };
};

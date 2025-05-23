
import { useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { AudioMarker } from './useAudioTypes';
import { useAudioContext } from './useAudioContext';
import { ffmpeg } from '@/utils/ffmpegInstance';
import { fetchFile } from '@ffmpeg/util';
// import { trimmedBufferToWav } from '@/utils/audioUtils';

export const useAudioExport = (
  audioBuffer: AudioBuffer | null,
  markers: AudioMarker[],
  duration: number,
  formatTime: (time: number) => string,
  audioRef: React.RefObject<HTMLAudioElement>,
  currentAudioFile: { name: string; url: string } | null
) => {
  const processingRef = useRef<boolean>(false);
  const { getAudioContext } = useAudioContext();

  let loadPromise: Promise<void> | null = null;

  const initializeFFmpeg = useCallback(async () => {
    if (!ffmpeg.isLoaded()) {
      if (!loadPromise) {
        loadPromise = ffmpeg.load();
      }
      await loadPromise;
      console.log('FFmpeg.wasm is ready (via memoized load)!');
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

      if (!audioRef.current || !audioRef.current.src) {
        toast.error('Aucun audio chargé');
        processingRef.current = false;
        return;
      }

      const url = currentAudioFile?.url || audioRef.current.src;
      console.log("Fetching MP3 from URL:", url);

      const response = await fetch(url);
      const mp3Blob = await response.blob();

      if (mp3Blob.size === 0) {
        throw new Error("MP3 Blob is empty. Cannot export.");
      }

      const mp3File = new File([mp3Blob], 'input.mp3');

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

      await initializeFFmpeg();

      console.log("Writing MP3 file to FFmpeg FS...");
      ffmpeg.FS('writeFile', 'input.mp3', await fetchFile(mp3File));

      console.log("Running FFmpeg trim command...");
      await ffmpeg.run(
        '-ss', startTime.toString(),
        '-to', endTime.toString(),
        '-i', 'input.mp3',
        '-c', 'copy',
        'output.mp3'
      );

      const mp3Data = ffmpeg.FS('readFile', 'output.mp3');
      const trimmedMp3Blob = new Blob([mp3Data.buffer], { type: 'audio/mpeg' });

      // Format file name
      const formatTimeForFilename = (timeInSeconds: number) => {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes.toString().padStart(2, '0')}m${seconds.toString().padStart(2, '0')}s`;
      };

      const startTimeFormatted = formatTimeForFilename(startTime);
      const endTimeFormatted = formatTimeForFilename(endTime);
      const mp3FileName = `${currentAudioFile?.name.replace(/\.[^/.]+$/, "") ?? 'audio'}_${startTimeFormatted}_${endTimeFormatted}.mp3`;

      // Trigger download
      const mp3Url = URL.createObjectURL(trimmedMp3Blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = mp3Url;
      downloadLink.download = mp3FileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      toast.success(`Export MP3 terminé avec succès`, {
        description: `Audio découpé de ${formatTime(startTime)} à ${formatTime(endTime)}`,
        duration: 8000
      });

      // Cleanup
      URL.revokeObjectURL(mp3Url);
      ffmpeg.FS('unlink', 'input.mp3');
      ffmpeg.FS('unlink', 'output.mp3');

    } catch (error) {
      console.error('Error exporting audio:', error);
      toast.error('Erreur lors de l\'export du fichier audio');
    } finally {
      processingRef.current = false;
    }
  }, [markers, duration, formatTime, currentAudioFile, initializeFFmpeg]);

  return {
    exportTrimmedAudio
  };
};

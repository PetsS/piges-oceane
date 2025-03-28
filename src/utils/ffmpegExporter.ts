
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";

export interface ExportProgressListener {
  onProgress: (progress: number) => void;
  onComplete: (url: string, filename: string) => void;
  onError: (error: string) => void;
}

export class FFmpegExporter {
  private ffmpeg: FFmpeg | null = null;
  private isLoaded = false;
  private isLoading = false;
  
  constructor() {
    this.ffmpeg = new FFmpeg();
  }
  
  async load(listener: ExportProgressListener): Promise<boolean> {
    if (this.isLoaded) return true;
    if (this.isLoading) return false;
    
    try {
      this.isLoading = true;
      
      // Use direct import from CDN with correct paths
      // In @ffmpeg/core@0.12.5, the files are directly in the package, not in /dist
      console.log('Loading FFmpeg...');
      await this.ffmpeg!.load({
        coreURL: await toBlobURL('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.5/ffmpeg-core.js', 'text/javascript'),
        wasmURL: await toBlobURL('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.5/ffmpeg-core.wasm', 'application/wasm')
      });
      
      console.log('FFmpeg loaded successfully');
      this.isLoaded = true;
      this.isLoading = false;
      return true;
    } catch (error) {
      console.error('Error loading FFmpeg:', error);
      listener.onError(`Failed to load audio processor: ${error.message || 'Unknown error'}`);
      this.isLoading = false;
      return false;
    }
  }
  
  async trimAudioToMP3(
    audioSource: string,
    startTime: number,
    duration: number,
    outputFilename: string,
    listener: ExportProgressListener
  ): Promise<void> {
    if (!this.isLoaded) {
      const loaded = await this.load(listener);
      if (!loaded) {
        return;
      }
    }
    
    try {
      // Set up progress monitoring
      this.ffmpeg!.on('progress', ({ progress }) => {
        listener.onProgress(progress * 100);
      });
      
      // Fetch the audio file
      console.log(`Fetching audio from: ${audioSource}`);
      const inputData = await fetchFile(audioSource);
      const inputFilename = 'input.mp3';
      
      // Write the input file to FFmpeg's virtual file system
      await this.ffmpeg!.writeFile(inputFilename, inputData);
      
      // Format the start time and duration for FFmpeg command
      const startTimeStr = this.formatTimeForFFmpeg(startTime);
      const durationStr = this.formatTimeForFFmpeg(duration);
      
      // Execute the FFmpeg command
      console.log(`Executing FFmpeg command with start: ${startTimeStr}, duration: ${durationStr}`);
      await this.ffmpeg!.exec([
        '-i', inputFilename,
        '-ss', startTimeStr,
        '-t', durationStr,
        '-acodec', 'libmp3lame',
        '-q:a', '2', // Higher quality MP3
        outputFilename
      ]);
      
      // Read the output file from FFmpeg's virtual file system
      const outputData = await this.ffmpeg!.readFile(outputFilename);
      
      // Create a blob URL for the output file
      const blob = new Blob([outputData], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      
      console.log('Audio export complete');
      listener.onComplete(url, outputFilename);
    } catch (error) {
      console.error('Error exporting audio:', error);
      listener.onError(`Error processing audio: ${error.message || 'Unknown error'}`);
    }
  }
  
  private formatTimeForFFmpeg(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }
  
  terminate() {
    if (this.ffmpeg) {
      this.ffmpeg.terminate();
      this.ffmpeg = null;
      this.isLoaded = false;
      this.isLoading = false;
    }
  }
}

// Create a singleton instance
export const ffmpegExporter = new FFmpegExporter();

import { Mp3Encoder } from "lamejs";

export interface ExportProgressListener {
  onProgress: (progress: number) => void;
  onComplete: (url: string, filename: string) => void;
  onError: (error: string) => void;
}

export class FFmpegExporter {
  private isLoaded = true; // Always true since we don't need to load external libraries
  
  async load(listener: ExportProgressListener): Promise<boolean> {
    return this.isLoaded;
  }
  
  async trimAudioToMP3(
    audioSource: string,
    startTime: number,
    duration: number,
    outputFilename: string,
    listener: ExportProgressListener
  ): Promise<void> {
    try {
      // Fetch the audio file
      console.log(`Fetching audio from: ${audioSource}`);
      const response = await fetch(audioSource);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Create an audio context to decode the audio
      const audioContext = new AudioContext();
      const audioData = await audioContext.decodeAudioData(arrayBuffer);
      
      // Calculate the start and end sample positions
      const startSample = Math.floor(startTime * audioData.sampleRate);
      const endSample = Math.min(
        Math.floor((startTime + duration) * audioData.sampleRate),
        audioData.length
      );
      const sampleCount = endSample - startSample;
      
      // Prepare the data for MP3 encoding
      const channels = audioData.numberOfChannels;
      const sampleRate = audioData.sampleRate;
      const bitRate = 192; // 192kbps, good quality
      
      // Create MP3 encoder - corrected implementation
      const encoder = new Mp3Encoder(
        Math.min(2, channels), // lamejs supports max 2 channels
        sampleRate,
        bitRate
      );
      
      // Create buffer to hold the MP3 data
      const mp3Data = [];
      const blockSize = 1152; // This is a standard MP3 block size
      
      // Get audio data
      const samplesLeft = new Float32Array(sampleCount);
      const samplesRight = channels > 1 ? new Float32Array(sampleCount) : null;
      
      // Extract the portion of audio we want to keep
      audioData.copyFromChannel(samplesLeft, 0, startSample);
      if (channels > 1 && samplesRight) {
        audioData.copyFromChannel(samplesRight, 1, startSample);
      }
      
      // Process the audio data in chunks
      const totalChunks = Math.ceil(sampleCount / blockSize);
      let currentChunk = 0;
      
      for (let i = 0; i < sampleCount; i += blockSize) {
        const blockLength = Math.min(blockSize, sampleCount - i);
        
        // Prepare sample blocks
        const leftBlock = new Int16Array(blockLength);
        const rightBlock = channels > 1 ? new Int16Array(blockLength) : leftBlock;
        
        // Convert float samples to int16
        for (let j = 0; j < blockLength; j++) {
          // Convert float32 to int16 (-32768 to 32767)
          leftBlock[j] = Math.max(-32768, Math.min(32767, Math.round(samplesLeft[i + j] * 32767)));
          if (channels > 1 && samplesRight) {
            rightBlock[j] = Math.max(-32768, Math.min(32767, Math.round(samplesRight[i + j] * 32767)));
          }
        }
        
        // Encode this block
        const mp3Block = encoder.encodeBuffer(leftBlock, rightBlock);
        if (mp3Block.length > 0) {
          mp3Data.push(mp3Block);
        }
        
        currentChunk++;
        const progress = (currentChunk / totalChunks) * 95; // Up to 95%
        listener.onProgress(progress);
      }
      
      // Finalize the encoding
      const finalBlock = encoder.flush();
      if (finalBlock.length > 0) {
        mp3Data.push(finalBlock);
      }
      
      listener.onProgress(95);
      
      // Concatenate the MP3 chunks
      let totalLength = 0;
      mp3Data.forEach(chunk => totalLength += chunk.length);
      const mp3Buffer = new Uint8Array(totalLength);
      
      let offset = 0;
      mp3Data.forEach(chunk => {
        mp3Buffer.set(chunk, offset);
        offset += chunk.length;
      });
      
      // Create a blob and URL
      const blob = new Blob([mp3Buffer], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      
      listener.onProgress(100);
      listener.onComplete(url, outputFilename);
      
      // Close the audio context when done
      audioContext.close();
      
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
    // No need to terminate anything when using lamejs
  }
}

// Create a singleton instance
export const ffmpegExporter = new FFmpegExporter();

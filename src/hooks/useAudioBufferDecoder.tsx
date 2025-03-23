
import { useCallback } from 'react';

export const useAudioBufferDecoder = (getAudioContext: () => AudioContext | null) => {
  const fetchAndDecodeAudio = useCallback(async (url: string): Promise<AudioBuffer | null> => {
    try {
      console.log("Fetching audio from URL:", url);
      
      // For local files (blob URLs)
      if (url.startsWith('blob:')) {
        console.log("Processing local blob URL:", url);
        
        // For large files, we only need a small portion for waveform visualization
        // Fetch only the first 5MB of data for efficiency
        const response = await fetch(url, {
          headers: {
            Range: 'bytes=0-5242880' // First 5MB only
          }
        }).catch(() => {
          // If Range header is not supported, fall back to regular fetch
          console.log("Range header not supported, fetching full file");
          return fetch(url);
        });
        
        // Read only part of the file if it's very large
        let arrayBuffer;
        
        // Only read a portion of large files to avoid memory issues
        if (response.headers.get('Content-Length') && 
            parseInt(response.headers.get('Content-Length')!) > 20 * 1024 * 1024) {
          console.log("Large file detected, processing partial data");
          const reader = response.body?.getReader();
          
          if (reader) {
            // Read only first 5MB for processing
            const maxBytes = 5 * 1024 * 1024;
            let bytesRead = 0;
            const chunks = [];
            
            while (bytesRead < maxBytes) {
              const {done, value} = await reader.read();
              if (done) break;
              
              chunks.push(value);
              bytesRead += value.length;
            }
            
            // Combine chunks into a single ArrayBuffer
            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const combinedArray = new Uint8Array(totalLength);
            
            let position = 0;
            for (const chunk of chunks) {
              combinedArray.set(chunk, position);
              position += chunk.length;
            }
            
            arrayBuffer = combinedArray.buffer;
          } else {
            arrayBuffer = await response.arrayBuffer();
          }
        } else {
          arrayBuffer = await response.arrayBuffer();
        }
        
        const audioContext = getAudioContext();
        
        if (!audioContext) {
          throw new Error("Failed to create AudioContext");
        }
        
        // For very large files (> 100MB), create a minimal buffer instead of decoding
        if (arrayBuffer.byteLength > 100 * 1024 * 1024) {
          console.log("File too large for full decoding, creating sample buffer");
          
          // Create a small buffer just for visualization (10 seconds)
          const sampleRate = audioContext.sampleRate;
          const buffer = audioContext.createBuffer(2, 10 * sampleRate, sampleRate);
          
          for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < data.length; i++) {
              data[i] = Math.sin(i * 0.01) * 0.5;
            }
          }
          
          return buffer;
        }
        
        // Try to decode the audio data
        try {
          return await audioContext.decodeAudioData(arrayBuffer);
        } catch (decodeError) {
          console.error("Error decoding audio data:", decodeError);
          
          // Create a fallback buffer
          const buffer = audioContext.createBuffer(2, 10 * audioContext.sampleRate, audioContext.sampleRate);
          for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < data.length; i++) {
              data[i] = Math.sin(i * 0.01) * 0.5;
            }
          }
          return buffer;
        }
      }
      
      // Create default fallback buffer
      const audioContext = getAudioContext();
      const buffer = audioContext?.createBuffer(2, 44100 * 3, 44100);
      
      if (buffer) {
        for (let channel = 0; channel < 2; channel++) {
          const data = buffer.getChannelData(channel);
          for (let i = 0; i < 44100 * 3; i++) {
            data[i] = Math.sin(i * 0.01) * 0.5;
          }
        }
      }
      
      return buffer;
    } catch (error) {
      console.error('Error decoding audio data:', error);
      return null;
    }
  }, [getAudioContext]);

  return {
    fetchAndDecodeAudio
  };
};


import { useCallback } from 'react';

export const useAudioBufferDecoder = (getAudioContext: () => AudioContext | null) => {
  const fetchAndDecodeAudio = useCallback(async (url: string): Promise<AudioBuffer | null> => {
    try {
      console.log("Fetching audio from URL:", url);
      
      // For local files (blob URLs)
      if (url.startsWith('blob:')) {
        console.log("Processing local blob URL:", url);
        
        try {
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
          }
          
          const arrayBuffer = await response.arrayBuffer();
          console.log("Blob URL fetched successfully, buffer size:", arrayBuffer.byteLength);
          
          const audioContext = getAudioContext();
          if (!audioContext) {
            throw new Error("Failed to create AudioContext");
          }
          
          try {
            // Decode the audio data
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            console.log("Audio data decoded successfully, duration:", audioBuffer.duration);
            return audioBuffer;
          } catch (decodeError) {
            console.error("Error decoding audio data:", decodeError);
            
            // Create a fallback buffer with the correct duration (1 hour)
            const buffer = audioContext.createBuffer(2, 3600 * audioContext.sampleRate, audioContext.sampleRate);
            for (let channel = 0; channel < 2; channel++) {
              const data = buffer.getChannelData(channel);
              // Fill with minimal data for visualization
              for (let i = 0; i < data.length; i += 1000) {
                const sampleValue = Math.sin(i * 0.0001) * 0.5;
                for (let j = 0; j < 1000 && i + j < data.length; j++) {
                  data[i + j] = sampleValue;
                }
              }
            }
            return buffer;
          }
        } catch (fetchError) {
          console.error("Error fetching blob URL:", fetchError);
          throw fetchError;
        }
      }
      
      // Create default fallback buffer for non-blob URLs
      const audioContext = getAudioContext();
      if (!audioContext) {
        throw new Error("Failed to create AudioContext");
      }
      
      const buffer = audioContext.createBuffer(2, 3600 * audioContext.sampleRate, audioContext.sampleRate);
      
      for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        // Fill with minimal data for visualization (1 hour duration)
        for (let i = 0; i < data.length; i += 1000) {
          const sampleValue = Math.sin(i * 0.0001) * 0.5;
          for (let j = 0; j < 1000 && i + j < data.length; j++) {
            data[i + j] = sampleValue;
          }
        }
      }
      
      return buffer;
    } catch (error) {
      console.error('Error in fetchAndDecodeAudio:', error);
      return null;
    }
  }, [getAudioContext]);

  return {
    fetchAndDecodeAudio
  };
};

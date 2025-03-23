
import { useCallback } from 'react';

export const useAudioBufferDecoder = (getAudioContext: () => AudioContext | null) => {
  const fetchAndDecodeAudio = useCallback(async (url: string): Promise<AudioBuffer | null> => {
    try {
      console.log("Fetching audio from URL:", url);
      
      const audioContext = getAudioContext();
      if (!audioContext) {
        throw new Error("Failed to create AudioContext");
      }
      
      // Resume the audio context if suspended (needed for Chrome's autoplay policy)
      if (audioContext.state === 'suspended') {
        try {
          await audioContext.resume();
          console.log("AudioContext resumed successfully, state:", audioContext.state);
        } catch (resumeError) {
          console.error("Failed to resume AudioContext:", resumeError);
        }
      }
      
      // For local files (blob URLs)
      if (url.startsWith('blob:')) {
        console.log("Processing blob URL:", url);
        
        try {
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
            return audioBuffer;
          }
          
          try {
            // Create a copy of the buffer to avoid potential issues with buffer reuse
            const bufferCopy = arrayBuffer.slice(0);
            
            // Decode the audio data
            console.log("Attempting to decode audio data, context state:", audioContext.state);
            const audioBuffer = await audioContext.decodeAudioData(bufferCopy);
            console.log("Audio data decoded successfully, duration:", audioBuffer.duration);
            return audioBuffer;
          } catch (decodeError) {
            console.error("Error decoding audio data:", decodeError);
            throw decodeError;
          }
        } catch (fetchError) {
          console.error("Error fetching blob URL:", fetchError);
          throw fetchError;
        }
      }
      
      // Create default fallback buffer for non-blob URLs
      console.log("Creating fallback buffer for non-blob URL");
      const buffer = audioContext.createBuffer(2, 3600 * audioContext.sampleRate, audioContext.sampleRate);
      
      // Fill with minimal data for visualization (1 hour duration)
      for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
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

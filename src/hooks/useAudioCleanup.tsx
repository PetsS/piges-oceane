
import { MutableRefObject, useCallback } from 'react';

interface CleanupProps {
  animationRef: MutableRefObject<number | null>;
  sourceNodeRef: MutableRefObject<AudioBufferSourceNode | null>;
}

export const useAudioCleanup = (
  animationRef: MutableRefObject<number | null>,
  sourceNodeRef: MutableRefObject<AudioBufferSourceNode | null>
) => {
  const cleanup = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (sourceNodeRef.current) {
      try {
        // Check if the source node is currently playing
        sourceNodeRef.current.onended = null; // Remove ended handler to prevent errors
        
        // Only stop if not already stopped and if the context is in a valid state
        const state = sourceNodeRef.current.context.state;
        if (state !== 'closed') {
          try {
            sourceNodeRef.current.stop();
          } catch (stopError) {
            // Ignore "cannot stop already stopped node" errors
            console.log("Note: Audio source might already be stopped");
          }
          
          try {
            sourceNodeRef.current.disconnect();
          } catch (disconnectError) {
            console.log("Note: Audio source might already be disconnected");
          }
        }
        
        sourceNodeRef.current = null;
      } catch (error) {
        // Log the error but don't throw, to ensure cleanup continues
        console.error("Error during audio cleanup:", error);
      }
    }
  }, [animationRef, sourceNodeRef]);

  return { cleanup };
};

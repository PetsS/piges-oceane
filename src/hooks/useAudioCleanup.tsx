
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
    // Cancel any ongoing animation frame
    if (animationRef.current) {
      console.log("Canceling animation frame:", animationRef.current);
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    // Clean up audio source node if it exists
    if (sourceNodeRef.current) {
      console.log("Cleaning up source node");
      try {
        // Remove ended handler to prevent errors
        sourceNodeRef.current.onended = null;
        
        // Only stop if the context is in a valid state
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

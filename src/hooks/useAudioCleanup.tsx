
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
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      } catch (error) {
        console.error("Error stopping source node:", error);
      }
    }
  }, [animationRef, sourceNodeRef]);

  return { cleanup };
};

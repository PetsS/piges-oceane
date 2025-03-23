import { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { AudioMarker } from "@/hooks/useAudio";

interface WaveformProps {
  currentTime: number;
  duration: number;
  markers: AudioMarker[];
  onSeek: (time: number) => void;
  isPlaying: boolean;
}

export const Waveform = ({
  currentTime,
  duration,
  markers,
  onSeek,
  isPlaying,
}: WaveformProps) => {
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  
  // Generate random waveform data but only once when duration changes
  // For long files (1 hour), generate fewer points for better performance
  useEffect(() => {
    if (duration <= 0) return;
    
    // For long files (1 hour), reduce the number of data points further
    const pointCount = duration > 1800 ? 30 : 50;
    const data = Array.from({ length: pointCount }, () => Math.random() * 0.8 + 0.2);
    setWaveformData(data);
  }, [duration]);
  
  const startMarker = useMemo(() => 
    markers.find(marker => marker.type === 'start'),
  [markers]);
  
  const endMarker = useMemo(() => 
    markers.find(marker => marker.type === 'end'),
  [markers]);
  
  const handleWaveformClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const position = (e.clientX - rect.left) / rect.width;
    const seekTime = position * duration;
    
    onSeek(seekTime);
  }, [duration, onSeek]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const position = (e.clientX - rect.left) / rect.width;
    const time = position * duration;
    
    setHoverTime(time);
    
    if (isDragging) {
      onSeek(time);
    }
  }, [duration, isDragging, onSeek]);
  
  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    setHoverTime(null);
    setIsDragging(false);
  }, []);
  
  // Format time for display
  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  return (
    <div className="relative w-full h-32 glass-panel rounded-lg p-4 overflow-hidden">
      <div 
        className="relative w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleWaveformClick}
      >
        {/* Highlighted region between markers */}
        {startMarker && endMarker && (
          <div 
            className="absolute h-full bg-primary/20 z-10 pointer-events-none"
            style={{
              left: `${(startMarker.position / duration) * 100}%`,
              width: `${((endMarker.position - startMarker.position) / duration) * 100}%`
            }}
          />
        )}
        
        {/* Start marker */}
        {startMarker && (
          <div 
            className="marker-indicator start z-20"
            style={{ left: `${(startMarker.position / duration) * 100}%` }}
          />
        )}
        
        {/* End marker */}
        {endMarker && (
          <div 
            className="marker-indicator end z-20"
            style={{ left: `${(endMarker.position / duration) * 100}%` }}
          />
        )}
        
        {/* Current time indicator */}
        <div 
          className="absolute h-full w-0.5 bg-white shadow-md z-30 transition-all duration-100 ease-out pointer-events-none"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        />
        
        {/* Simplified waveform visualization with fewer bars for better performance with 1-hour files */}
        <div className="flex items-end h-full w-full gap-[4px]">
          {waveformData.map((value, index) => {
            const position = (index / waveformData.length) * duration;
            const isActive = position <= currentTime;
            const isInMarkedRegion = startMarker && endMarker && 
              position >= startMarker.position && 
              position <= endMarker.position;
              
            const height = `${value * 100}%`;
            
            return (
              <div 
                key={index}
                className={cn(
                  "waveform-bar flex-1",
                  isActive && "active",
                  isInMarkedRegion && "bg-primary/70",
                  isPlaying && isActive && (index % 2 === 0) && "animate-waveform"
                )}
                style={{ height }}
              />
            );
          })}
        </div>
        
        {/* Time tooltip on hover - only show when actually hovering */}
        {hoverTime !== null && (
          <div 
            className="absolute bottom-full mb-2 bg-black/80 text-white px-2 py-1 rounded text-xs transform -translate-x-1/2 pointer-events-none shadow-md"
            style={{ left: `${(hoverTime / duration) * 100}%` }}
          >
            {formatTime(hoverTime)}
          </div>
        )}
      </div>
    </div>
  );
};

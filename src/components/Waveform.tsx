
import { useState, useEffect, useMemo } from "react";
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
  
  // Generate random waveform data for visualization
  // In a real implementation, this would be actual audio data analysis
  useEffect(() => {
    if (duration <= 0) return;
    
    const data = Array.from({ length: 100 }, () => Math.random() * 0.8 + 0.2);
    setWaveformData(data);
  }, [duration]);
  
  const startMarker = useMemo(() => 
    markers.find(marker => marker.type === 'start'),
  [markers]);
  
  const endMarker = useMemo(() => 
    markers.find(marker => marker.type === 'end'),
  [markers]);
  
  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const position = (e.clientX - rect.left) / rect.width;
    const seekTime = position * duration;
    
    onSeek(seekTime);
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const position = (e.clientX - rect.left) / rect.width;
    const time = position * duration;
    
    setHoverTime(time);
    
    if (isDragging) {
      onSeek(time);
    }
  };
  
  const handleMouseDown = () => {
    setIsDragging(true);
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  const handleMouseLeave = () => {
    setHoverTime(null);
    setIsDragging(false);
  };
  
  // Format time for display
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-40 glass-panel rounded-lg p-4 overflow-hidden">
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
        
        {/* Waveform visualization */}
        <div className="flex items-end h-full w-full gap-[2px]">
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
                  isPlaying && isActive && "animate-waveform"
                )}
                style={{ 
                  height,
                  animationDelay: `${index * 0.01}s`
                }}
              />
            );
          })}
        </div>
        
        {/* Time tooltip on hover */}
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

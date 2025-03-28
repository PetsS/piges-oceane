
import { useState, useCallback, memo, useEffect, useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Play, 
  Pause, 
  Volume2, 
  Volume1, 
  VolumeX,
  Music,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  ArrowLeftToLine,
  ArrowRightToLine
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AudioMarker } from "@/hooks/useAudioTypes";
import { toast } from "sonner";
import { MarkerControls } from "./MarkerControls";

interface AudioPlayerProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onPlayPause: () => void;
  onVolumeChange: (value: number) => void;
  onSeek: (time: number) => void;
  formatTime: (time: number) => string;
  formatTimeDetailed?: (time: number) => string;
  audioTitle?: string;
  isLoading?: boolean;
  isBuffering?: boolean;
  markers?: AudioMarker[];
  onAddMarker?: (type: 'start' | 'end', time: number) => void;
  onExport?: () => void;
  isExporting?: boolean;
  exportProgress?: number;
}

export const AudioPlayer = memo(({
  isPlaying,
  currentTime,
  duration,
  volume,
  onPlayPause,
  onVolumeChange,
  onSeek,
  formatTime,
  formatTimeDetailed = formatTime,
  audioTitle = "Aucun audio chargé",
  isLoading = false,
  isBuffering = false,
  markers = [],
  onAddMarker,
  onExport,
  isExporting = false,
  exportProgress = 0,
}: AudioPlayerProps) => {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [playbackEnabled, setPlaybackEnabled] = useState(false);
  const [showMarkerControls, setShowMarkerControls] = useState(false);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  
  const playbackPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  const startMarker = markers.find(marker => marker.type === 'start');
  const endMarker = markers.find(marker => marker.type === 'end');
  
  const canExport = startMarker && endMarker && startMarker.position < endMarker.position;
  
  useEffect(() => {
    if (duration > 0 && !isLoading) {
      setPlaybackEnabled(true);
    } else {
      setPlaybackEnabled(false);
    }
  }, [duration, isLoading]);
  
  const handleSkipBack = useCallback(() => {
    onSeek(Math.max(0, currentTime - 10));
  }, [currentTime, onSeek]);
  
  const handleSkipForward = useCallback(() => {
    onSeek(Math.min(duration, currentTime + 10));
  }, [currentTime, duration, onSeek]);
  
  const handleVolumeIconClick = useCallback(() => {
    setShowVolumeSlider(prev => !prev);
  }, []);
  
  const getVolumeIcon = useCallback(() => {
    if (volume === 0) return <VolumeX className="h-5 w-5" />;
    if (volume < 0.5) return <Volume1 className="h-5 w-5" />;
    return <Volume2 className="h-5 w-5" />;
  }, [volume]);

  const handlePlayPause = useCallback(() => {
    try {
      console.log("Play/pause button clicked");
      
      if (playButtonRef.current) {
        playButtonRef.current.focus();
      }
      
      onPlayPause();
      
      setTimeout(() => playButtonRef.current?.blur(), 100);
    } catch (error) {
      console.error("Error in play/pause handler:", error);
    }
  }, [onPlayPause]);

  const handleAddMarker = useCallback((type: 'start' | 'end') => {
    if (onAddMarker) {
      onAddMarker(type, currentTime);
    }
  }, [onAddMarker, currentTime]);

  const toggleMarkerControls = useCallback(() => {
    setShowMarkerControls(prev => !prev);
  }, []);

  return (
    <div className="glass-panel rounded-lg p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mr-3">
            <Music className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium truncate max-w-[200px]">
              {isLoading ? "Chargement..." : audioTitle}
            </h3>
            <p className="text-xs text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(duration)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full"
              onClick={handleVolumeIconClick}
            >
              {getVolumeIcon()}
            </Button>
            
            {showVolumeSlider && (
              <div className="absolute -left-8 bottom-12 bg-background/90 backdrop-blur-sm p-3 rounded-md shadow-md border flex items-center w-24 transition-all duration-300 animate-fade-in">
                <Slider
                  value={[volume * 100]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(value) => onVolumeChange(value[0] / 100)}
                  className="w-full"
                />
              </div>
            )}
          </div>
          
          {duration > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleMarkerControls}
              className={showMarkerControls ? "bg-primary/10" : ""}
            >
              {showMarkerControls ? "Masquer marqueurs" : "Afficher marqueurs"}
            </Button>
          )}
        </div>
      </div>
      
      <div className="flex flex-col space-y-4">
        <div className="space-y-1.5">
          <Slider
            value={[playbackPercentage]}
            min={0}
            max={100}
            step={0.1}
            onValueChange={(value) => onSeek((value[0] / 100) * duration)}
            disabled={!playbackEnabled || isLoading}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-10 w-10"
            onClick={handleSkipBack}
            disabled={!playbackEnabled || isLoading || isBuffering}
          >
            <ChevronsLeft className="h-5 w-5" />
          </Button>
          
          <Button
            ref={playButtonRef}
            variant="default"
            size="icon"
            className="rounded-full h-14 w-14 transition-all hover:scale-105 active:scale-95"
            onClick={handlePlayPause}
            disabled={!playbackEnabled || isLoading}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isBuffering ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6 ml-1" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-10 w-10"
            onClick={handleSkipForward}
            disabled={!playbackEnabled || isLoading || isBuffering}
          >
            <ChevronsRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {showMarkerControls && (
        <div className="mt-6 space-y-4 border-t pt-4">
          <MarkerControls 
            markers={markers}
            onAddMarker={handleAddMarker}
            onExport={onExport}
            currentTime={currentTime}
            formatTimeDetailed={formatTimeDetailed}
            isExporting={isExporting}
            exportProgress={exportProgress}
          />
        </div>
      )}
    </div>
  );
});

AudioPlayer.displayName = "AudioPlayer";

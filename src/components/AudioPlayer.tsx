
import { useState, useCallback, memo, useEffect, useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { AudioMarker } from "@/hooks/useAudio";
import { parseTimeString } from "@/utils/timeParser";
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
  Pencil
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";


interface AudioPlayerProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onPlayPause: () => void;
  onVolumeChange: (value: number) => void;
  onSeek: (time: number) => void;
  formatTime: (time: number) => string;
  audioTitle?: string;
  isLoading?: boolean;
  isBuffering?: boolean;
  markers?: AudioMarker[];
  audioRef: React.RefObject<HTMLAudioElement>;
}

// Use memo to prevent unnecessary re-renders
export const AudioPlayer = memo(({
  isPlaying,
  currentTime,
  duration,
  volume,
  onPlayPause,
  onVolumeChange,
  onSeek,
  formatTime,
  audioTitle = "Aucun audio chargé",
  isLoading = false,
  isBuffering = false,
  markers = [],
  audioRef,
}: AudioPlayerProps) => {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [playbackEnabled, setPlaybackEnabled] = useState(false);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  
  const playbackPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  // State to manage editing time display
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editableTime, setEditableTime] = useState(formatTime(currentTime));

  // Find IN and OUT markers
  const inMarker = markers.find(m => m.type === "start");
  const outMarker = markers.find(m => m.type === "end");

  // Calculate percentages for IN and OUT markers
  const inPercent = inMarker ? (inMarker.position / duration) * 100 : 0;
  const outPercent = outMarker ? (outMarker.position / duration) * 100 : 0;
  
  // Enable playback controls once audio is loaded
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

  // Handle play/pause with improved error handling
  const handlePlayPause = useCallback(() => {
    try {
      console.log("Play/pause button clicked");
      
      // Focus the button to trigger any potential user interaction handlers
      if (playButtonRef.current) {
        playButtonRef.current.focus();
      }
      
      // Call the provided play/pause handler
      onPlayPause();
      
      // Add visual feedback
      setTimeout(() => playButtonRef.current?.blur(), 100);
    } catch (error) {
      console.error("Error in play/pause handler:", error);
    }
  }, [onPlayPause]);

  // Handle playback from the IN marker and stop at OUT or end
  const handlePlayFromSelection = useCallback(() => {
    if (!audioRef.current) return;
  
    const startMarker = markers.find((m) => m.type === "start");
    const endMarker = markers.find((m) => m.type === "end");
  
    if (!startMarker) return;
  
    const startTime = startMarker.position;
    const stopTime = endMarker ? endMarker.position : duration;
  
    if (startTime >= stopTime) return;
  
    const audioEl = audioRef.current;
  
    audioEl.currentTime = startTime;
    audioEl.play().catch(console.error);
  
    const stopListener = () => {
      if (audioEl.currentTime >= stopTime) {
        audioEl.pause();
        audioEl.removeEventListener("timeupdate", stopListener);
      }
    };
  
    audioEl.addEventListener("timeupdate", stopListener);
  }, [audioRef, markers, duration]);

  return (
    <div className="glass-panel rounded-lg p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mr-3">
            <Music className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium truncate">
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
              <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-background/90 backdrop-blur-sm p-3 rounded-md shadow-md border flex items-center w-24">
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
        </div>
      </div>
      
      <div className="flex flex-col space-y-4">
        <div className="space-y-1.5">
          <div className="relative w-full">
            {/* Slider */}
            <Slider
              value={[playbackPercentage]}
              min={0}
              max={100}
              step={0.1}
              onValueChange={(value) => onSeek((value[0] / 100) * duration)}
              disabled={!playbackEnabled || isLoading}
              className="relative z-10"
            />

            {/* Horizontal line under the slider between IN and OUT */}
            {inMarker && outMarker && inPercent < outPercent && (
              <div
                className="absolute h-1 bg-green-500 rounded bottom-0"
                style={{
                  left: `${inPercent}%`,
                  width: `${outPercent - inPercent}%`,
                  transform: "translateY(4px)", // push line below slider (adjust as needed)
                  pointerEvents: "none",
                  zIndex: 0,
                }}
              />
            )}

            {/* IN marker line */}
            {inMarker && (
              <div
                className="absolute w-[2px] h-4 bg-green-700 bottom-0"
                style={{
                  left: `${inPercent}%`,
                  transform: "translate(-50%, 4px)", // center horizontally, push down vertically
                  pointerEvents: "none",
                  zIndex: 5,
                  borderRadius: "1px",
                }}
              />
            )}

            {/* OUT marker line */}
            {outMarker && (
              <div
                className="absolute w-[2px] h-4 bg-red-700 bottom-0"
                style={{
                  left: `${outPercent}%`,
                  transform: "translate(-50%, 4px)",
                  pointerEvents: "none",
                  zIndex: 5,
                  borderRadius: "1px",
                }}
              />
            )}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            {isEditingTime ? (
              <input
                type="text"
                value={editableTime}
                onChange={(e) => setEditableTime(e.target.value)}
                onBlur={() => {
                  const time = parseTimeString(editableTime);
                  if (!isNaN(time)) {
                    onSeek(Math.min(Math.max(0, time), duration));
                  }
                  setIsEditingTime(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
                autoFocus
                className="w-16 bg-transparent border-b border-muted outline-none text-muted-foreground text-xs"
              />
            ) : (
              <span
                onClick={() => {
                  setEditableTime(formatTime(currentTime));
                  setIsEditingTime(true);
                }}
                className="cursor-text flex items-center gap-2 hover:text-foreground/80 hover:underline cursor-pointer"
              >
                {formatTime(currentTime)}
                <Pencil className="w-3 h-3 text-muted-foreground" />
              </span>
            )}
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-2 sm:flex-nowrap">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-10 w-10"
            onClick={handleSkipBack}
            disabled={!playbackEnabled || isLoading || isBuffering}
          >
            <ChevronsLeft className="h-5 w-5" />
          </Button>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{isPlaying ? "Mettre en pause" : "Lire depuis la position actuelle"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-10 w-10"
            onClick={handleSkipForward}
            disabled={!playbackEnabled || isLoading || isBuffering}
          >
            <ChevronsRight className="h-5 w-5" />
          </Button>

          {markers.some((m) => m.type === "start") && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto inline-flex items-center space-x-2 px-5 py-2 bg-green-50 border-green-200 hover:bg-green-100 transition-all hover:scale-105 active:scale-95 rounded-full animate-fade-in"
                    onClick={handlePlayFromSelection}
                    disabled={!playbackEnabled || isLoading}
                    aria-label="Lecture depuis le marqueur"
                  >
                    <Play className="text-green-500 h-6 w-6 ml-1" />
                    <span>Jouer la sélection</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>
                    Lire depuis la sélection
                    {markers.some((m) => m.type === "end") && " jusqu’au marqueur OUT"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          
        </div>
      </div>
    </div>
  );
});

AudioPlayer.displayName = "AudioPlayer";

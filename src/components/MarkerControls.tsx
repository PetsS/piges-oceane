
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { AudioMarker } from "@/hooks/useAudio";
import { ArrowLeftToLine, ArrowRightToLine, Scissors } from "lucide-react";

interface MarkerControlsProps {
  markers: AudioMarker[];
  onAddMarker: (type: "start" | "end") => void;
  onExport: () => void;
  currentTime: number;
  formatTimeDetailed: (time: number) => string;
}

export const MarkerControls = ({
  markers,
  onAddMarker,
  onExport,
  currentTime,
  formatTimeDetailed,
}: MarkerControlsProps) => {
  const startMarker = markers.find((marker) => marker.type === "start");
  const endMarker = markers.find((marker) => marker.type === "end");

  const canExport =
    (startMarker || endMarker) &&
    (!startMarker || !endMarker || startMarker.position < endMarker.position);

  return (
    <div className="flex flex-col glass-panel rounded-lg p-4 space-y-4 animate-fade-in">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Markers</h3>
        <Badge variant="secondary" className="font-mono text-xs">
          {formatTimeDetailed(currentTime)}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className={`flex items-center justify-center space-x-2 group ${
                  startMarker
                    ? "bg-green-50 border-green-200 hover:bg-green-100"
                    : ""
                }`}
                onClick={() => onAddMarker("start")}
              >
                <ArrowLeftToLine
                  className={`h-4 w-4 mr-2 ${
                    startMarker ? "text-green-500" : "text-foreground"
                  } group-hover:scale-110 transition-transform`}
                />
                <span>Start Marker</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Set the start position for trimming</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className={`flex items-center justify-center space-x-2 group ${
                  endMarker
                    ? "bg-red-50 border-red-200 hover:bg-red-100"
                    : ""
                }`}
                onClick={() => onAddMarker("end")}
              >
                <ArrowRightToLine
                  className={`h-4 w-4 mr-2 ${
                    endMarker ? "text-red-500" : "text-foreground"
                  } group-hover:scale-110 transition-transform`}
                />
                <span>End Marker</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Set the end position for trimming</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="space-y-3">
        {startMarker && (
          <div className="flex justify-between items-center p-3 rounded-md bg-green-50 border border-green-100 animate-scale-in">
            <div>
              <div className="text-sm font-medium flex items-center">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                Start Marker
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {formatTimeDetailed(startMarker.position)}
              </div>
            </div>
          </div>
        )}

        {endMarker && (
          <div className="flex justify-between items-center p-3 rounded-md bg-red-50 border border-red-100 animate-scale-in">
            <div>
              <div className="text-sm font-medium flex items-center">
                <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                End Marker
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {formatTimeDetailed(endMarker.position)}
              </div>
            </div>
          </div>
        )}

        {startMarker && endMarker && (
          <div className="flex justify-between items-center p-3 rounded-md bg-blue-50 border border-blue-100 animate-scale-in">
            <div>
              <div className="text-sm font-medium">Duration</div>
              <div className="text-xs text-muted-foreground font-mono">
                {formatTimeDetailed(
                  endMarker.position - startMarker.position
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <Button
        disabled={!canExport}
        onClick={onExport}
        className="w-full mt-auto transition-all duration-300 hover:shadow-md hover:translate-y-[-1px]"
      >
        <Scissors className="h-4 w-4 mr-2" />
        Export Trimmed Audio
      </Button>
    </div>
  );
};

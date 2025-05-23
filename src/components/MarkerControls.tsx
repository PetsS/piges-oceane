
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"; // Adjust import path if needed
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { AudioMarker } from "@/hooks/useAudio";
import { ArrowLeftToLine, ArrowRightToLine, Delete, DeleteIcon, EraserIcon, Scissors, Trash2Icon } from "lucide-react";
import { AudioExporter } from "./AudioExporter";

interface MarkerControlsProps {
  markers: AudioMarker[];
  onAddMarker: (type: "start" | "end") => void;
  onExport: () => void;
  onResetMarkers: () => void;
  currentTime: number;
  formatTimeDetailed: (time: number) => string;
  isExporting?: boolean;
}

export const MarkerControls = ({
  markers,
  onAddMarker,
  onExport,
  onResetMarkers,
  currentTime,
  formatTimeDetailed,
  isExporting = false,
}: MarkerControlsProps) => {
  const startMarker = markers.find((marker) => marker.type === "start");
  const endMarker = markers.find((marker) => marker.type === "end");

  const canExport =
    (startMarker || endMarker) &&
    (!startMarker || !endMarker || startMarker.position < endMarker.position);

  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const handleConfirmReset = () => {
    onResetMarkers();     // Perform actual reset
    setShowConfirmReset(false); // Close modal
  };
    
  return (
    <div className="flex flex-col glass-panel rounded-lg p-4 space-y-4 animate-fade-in">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Marqueurs</h3>
        <Badge variant="secondary" className="font-mono text-xs">
          {formatTimeDetailed(currentTime)}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className={`flex-grow sm:flex-grow-1 sm:w-full md:w-auto flex items-center justify-center space-x-2 group ${
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
                <span>Marqueur début</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Définir le point de départ pour le découpage</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className={`flex-grow sm:flex-grow-1 sm:w-full md:w-auto flex items-center justify-center space-x-2 group ${
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
                <span>Marqueur fin</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Définir le point de fin pour le découpage</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive hover:bg-red-100 sm:ml-auto"
                onClick={() => {
                  if (markers.length > 0) {
                    setShowConfirmReset(true);
                  }
                }}
                disabled={markers.length === 0}
              >
                <Trash2Icon/>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Effacer les marqueurs</p>
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
                Marqueur début
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
                Marqueur fin
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {formatTimeDetailed(endMarker.position)}
              </div>
            </div>
          </div>
        )}

        <Dialog open={showConfirmReset} onOpenChange={setShowConfirmReset}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmer l'effacement des marqueurs</DialogTitle>
              <DialogDescription>
                Êtes-vous sûr de vouloir effacer tous les marqueurs ?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirmReset(false)}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={handleConfirmReset}>
                Effacer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AudioExporter 
          markers={markers}
          onExport={onExport}
          isExporting={isExporting}
          formatTimeDetailed={formatTimeDetailed}
          canExport={canExport}
        />
      </div>
    </div>
  );
};

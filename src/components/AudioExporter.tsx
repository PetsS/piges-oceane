
import { Button } from "@/components/ui/button";
import { Scissors, FileDown, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AudioMarker } from "@/hooks/useAudio";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from "react";

interface AudioExporterProps {
  markers: AudioMarker[];
  onExport: () => void;
  isExporting: boolean;
  formatTimeDetailed: (time: number) => string;
  canExport: boolean;
}

export const AudioExporter = ({
  markers,
  onExport,
  isExporting,
  formatTimeDetailed,
  canExport,
}: AudioExporterProps) => {
  const startMarker = markers.find((marker) => marker.type === "start");
  const endMarker = markers.find((marker) => marker.type === "end");
  const [progress, setProgress] = useState(0);

  // Simulate progress when exporting
  useEffect(() => {
    if (isExporting) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((prev) => {
          const newValue = prev + (2 + Math.random() * 3);
          return newValue < 95 ? newValue : 95;
        });
      }, 200);
      
      return () => {
        clearInterval(interval);
        // When finished, set to 100%
        setTimeout(() => setProgress(100), 300);
        // Then reset after a delay
        setTimeout(() => setProgress(0), 1000);
      };
    }
  }, [isExporting]);

  return (
    <div className="space-y-3">
      {startMarker && endMarker && (
        <div className="flex justify-between items-center p-3 rounded-md bg-blue-50 border border-blue-100 animate-scale-in">
          <div>
            <div className="text-sm font-medium">Durée</div>
            <div className="text-xs text-muted-foreground font-mono">
              {formatTimeDetailed(
                endMarker.position - startMarker.position
              )}
            </div>
          </div>
          <div>
            <Badge variant="outline" className="text-xs">
              MP3
            </Badge>
          </div>
        </div>
      )}

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="space-y-2">
              <Button
                disabled={!canExport || isExporting}
                onClick={onExport}
                className="w-full transition-all duration-300 hover:shadow-md hover:translate-y-[-1px]"
              >
                {isExporting ? (
                  <Scissors className="h-4 w-4 mr-2 animate-pulse" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {isExporting ? "Traitement en cours..." : "Exporter l'audio"}
                {isExporting && (
                  <Badge variant="outline" className="ml-2 animate-pulse">
                    Patientez...
                  </Badge>
                )}
              </Button>
              
              {isExporting && (
                <Progress value={progress} className="h-2 w-full" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>
              {!canExport
                ? "Définissez les marqueurs de début et de fin"
                : "Découper et exporter la section audio sélectionnée (MP3)"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

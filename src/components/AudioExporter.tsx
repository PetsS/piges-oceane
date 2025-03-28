
import { Button } from "@/components/ui/button";
import { Scissors, FileDown } from "lucide-react";
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
  exportProgress?: number;
  exportError?: string | null;
}

export const AudioExporter = ({
  markers,
  onExport,
  isExporting,
  formatTimeDetailed,
  canExport,
  exportProgress = 0,
  exportError = null,
}: AudioExporterProps) => {
  const startMarker = markers.find((marker) => marker.type === "start");
  const endMarker = markers.find((marker) => marker.type === "end");
  
  const [showRetry, setShowRetry] = useState(false);
  
  // Reset retry button when export is successful or starts again
  useEffect(() => {
    if (!isExporting && !exportError) {
      setShowRetry(false);
    } else if (!isExporting && exportError) {
      setShowRetry(true);
    }
  }, [isExporting, exportError]);

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
                disabled={!canExport || (isExporting && !showRetry)}
                onClick={onExport}
                className={`w-full transition-all duration-300 hover:shadow-md hover:translate-y-[-1px] ${exportError ? 'bg-red-500 hover:bg-red-600' : ''}`}
              >
                {isExporting ? (
                  <Scissors className="h-4 w-4 mr-2 animate-pulse" />
                ) : exportError ? (
                  <FileDown className="h-4 w-4 mr-2" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                {isExporting 
                  ? `Traitement en cours... ${Math.round(exportProgress)}%` 
                  : exportError 
                    ? "Réessayer l'export" 
                    : "Exporter l'audio"}
                
                {isExporting && (
                  <Badge variant="outline" className="ml-2 animate-pulse">
                    Patientez...
                  </Badge>
                )}
              </Button>
              
              {isExporting && (
                <Progress value={exportProgress} className="h-2 w-full" />
              )}
              
              {exportError && !isExporting && (
                <div className="text-xs text-red-500 mt-1">
                  Erreur: {exportError}
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>
              {!canExport
                ? "Définissez les marqueurs de début et de fin"
                : exportError
                ? "Une erreur s'est produite. Cliquez pour réessayer."
                : "Découper et exporter la section audio sélectionnée (format MP3)"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

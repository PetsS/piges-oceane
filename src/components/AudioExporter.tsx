
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AudioMarker } from "@/hooks/useAudioTypes";
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
  
  // Add a display message for the export process
  const [exportMessage, setExportMessage] = useState("Export en cours...");
  
  // Update the export message based on progress
  useEffect(() => {
    if (isExporting) {
      if (exportProgress < 20) {
        setExportMessage("Préparation de l'export...");
      } else if (exportProgress < 50) {
        setExportMessage("Traitement audio...");
      } else if (exportProgress < 90) {
        setExportMessage("Finalisation...");
      } else {
        setExportMessage("Téléchargement...");
      }
    }
  }, [exportProgress, isExporting]);

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
              Format original
            </Badge>
          </div>
        </div>
      )}

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button
                onClick={onExport}
                disabled={!canExport || isExporting}
                className="w-full"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {exportMessage}
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4 mr-2" />
                    Exporter la sélection
                  </>
                )}
              </Button>
              
              {isExporting && exportProgress > 0 && (
                <Progress 
                  value={exportProgress} 
                  className="h-2 mt-2" 
                  indicatorClassName="bg-primary"
                />
              )}
              
              {exportError && (
                <div className="text-xs text-destructive mt-1">
                  {exportError}
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Exporter la sélection au format original</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

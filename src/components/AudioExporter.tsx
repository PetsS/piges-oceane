
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AudioMarker } from "@/hooks/useAudio";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

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
            <div>
              <Button
                onClick={onExport}
                disabled={!canExport || isExporting}
                className="w-full"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Export en cours...
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
            <p>Exporter la sélection en fichier MP3</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

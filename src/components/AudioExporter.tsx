
import { Button } from "@/components/ui/button";
import { Scissors } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AudioMarker } from "@/hooks/useAudio";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AudioExporterProps {
  markers: AudioMarker[];
  onExport: () => void;
  isExporting: boolean;
  formatTimeDetailed: (time: number) => string;
  canExport: boolean;
  exportFormat?: string;
}

export const AudioExporter = ({
  markers,
  onExport,
  isExporting,
  formatTimeDetailed,
  canExport,
  exportFormat = "mp3-128",
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
              {exportFormat === "wav" ? "WAV" : `MP3 ${exportFormat.split('-')[1]}kbps`}
            </Badge>
          </div>
        </div>
      )}

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button
                disabled={!canExport || isExporting}
                onClick={onExport}
                className="w-full transition-all duration-300 hover:shadow-md hover:translate-y-[-1px]"
              >
                <Scissors className="h-4 w-4 mr-2" />
                {isExporting ? "Traitement en cours..." : "Exporter l'audio"}
                {isExporting && (
                  <Badge variant="outline" className="ml-2 animate-pulse">
                    Patientez...
                  </Badge>
                )}
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>
              {!canExport
                ? "Définissez les marqueurs de début et de fin"
                : `Découper et exporter la section audio sélectionnée (${exportFormat === "wav" ? "WAV" : `MP3 ${exportFormat.split('-')[1]}kbps`})`}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

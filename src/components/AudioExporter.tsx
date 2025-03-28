
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
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
  exportProgress?: number;
  exportError?: string | null;
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
                disabled={true}
                className="w-full opacity-50 cursor-not-allowed"
              >
                <FileDown className="h-4 w-4 mr-2" />
                Export désactivé
                <Badge variant="outline" className="ml-2">
                  Indisponible
                </Badge>
              </Button>
              <div className="text-xs text-amber-700 mt-1">
                La fonctionnalité d'export a été désactivée
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>La fonctionnalité d'export a été temporairement désactivée</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

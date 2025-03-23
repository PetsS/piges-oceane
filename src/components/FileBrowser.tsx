
import { useState } from "react";
import { AudioFile } from "@/hooks/useAudio";
import { cn } from "@/lib/utils";
import { Calendar, Folder, Search, Clock, FileAudio } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { DatePicker } from "@/components/DatePicker";

interface FileBrowserProps {
  files: AudioFile[];
  onFileSelect: (file: AudioFile) => void;
  isLoading: boolean;
  onPathChange: (path: string, date: Date, hour: string | null) => void;
}

export const FileBrowser = ({
  files,
  onFileSelect,
  isLoading,
  onPathChange,
}: FileBrowserProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedHour, setSelectedHour] = useState<string | null>(null);

  const handleSearch = () => {
    if (!selectedDate) return;
    
    // Format date as YYYY-MM-DD for folder structure
    const dateFolder = format(selectedDate, "yyyy-MM-dd");
    
    // Generate path using the base path, date folder, and optionally the hour file
    const basePath = "\\\\server\\audioLogs";
    const fullPath = `${basePath}\\${dateFolder}${selectedHour ? `\\${selectedHour}.mp3` : ''}`;
    
    onPathChange(fullPath, selectedDate, selectedHour);
  };

  const hours = Array.from({ length: 24 }, (_, i) => 
    i.toString().padStart(2, '0')
  );

  return (
    <div className="w-full flex flex-col h-full glass-panel rounded-lg overflow-hidden animate-fade-in">
      <div className="p-4 bg-secondary/50 backdrop-blur-md border-b">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Sélectionner une date</span>
            </label>
            <DatePicker
              date={selectedDate}
              onSelect={setSelectedDate}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Sélectionner une heure</span>
            </label>
            <div className="grid grid-cols-6 gap-1.5">
              {hours.map((hour) => (
                <Button
                  key={hour}
                  variant={selectedHour === hour ? "default" : "outline"}
                  className={cn(
                    "h-9 px-2 text-xs",
                    selectedHour === hour 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-secondary/80"
                  )}
                  onClick={() => setSelectedHour(selectedHour === hour ? null : hour)}
                >
                  {hour}:00
                </Button>
              ))}
            </div>
          </div>
          
          <Button 
            className="w-full mt-2 transition-all duration-300 hover:shadow-md hover:translate-y-[-1px]"
            onClick={handleSearch}
            disabled={!selectedDate}
          >
            <Search className="h-4 w-4 mr-2" />
            Rechercher les fichiers audio
          </Button>
        </div>
      </div>
      
      <Separator />
      
      <div className="flex-1 overflow-y-auto p-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin"></div>
              </div>
              <p className="text-sm text-muted-foreground">Recherche de fichiers audio...</p>
            </div>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <FileAudio className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-lg font-medium text-foreground/80">Aucun fichier audio trouvé</p>
            <p className="text-sm text-muted-foreground mt-1">
              Essayez une date ou une heure différente
            </p>
          </div>
        ) : (
          <div className="space-y-1 p-1">
            {files.map((file) => (
              <button
                key={file.path}
                onClick={() => onFileSelect(file)}
                className={cn(
                  "w-full text-left flex items-center p-3 rounded-md transition-all",
                  "hover:bg-secondary/80 focus:outline-none focus:bg-secondary/80",
                  "active:scale-[0.98] hover:shadow-sm"
                )}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mr-3">
                  <FileAudio className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="font-medium truncate">{file.name}</div>
                  <div className="flex text-xs text-muted-foreground space-x-2">
                    <span>{file.size}</span>
                    <span>•</span>
                    <span>{file.type.split("/")[1]}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{file.lastModified}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

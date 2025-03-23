
import { useState } from "react";
import { AudioFile } from "@/hooks/useAudio";
import { cn } from "@/lib/utils";
import { Folder, Music, Clock, FileAudio } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface FileBrowserProps {
  files: AudioFile[];
  onFileSelect: (file: AudioFile) => void;
  isLoading: boolean;
  onPathChange: (path: string) => void;
}

export const FileBrowser = ({
  files,
  onFileSelect,
  isLoading,
  onPathChange,
}: FileBrowserProps) => {
  const [path, setPath] = useState("\\\\server\\music");
  const [filter, setFilter] = useState("");

  const handlePathChange = () => {
    onPathChange(path);
  };

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col h-full glass-panel rounded-lg overflow-hidden animate-fade-in">
      <div className="p-4 bg-secondary/50 backdrop-blur-md border-b">
        <h3 className="text-lg font-medium mb-4">Audio Library</h3>
        
        <div className="flex space-x-2 mb-4">
          <div className="relative flex-1">
            <Input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="pl-9 bg-white/50 border-0 focus-visible:ring-1"
              placeholder="UNC Path"
            />
            <Folder className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
          <Button 
            onClick={handlePathChange} 
            className="transition-all duration-300 hover:shadow-md hover:translate-y-[-1px]"
          >
            Connect
          </Button>
        </div>
        
        <div className="relative">
          <Input
            placeholder="Filter files..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9 bg-white/50 border-0 focus-visible:ring-1"
          />
          <FileAudio className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
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
              <p className="text-sm text-muted-foreground">Loading files...</p>
            </div>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <Music className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-lg font-medium text-foreground/80">No audio files found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {filter ? "Try a different filter" : "Connect to a different UNC path"}
            </p>
          </div>
        ) : (
          <div className="space-y-1 p-1">
            {filteredFiles.map((file) => (
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
                  <Music className="h-5 w-5 text-primary" />
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

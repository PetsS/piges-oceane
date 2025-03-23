
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, File } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AudioFile } from "@/hooks/useAudio";

interface LocalAudioLoaderProps {
  onFileLoad: (file: AudioFile) => void;
}

export const LocalAudioLoader = ({ onFileLoad }: LocalAudioLoaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileSelection = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    
    const file = fileList[0];
    
    // Check if it's an audio file
    if (!file.type.startsWith('audio/')) {
      toast.error("Please select an audio file");
      return;
    }
    
    // Convert to MB with 1 decimal place
    const size = (file.size / (1024 * 1024)).toFixed(1);
    
    // Create a blob URL for the file
    const blobUrl = URL.createObjectURL(file);
    
    const audioFile: AudioFile = {
      name: file.name,
      path: blobUrl,
      size: `${size} MB`,
      type: file.type,
      lastModified: format(new Date(file.lastModified), 'yyyy-MM-dd')
    };
    
    onFileLoad(audioFile);
    toast.success(`Loaded: ${file.name}`);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelection(e.dataTransfer.files);
  };
  
  const handleClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelection(e.target.files);
  };

  return (
    <div className="glass-panel rounded-lg p-4 animate-fade-in">
      <h3 className="text-lg font-medium mb-4">Fichiers locaux</h3>
      
      <div 
        className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition-all ${
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input 
          type="file" 
          className="hidden" 
          ref={fileInputRef} 
          accept="audio/*" 
          onChange={handleFileInput}
        />
        
        <Upload className={`h-8 w-8 mb-2 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
        
        <h4 className="text-sm font-medium">
          {isDragging ? "Déposez le fichier ici" : "Glissez un fichier audio ou cliquez pour parcourir"}
        </h4>
        
        <p className="text-xs text-muted-foreground mt-1">
          Supporte les fichiers MP3, WAV, OGG
        </p>
      </div>
      
      <div className="mt-4 flex justify-center">
        <Button variant="outline" onClick={handleClick} className="text-sm">
          <File className="h-4 w-4 mr-2" />
          Parcourir les fichiers
        </Button>
      </div>
    </div>
  );
};

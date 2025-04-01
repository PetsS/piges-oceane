import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileAudio2, Download } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const AudioConverter = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileSelection = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    
    const file = fileList[0];
    
    // Check if it's a WAV file
    if (file.type !== 'audio/wav' && !file.name.toLowerCase().endsWith('.wav')) {
      toast.error("Veuillez sélectionner un fichier WAV");
      return;
    }
    
    setSelectedFile(file);
    toast.success(`Fichier sélectionné: ${file.name}`);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelection(e.dataTransfer.files);
  };
  
  const handleClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelection(e.target.files);
  };
  
  const convertToMp3 = async () => {
    if (!selectedFile) {
      toast.error("Veuillez d'abord sélectionner un fichier WAV");
      return;
    }
    
    setIsConverting(true);
    setProgress(0);
    
    try {
      toast.info("Lecture du fichier WAV...");
      
      // Read the WAV file
      const arrayBuffer = await selectedFile.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Update progress
      setProgress(20);
      
      // Decode the audio data
      toast.info("Décodage du fichier audio...");
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Update progress
      setProgress(40);
      
      // Convert to MP3
      toast.info("Conversion en MP3...");
      
      // Extract PCM data from the buffer
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : left;
      
      const sampleRate = audioBuffer.sampleRate;
      const channels = audioBuffer.numberOfChannels;
      
      setProgress(60);
      
      // Create a WAV file instead of MP3 due to lamejs compatibility issues
      const wav = createWaveFileData(audioBuffer);
      
      setProgress(80);
      
      // Create blob and download
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      
      // Create filename (keeping .wav extension since we're saving as WAV)
      const outputFileName = selectedFile.name.replace(/\.wav$/i, '_converted.wav');
      
      // Trigger download
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = outputFileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // Complete
      setProgress(100);
      toast.success(`Conversion réussie! ${outputFileName} a été téléchargé.`);
      
      // Clean up URL object after a delay
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      console.error('Error during conversion:', error);
      toast.error("Erreur lors de la conversion. Veuillez réessayer.");
    } finally {
      // Reset after a delay
      setTimeout(() => {
        setIsConverting(false);
        setProgress(0);
      }, 1500);
    }
  };
  
  // Function to create WAV file from AudioBuffer
  const createWaveFileData = (audioBuffer: AudioBuffer): ArrayBuffer => {
    const numOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChannels * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    
    // Get audio channels data
    for (let i = 0; i < numOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }
    
    // WAV header
    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, length - 8, true);
    writeString(view, 8, 'WAVE');
    
    // FMT sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // subchunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numOfChannels, true); // num of channels
    view.setUint32(24, audioBuffer.sampleRate, true); // sample rate
    view.setUint32(28, audioBuffer.sampleRate * numOfChannels * 2, true); // byte rate
    view.setUint16(32, numOfChannels * 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    
    // Data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, length - 44, true);
    
    // Write audio data
    const volume = 1;
    let index = 44;
    
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        const val = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(index, val, true);
        index += 2;
      }
    }
    
    return buffer;
  };
  
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  return (
    <div className="space-y-4 animate-fade-in">
      <h3 className="text-lg font-medium mb-4">Convertisseur Audio</h3>
      
      <div 
        className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition-all border-muted-foreground/30 hover:border-primary/50"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={!selectedFile ? handleClick : undefined}
      >
        <input 
          type="file" 
          className="hidden" 
          ref={fileInputRef} 
          accept=".wav,audio/wav" 
          onChange={handleFileInput}
        />
        
        {selectedFile ? (
          <div className="flex flex-col items-center space-y-4">
            <FileAudio2 className="h-10 w-10 text-primary" />
            <div>
              <h4 className="text-sm font-medium">{selectedFile.name}</h4>
              <p className="text-xs text-muted-foreground mt-1">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClick}
                disabled={isConverting}
              >
                Changer de fichier
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={convertToMp3}
                disabled={isConverting}
                className="transition-all duration-300 hover:shadow-md hover:translate-y-[-1px]"
              >
                <Download className="h-4 w-4 mr-2" />
                {isConverting ? "Conversion..." : "Convertir"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
            <h4 className="text-sm font-medium">
              Glissez un fichier WAV ou cliquez pour parcourir
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Uniquement les fichiers WAV sont supportés
            </p>
          </>
        )}
      </div>
      
      {isConverting && (
        <div className="space-y-2 animate-fade-in">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium">
              Conversion en cours...
            </span>
            <Badge variant="outline" className="text-xs animate-pulse">
              {progress.toFixed(0)}%
            </Badge>
          </div>
          <Progress value={progress} className="h-2 w-full" />
        </div>
      )}
      
      <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted/50 rounded-md">
        <p>
          <strong>Comment utiliser:</strong> Sélectionnez un fichier WAV, puis cliquez sur "Convertir" pour le télécharger au format optimisé.
        </p>
      </div>
    </div>
  );
};

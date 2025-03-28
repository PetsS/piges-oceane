
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileAudio2, Download } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import lamejs from "lamejs";

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
      
      // Convert to MP3 using lamejs
      toast.info("Conversion en MP3...");
      
      // Extract PCM data from the buffer
      const channelData = [];
      for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        channelData.push(audioBuffer.getChannelData(i));
      }
      
      // We'll work with max 2 channels (stereo)
      const channels = Math.min(2, audioBuffer.numberOfChannels);
      const sampleRate = audioBuffer.sampleRate;
      const sampleBlockSize = 1152; // Must be a multiple of 576
      
      // Create MP3 encoder with appropriate settings
      const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, 128);
      
      const mp3Data = [];
      
      // Update progress logic
      const totalBlocks = Math.ceil(channelData[0].length / sampleBlockSize);
      let blocksProcessed = 0;
      
      // Process audio in blocks
      for (let i = 0; i < channelData[0].length; i += sampleBlockSize) {
        // Update progress every few blocks
        if (blocksProcessed % 10 === 0) {
          const progressValue = 40 + Math.min(50, Math.floor((blocksProcessed / totalBlocks) * 50));
          setProgress(progressValue);
        }
        
        // Convert Float32Array to Int16Array for lamejs
        const left = new Int16Array(sampleBlockSize);
        const right = new Int16Array(sampleBlockSize);
        
        // Process a block of data
        for (let j = 0; j < sampleBlockSize; j++) {
          const k = i + j;
          if (k < channelData[0].length) {
            left[j] = channelData[0][k] * 0x7FFF;
            if (channels > 1) {
              right[j] = channelData[1][k] * 0x7FFF;
            } else {
              right[j] = left[j]; // Mono to stereo duplicate
            }
          }
        }
        
        // Encode block
        let mp3buf;
        if (channels === 1) {
          mp3buf = mp3encoder.encodeBuffer(left);
        } else {
          mp3buf = mp3encoder.encodeBuffer(left, right);
        }
        
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
        
        blocksProcessed++;
      }
      
      // Finalize the MP3
      const finalMp3 = mp3encoder.flush();
      if (finalMp3.length > 0) {
        mp3Data.push(finalMp3);
      }
      
      // Update progress
      setProgress(95);
      
      // Create blob and download
      const blob = new Blob(mp3Data, { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      
      // Create filename (replacing .wav with .mp3)
      const mp3FileName = selectedFile.name.replace(/\.wav$/i, '.mp3');
      
      // Trigger download
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = mp3FileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // Complete
      setProgress(100);
      toast.success(`Conversion réussie! ${mp3FileName} a été téléchargé.`);
      
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
  
  return (
    <div className="space-y-4 animate-fade-in">
      <h3 className="text-lg font-medium mb-4">Convertisseur WAV vers MP3</h3>
      
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
                {isConverting ? "Conversion..." : "Convertir en MP3"}
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
              Uniquement les fichiers WAV sont supportés pour la conversion
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
          <strong>Comment utiliser:</strong> Sélectionnez un fichier WAV, puis cliquez sur "Convertir en MP3" pour le télécharger au format MP3.
        </p>
      </div>
    </div>
  );
};

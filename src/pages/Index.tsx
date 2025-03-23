
import { useState } from "react";
import { useAudio } from "@/hooks/useAudio";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Waveform } from "@/components/Waveform";
import { MarkerControls } from "@/components/MarkerControls";
import { FileBrowser } from "@/components/FileBrowser";
import { useIsMobile } from "@/hooks/use-mobile";
import { Separator } from "@/components/ui/separator";

const Index = () => {
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    markers,
    audioFiles,
    isLoading,
    togglePlay,
    seek,
    changeVolume,
    addMarker,
    exportTrimmedAudio,
    loadAudioFile,
    loadFilesFromUNC,
    formatTime,
    formatTimeDetailed,
  } = useAudio();

  const isMobile = useIsMobile();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const handleFileSelect = (file: any) => {
    loadAudioFile(file);
    setSelectedFile(file.name);
  };

  const handlePathChange = (path: string, date: Date, hour: string | null) => {
    loadFilesFromUNC(path, date, hour);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 overflow-hidden">
      {/* Header */}
      <header className="py-6 px-6 md:px-8 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5 text-white"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Audio Logger</h1>
            <p className="text-xs text-muted-foreground">Hourly audio recordings</p>
          </div>
        </div>
      </header>

      <Separator />

      {/* Main content */}
      <main className="container px-4 py-6 md:py-8 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* File browser - left column on desktop, top on mobile */}
          <div className="md:col-span-1 h-[300px] md:h-[calc(100vh-12rem)]">
            <FileBrowser
              files={audioFiles}
              onFileSelect={handleFileSelect}
              isLoading={isLoading}
              onPathChange={handlePathChange}
            />
          </div>

          {/* Audio player and waveform - center column on desktop, middle on mobile */}
          <div className="md:col-span-2 flex flex-col space-y-6">
            <div className="w-full">
              <Waveform
                currentTime={currentTime}
                duration={duration}
                markers={markers}
                onSeek={seek}
                isPlaying={isPlaying}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AudioPlayer
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                volume={volume}
                onPlayPause={togglePlay}
                onVolumeChange={changeVolume}
                onSeek={seek}
                formatTime={formatTime}
                audioTitle={selectedFile ? `${selectedFile} (60 min)` : "No file selected"}
              />

              <MarkerControls
                markers={markers}
                onAddMarker={addMarker}
                onExport={exportTrimmedAudio}
                currentTime={currentTime}
                formatTimeDetailed={formatTimeDetailed}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;

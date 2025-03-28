
import { useState } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { FileBrowser } from "@/components/FileBrowser";
import { LocalAudioLoader } from "@/components/LocalAudioLoader";
import { useAudio } from "@/hooks/useAudio";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "@/contexts/SettingsContext";

const Index = () => {
  const { settings } = useSettings();
  
  const {
    audioFiles,
    isLoading,
    loadAudioFile,
    loadFilesFromUNC,
    formatTime,
    isPlaying,
    currentTime,
    duration,
    volume,
    togglePlay,
    seek,
    changeVolume,
    currentAudioFile,
    isBuffering
  } = useAudio();

  const handleFileSelect = (file) => {
    loadAudioFile(file);
  };

  const handleSearch = (path, city, date, hour) => {
    loadFilesFromUNC(path, city, date, hour);
  };

  if (!settings) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Loading settings...</h2>
          <p>Retrieving settings from the server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <header className="bg-background border-b py-4 px-6">
        <div>
          <h1 className="text-2xl font-bold">
            <span style={{ color: settings.buttonColors.primary }}>A</span>udio 
            <span style={{ color: settings.buttonColors.primary }}> M</span>arker 
            <span style={{ color: settings.buttonColors.primary }}> I</span>nterface
          </h1>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6 overflow-hidden">
        <div className="md:col-span-1 h-full overflow-hidden">
          <Tabs defaultValue="browser" className="h-full flex flex-col">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="browser">Server</TabsTrigger>
              <TabsTrigger value="local">Local files</TabsTrigger>
            </TabsList>
            
            <TabsContent value="browser" className="flex-1 overflow-hidden">
              <FileBrowser
                files={audioFiles}
                onFileSelect={handleFileSelect}
                isLoading={isLoading}
                onPathChange={handleSearch}
              />
            </TabsContent>
            
            <TabsContent value="local" className="flex-1 overflow-hidden">
              <LocalAudioLoader onFileLoad={handleFileSelect} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="md:col-span-2 lg:col-span-3 flex flex-col space-y-4 h-full overflow-hidden">
          <div className="flex-1 min-h-0">
            <AudioPlayer
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              volume={volume}
              onPlayPause={togglePlay}
              onVolumeChange={changeVolume}
              onSeek={seek}
              formatTime={formatTime}
              audioTitle={currentAudioFile ? currentAudioFile.name : "No audio loaded"}
              isLoading={isLoading}
              isBuffering={isBuffering}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;

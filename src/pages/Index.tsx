import { useState } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { FileBrowser } from "@/components/FileBrowser";
import { MarkerControls } from "@/components/MarkerControls";
import { LocalAudioLoader } from "@/components/LocalAudioLoader";
import { AudioConverter } from "@/components/AudioConverter";
import { useAudio } from "@/hooks/useAudio";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CassetteTapeIcon, HeadphonesIcon } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [isExporting, setIsExporting] = useState(false);
  const { settings } = useSettings();
  
  const {
    audioFiles,
    isLoading,
    markers,
    addMarker,
    removeMarker,
    setMarkers,
    exportTrimmedAudio,
    loadAudioFile,
    loadFilesFromUNC,
    formatTime,
    formatTimeDetailed,
    isPlaying,
    currentTime,
    duration,
    volume,
    togglePlay,
    seek,
    changeVolume,
    currentAudioFile,
    isBuffering,
    showMarkerControls,
    setShowMarkerControls,
    audioRef
  } = useAudio();

  const handleFileSelect = async (file) => {
    setShowMarkerControls(false);
    await loadAudioFile(file);
    setMarkers([]); // Clear markers when loading a new file
  };

  const handleSearch = (path, city, date, hour, typeInitial) => {
    setShowMarkerControls(false);
    loadFilesFromUNC(path, city, date, hour, typeInitial);
    setMarkers([]); // Clear markers when loading a new file
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      console.log("Starting export process");
      await exportTrimmedAudio();
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        console.log("Export process completed");
      }, 500);
    }
  };

  const handleDownloadFullAudio = () => {
    if (!audioRef.current || !currentAudioFile || !audioRef.current.src) return;

    const audioSrc = audioRef.current.src;
    const link = document.createElement("a");
    link.href = audioSrc;
    link.download = currentAudioFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  if (!settings) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Chargement des paramètres...</h2>
          <p>Récupération des paramètres du serveur...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-[#ffcc00]/100 border-b py-4 px-6">
        <div className="flex flex-col-md:flex-row items-center justify-between">
          <img
            src="img/hw_logo.webp"
            alt="Logo"
            className="h-10 w-10"
          />
          <div className="flex items-center space-x-2 mt-2 md:mt-0">
          <h1 className="text-2xl font-bold">
            <span>Pige</span>
          </h1>
            <CassetteTapeIcon className="h-8 w-8"/>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6">
        <div className="md:col-span-1 h-full flex flex-col min-h-0 overflow-hidden">
          <Tabs defaultValue="browser" className="h-full flex flex-col">
            <TabsList className="grid grid-cols-2 w-full mb-2">
              <TabsTrigger value="browser">Serveur</TabsTrigger>
              <TabsTrigger value="local">Fichiers</TabsTrigger>
              {/* <TabsTrigger value="convert">Convertir</TabsTrigger> */}
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
            
            <TabsContent value="convert" className="flex-1 overflow-hidden">
              <AudioConverter />
            </TabsContent>
          </Tabs>
        </div>

        <div className="md:col-span-2 lg:col-span-3 flex flex-col space-y-4 h-full overflow-hidden">
          <div>
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
              audioRef={audioRef}
              markers={markers}
            />
          </div>

          <div className="h-fit">
            {currentAudioFile && !showMarkerControls && (
              <div className="flex justify-end space-x-2 mb-4">
                <Button 
                  onClick={handleDownloadFullAudio}
                  variant="outline"
                  className="animate-fade-in"
                >
                  Télécharger Audio Complet
                </Button>

                <Button 
                  onClick={() => setShowMarkerControls(true)}
                  className="animate-fade-in"
                >
                  <HeadphonesIcon className="h-4 w-4 mr-2" />
                  Editer l'audio
                </Button>
              </div>
            )}
            
            {showMarkerControls && (
              <MarkerControls
                markers={markers}
                onAddMarker={addMarker}
                onExport={handleExport}
                onResetMarkers={() => setMarkers([])}
                currentTime={currentTime}
                formatTimeDetailed={formatTimeDetailed}
                isExporting={isExporting}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;

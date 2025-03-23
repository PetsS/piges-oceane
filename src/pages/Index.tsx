import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AudioPlayer } from "@/components/AudioPlayer";
import { FileBrowser } from "@/components/FileBrowser";
import { MarkerControls } from "@/components/MarkerControls";
import { LocalAudioLoader } from "@/components/LocalAudioLoader";
import { useAudio } from "@/hooks/useAudio";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cog, LogOut, Scissors } from "lucide-react";

const colorToHsl = (color: string) => {
  if (color.startsWith('hsl')) {
    const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
      return `${match[1]} ${match[2]}% ${match[3]}%`;
    }
  }
  
  let r = 0, g = 0, b = 0;
  
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16);
    g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16);
    b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16);
  } 
  else if (color.startsWith('rgb')) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*\d+(?:\.\d+)?)?\)/);
    if (match) {
      r = parseInt(match[1], 10);
      g = parseInt(match[2], 10);
      b = parseInt(match[3], 10);
    }
  }
  
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    
    h /= 6;
  }
  
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  
  return `${h} ${s}% ${l}%`;
};

const Index = () => {
  const [showAdmin, setShowAdmin] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showMarkerControls, setShowMarkerControls] = useState(false);
  const navigate = useNavigate();
  const {
    audioFiles,
    isLoading,
    markers,
    addMarker,
    removeMarker,
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
  } = useAudio();

  useEffect(() => {
    const isAdmin = localStorage.getItem("isAdmin") === "true";
    setShowAdmin(isAdmin);
  }, []);
  
  useEffect(() => {
    const savedSettings = localStorage.getItem("appSettings");
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      
      if (settings.buttonColors) {
        document.documentElement.style.setProperty('--primary', colorToHsl(settings.buttonColors.primary));
        document.documentElement.style.setProperty('--secondary', colorToHsl(settings.buttonColors.secondary));
        document.documentElement.style.setProperty('--accent', colorToHsl(settings.buttonColors.accent));
      }
    }
  }, []);
  
  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("isAdmin");
    navigate("/login");
  };

  const handleFileSelect = (file) => {
    setShowMarkerControls(false);
    loadAudioFile(file);
  };

  const handleSearch = (path, city, date, hour) => {
    setShowMarkerControls(false);
    loadFilesFromUNC(path, city, date, hour);
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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <header className="bg-background border-b py-4 px-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">
            {localStorage.getItem("appSettings") ? 
              JSON.parse(localStorage.getItem("appSettings") || '{}').headerTitle || "Lecteur Audio" : 
              "Lecteur Audio"
            }
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {showAdmin && (
            <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
              <Cog className="mr-2 h-4 w-4" />
              Administration
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6 overflow-hidden">
        <div className="md:col-span-1 h-full overflow-hidden">
          <Tabs defaultValue="browser" className="h-full flex flex-col">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="browser">Serveur</TabsTrigger>
              <TabsTrigger value="local">Fichiers locaux</TabsTrigger>
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
              audioTitle={currentAudioFile ? currentAudioFile.name : "Aucun audio chargé"}
              isLoading={isLoading}
              isBuffering={isBuffering}
            />
          </div>

          <div className="h-fit">
            {currentAudioFile && !showMarkerControls && (
              <div className="flex justify-end mb-4">
                <Button 
                  onClick={() => setShowMarkerControls(true)}
                  className="animate-fade-in"
                >
                  <Scissors className="h-4 w-4 mr-2" />
                  Éditer l'audio
                </Button>
              </div>
            )}
            
            {showMarkerControls && (
              <MarkerControls
                markers={markers}
                onAddMarker={addMarker}
                onExport={handleExport}
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

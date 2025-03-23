
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AudioPlayer } from "@/components/AudioPlayer";
import { FileBrowser } from "@/components/FileBrowser";
import { MarkerControls } from "@/components/MarkerControls";
import { useAudio } from "@/hooks/useAudio";
import { Button } from "@/components/ui/button";
import { Cog, LogOut } from "lucide-react";

const Index = () => {
  const [showAdmin, setShowAdmin] = useState(false);
  const navigate = useNavigate();
  const {
    audioFiles,
    currentFile,
    isLoading,
    setMarkers,
    markers,
    handleFileSelect,
    handleSearch,
    exportAudio,
  } = useAudio();

  // Check if the user is an admin
  useEffect(() => {
    const isAdmin = localStorage.getItem("isAdmin") === "true";
    setShowAdmin(isAdmin);
  }, []);
  
  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem("appSettings");
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      
      // Apply the CSS variables for colors
      if (settings.buttonColors) {
        document.documentElement.style.setProperty('--primary', settings.buttonColors.primary);
        document.documentElement.style.setProperty('--secondary', settings.buttonColors.secondary);
        document.documentElement.style.setProperty('--accent', settings.buttonColors.accent);
      }
    }
  }, []);
  
  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("isAdmin");
    navigate("/login");
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
          <FileBrowser
            files={audioFiles}
            onFileSelect={handleFileSelect}
            isLoading={isLoading}
            onPathChange={handleSearch}
          />
        </div>

        <div className="md:col-span-2 lg:col-span-3 flex flex-col space-y-4 h-full overflow-hidden">
          <div className="flex-1 min-h-0">
            <AudioPlayer
              file={currentFile}
              markers={markers}
              onMarkersChange={setMarkers}
            />
          </div>

          <div className="h-fit grid grid-cols-1 md:grid-cols-2 gap-4">
            <MarkerControls
              markers={markers}
              onMarkersChange={setMarkers}
              disabled={!currentFile}
            />

            <div className="flex items-end justify-end">
              <Button
                onClick={exportAudio}
                disabled={!currentFile}
                size="lg"
                className="w-full md:w-auto"
              >
                Exporter l'audio
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;

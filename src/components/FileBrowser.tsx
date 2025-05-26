import { useState, useEffect } from "react";
import { AudioFile } from "@/hooks/useAudio";
import { cn } from "@/lib/utils";
import { Calendar, Search, Clock, FileAudio, MapPin, GitFork } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format, isToday } from "date-fns";
import { DatePicker } from "@/components/DatePicker";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import typesConfig from "@/config/types.json";
import citiesConfig from "@/config/cities.json";
import { useSettings } from "@/contexts/SettingsContext";
import { getTypeInitial } from "@/utils/getTypeInitial";

interface CityFolder {
  displayName: string;
  folderName: string;
}

interface FileBrowserProps {
  files: AudioFile[];
  onFileSelect: (file: AudioFile) => void;
  isLoading: boolean;
  onPathChange: (path: string, city: string, date: Date, hour: string | null, typeInitial: string) => void;
}

export const FileBrowser = ({
  files,
  onFileSelect,
  isLoading,
  onPathChange,
}: FileBrowserProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedHour, setSelectedHour] = useState<string | null>(null);
  const [audioFolderPath, setAudioFolderPath] = useState("/audio");
  const [selectedCityFolder, setSelectedCityFolder] = useState<string>(citiesConfig[0]?.folderName || "Angers");
  const [selectedType, setSelectedType] = useState<string>(typesConfig[0]?.folderName || "Départs");
  const [cities, setCities] = useState<CityFolder[]>(citiesConfig.departs);
  const [types, setTypes] = useState(typesConfig);
  const [isLocalPath, setIsLocalPath] = useState(false);
  const [currentHour, setCurrentHour] = useState<number>(new Date().getHours());
  const { settings } = useSettings();

  // Update current hour every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000); // every minute

    return () => clearInterval(interval);
  }, []);

  // Load audio folder path from settings
  useEffect(() => {
    if (settings && settings.audioFolderPath) {
      setAudioFolderPath(settings.audioFolderPath);
      
      // Check if it's a local path (doesn't start with \\)
      setIsLocalPath(!settings.audioFolderPath.startsWith('\\\\'));
    }
    
    // Use cities from settings if available, otherwise use from config file
    if (settings && settings.cities && settings.cities.length > 0) {
      setCities(settings.cities);
      setSelectedCityFolder(settings.cities[0]?.folderName || citiesConfig[0]?.folderName);
    }
  }, [settings]);

  // Update cities based on selected type and settings
  useEffect(() => {
    const isDeparts = selectedType.toLowerCase().includes("depart");
  
    const selectedCities =
      settings && settings.cities && settings.cities.length > 0
        ? settings.cities
        : isDeparts
        ? citiesConfig.departs
        : citiesConfig.retours;
  
    setCities(selectedCities);
    setSelectedCityFolder(selectedCities[0]?.folderName || "Angers");
  }, [selectedType, settings]);
  
  // Update selected city folder when cities change
  useEffect(() => {
    const typeLower = selectedType.toLowerCase();
    if (typeLower.includes("retour")) {
      setCities(citiesConfig.retours);
    } else {
      setCities(citiesConfig.departs);
    }
  }, [selectedType]);

  const handleSearch = () => {
    if (!selectedDate) return;
    
    // Format date as YYYY-MM-DD for folder structure
    const dateFolder = format(selectedDate, "yyyy-MM-dd");
    const typeInitial = getTypeInitial(selectedType);
    
    // Generate path based on the type and other parameters
    let fullPath;
    
    if (isLocalPath) {
      // For local paths, construct the path without doubling the backslashes
      fullPath = `${audioFolderPath}/${selectedType}/${selectedCityFolder}/${dateFolder}${selectedHour ? `/${selectedHour}.mp3` : ''}`;
    } else {
      // For network paths (UNC), ensure the format starts with double backslashes
      fullPath = `${audioFolderPath}\\${selectedType}\\${selectedCityFolder}\\${dateFolder}${selectedHour ? `\\${selectedHour}.mp3` : ''}`;
    }

    onPathChange(fullPath, selectedCityFolder, selectedDate, selectedHour, typeInitial);
  };

  const isHourDisabled = (hour: number): boolean => {
    // If the selected date is today, disable future hours
    if (selectedDate && isToday(selectedDate)) {
      return hour >= currentHour;
    }
    return false;
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
              <GitFork className="h-4 w-4" />
              <span>Type</span>
            </label>
            <Select 
              value={selectedType} 
              onValueChange={setSelectedType}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                {types.map((type) => (
                  <SelectItem key={type.folderName} value={type.folderName}>
                    {type.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>Sélectionner une ville</span>
            </label>
            <Select 
              value={selectedCityFolder} 
              onValueChange={setSelectedCityFolder}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sélectionner une ville" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city.folderName} value={city.folderName}>
                    {city.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
            <div className="grid grid-cols-4 gap-1.5">
              {hours.map((hour) => {
                const hourNumber = parseInt(hour, 10);
                const disabled = isHourDisabled(hourNumber);
                
                return (
                  <Button
                    key={hour}
                    variant={selectedHour === hour ? "default" : "outline"}
                    className={cn(
                      "h-9 px-2 text-xs",
                      selectedHour === hour 
                        ? "bg-primary text-primary-foreground" 
                        : "hover:bg-secondary/80",
                      disabled && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={() => !disabled && setSelectedHour(selectedHour === hour ? null : hour)}
                    disabled={disabled}
                  >
                    {hour}:00
                  </Button>
                );
              })}
            </div>
          </div>
          
          <Button 
            className="w-full mt-2 transition-all duration-300 hover:shadow-md hover:translate-y-[-1px]"
            onClick={handleSearch}
            disabled={!selectedDate}
          >
            {/* <Search className="h-4 w-4 mr-2" /> */}
            Charger le fichier audio
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
              <p className="text-sm text-muted-foreground">Charger l'audio...</p>
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
                  "active:scale-[0.98] hover:shadow-sm",
                )}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mr-3">
                  <FileAudio className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="font-medium truncate">{file.name}</div>
                  <div className="flex text-xs text-muted-foreground space-x-1.5">
                    <span>{file.size}</span>
                    <span>•</span>
                    <span>{file.type.split("/")[1]}</span>
                  </div>
                  <div className="flex items-center space-y-1 space-x-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{file.lastModified}</span>
                  </div>
                </div>
                
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

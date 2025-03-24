
import { toast } from "sonner";

export interface CityFolder {
  displayName: string;
  folderName: string;
}

export interface Settings {
  headerTitle: string;
  buttonColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  audioFolderPath: string;
  cities: CityFolder[];
}

// Server endpoint where settings are stored - in a real implementation,
// this would be your backend API endpoint
const SETTINGS_API_URL = "http://your-api-server.com/api/settings";

// Default settings to use if fetching fails
const DEFAULT_SETTINGS: Settings = {
  headerTitle: "Piges",
  buttonColors: {
    primary: "#1F4A4F",
    secondary: "#8F8F8F",
    accent: "#8F8F8F",
  },
  audioFolderPath: "\\\\server\\audioLogs",
  cities: [
    { displayName: "Paris", folderName: "paris" },
    { displayName: "Lyon", folderName: "lyon" },
    { displayName: "Marseille", folderName: "marseille" },
    { displayName: "Bordeaux", folderName: "bordeaux" }
  ]
};

// For demonstration purposes, we're using localStorage as a mock server
// In a real implementation, remove this and use actual API calls
const MOCK_SERVER_STORAGE_KEY = "serverSettings";

// Initialize mock server storage if it doesn't exist
if (!localStorage.getItem(MOCK_SERVER_STORAGE_KEY)) {
  localStorage.setItem(MOCK_SERVER_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
}

export const getSettings = async (): Promise<Settings> => {
  try {
    // In a real implementation, replace this with fetch to your API
    // const response = await fetch(SETTINGS_API_URL);
    // const data = await response.json();
    // return data;
    
    // Mock implementation using localStorage
    const storedSettings = localStorage.getItem(MOCK_SERVER_STORAGE_KEY);
    if (storedSettings) {
      return JSON.parse(storedSettings) as Settings;
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    toast.error("Impossible de récupérer les paramètres du serveur. Utilisation des paramètres par défaut.");
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = async (settings: Settings): Promise<boolean> => {
  try {
    // In a real implementation, replace this with fetch to your API
    // const response = await fetch(SETTINGS_API_URL, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(settings),
    // });
    // return response.ok;
    
    // Mock implementation using localStorage
    localStorage.setItem(MOCK_SERVER_STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error("Failed to save settings:", error);
    toast.error("Impossible d'enregistrer les paramètres sur le serveur.");
    return false;
  }
};

export const colorToHsl = (color: string) => {
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

// Apply theme based on settings
export const applyTheme = (settings: Settings) => {
  // Set CSS variables for both light and dark mode
  document.documentElement.style.setProperty('--primary', colorToHsl(settings.buttonColors.primary));
  document.documentElement.style.setProperty('--primary-foreground', '210 40% 98%');
  
  document.documentElement.style.setProperty('--secondary', colorToHsl(settings.buttonColors.secondary));
  document.documentElement.style.setProperty('--accent', colorToHsl(settings.buttonColors.accent));
  
  // Also update sidebar colors
  document.documentElement.style.setProperty('--sidebar-background', colorToHsl(settings.buttonColors.secondary));
  document.documentElement.style.setProperty('--sidebar-primary', colorToHsl(settings.buttonColors.primary));
  
  // Force a refresh of the theme
  document.documentElement.classList.remove('theme-updated');
  setTimeout(() => document.documentElement.classList.add('theme-updated'), 10);
  
  console.log('Theme applied:', {
    primary: settings.buttonColors.primary,
    secondary: settings.buttonColors.secondary,
    accent: settings.buttonColors.accent
  });
};

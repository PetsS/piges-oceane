
import citiesConfig from "@/config/cities.json";
import typesConfig from "@/config/types.json";

export interface Settings {
  colorScheme: 'light' | 'dark' | 'auto';
  headerTitle: string;
  logoUrl: string | null;
  enableNotifications: boolean;
  cities: {
    departs: CityFolder[];
    retours: CityFolder[];
  };
  audioFolderPath: string;
  buttonColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

// Define and export the CityFolder interface
export interface CityFolder {
  displayName: string;
  folderName: string;
}

// Default settings
const defaultSettings: Settings = {
  colorScheme: 'light',
  headerTitle: 'Audio Marker Interface',
  logoUrl: null,
  enableNotifications: true,
  cities: citiesConfig,
  audioFolderPath: '/audio',
  buttonColors: {
    primary: '#1F4A4F',
    secondary: '#8F8F8F',
    accent: '#8F8F8F'
  }
};

// Function to get settings from server or localStorage
export const getSettings = async (): Promise<Settings> => {
  return new Promise((resolve) => {
    // Simulate API call with a timeout
    setTimeout(() => {
      // Try to get settings from localStorage first
      const savedSettings = localStorage.getItem('serverSettings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          // Merge with default settings to ensure all fields are present
          resolve({
            ...defaultSettings,
            ...parsed,
            // Ensure buttonColors is properly structured
            buttonColors: {
              ...defaultSettings.buttonColors,
              ...(parsed.buttonColors || {})
            },
            // Ensure we always have cities data
            cities: parsed.cities && Object.keys(parsed.cities).length > 0
              ? parsed.cities
              : citiesConfig
          });
          return;
        } catch (e) {
          console.error('Failed to parse saved settings:', e);
        }
      }
      
      // If no saved settings or parsing failed, use defaults
      resolve(defaultSettings);
    }, 800);
  });
};

// Function to save settings
export const saveSettings = async (settings: Settings): Promise<boolean> => {
  return new Promise((resolve) => {
    // Simulate API call with a timeout
    setTimeout(() => {
      try {
        localStorage.setItem('serverSettings', JSON.stringify(settings));
        resolve(true);
      } catch (e) {
        console.error('Failed to save settings:', e);
        resolve(false);
      }
    }, 800);
  });
};

// Helper function to convert hex color to HSL format for CSS variables
export const colorToHsl = (hexColor: string): string => {
  // Default color if conversion fails
  let h = 210, s = 40, l = 96;
  
  try {
    // Remove hash if present
    hexColor = hexColor.replace('#', '');
    
    // Parse hex values
    const r = parseInt(hexColor.slice(0, 2), 16) / 255;
    const g = parseInt(hexColor.slice(2, 4), 16) / 255;
    const b = parseInt(hexColor.slice(4, 6), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let hue = 0, sat = 0;
    const light = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      sat = light > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: hue = (g - b) / d + (g < b ? 6 : 0); break;
        case g: hue = (b - r) / d + 2; break;
        case b: hue = (r - g) / d + 4; break;
      }
      
      hue /= 6;
    }
    
    // Convert to degrees, percentages
    h = Math.round(hue * 360);
    s = Math.round(sat * 100);
    l = Math.round(light * 100);
    
    console.log(`Converted ${hexColor} to HSL: ${h} ${s}% ${l}%`);
  } catch (error) {
    console.error('Error converting color to HSL:', error);
  }
  
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


import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Settings, getSettings, saveSettings, applyTheme } from '@/utils/settingsService';
import { toast } from 'sonner';

interface SettingsContextType {
  settings: Settings | null;
  isLoading: boolean;
  error: Error | null;
  updateSettings: (newSettings: Settings) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const fetchedSettings = await getSettings();
      setSettings(fetchedSettings);
      
      // Apply theme immediately and then again after a delay
      applyTheme(fetchedSettings);
      
      // Apply theme again after DOM is fully processed
      setTimeout(() => {
        applyTheme(fetchedSettings);
        console.log('Theme reapplied after delay');
      }, 200);
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch settings'));
      toast.error('Échec du chargement des paramètres');
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (newSettings: Settings) => {
    try {
      setIsLoading(true);
      const success = await saveSettings(newSettings);
      if (success) {
        setSettings(newSettings);
        applyTheme(newSettings);
        toast.success('Paramètres mis à jour avec succès');
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update settings'));
      toast.error('Échec de la mise à jour des paramètres');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Clear any existing settings in localStorage to force using the new defaults
    localStorage.removeItem('serverSettings');
    fetchSettings();
    
    // Add observer to document ready state to ensure theme is applied
    if (document.readyState === 'complete') {
      setTimeout(() => {
        if (settings) {
          applyTheme(settings);
          console.log('Theme applied on document complete');
        }
      }, 500);
    } else {
      window.addEventListener('load', () => {
        if (settings) {
          applyTheme(settings);
          console.log('Theme applied on window load');
        }
      });
    }
  }, []);

  return (
    <SettingsContext.Provider 
      value={{ 
        settings, 
        isLoading, 
        error, 
        updateSettings,
        refreshSettings: fetchSettings
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

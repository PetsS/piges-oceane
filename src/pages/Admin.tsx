
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ColorPicker";

interface User {
  username: string;
  password: string;
  isAdmin: boolean;
}

interface Settings {
  headerTitle: string;
  buttonColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  audioFolderPath: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState<User>({ username: "", password: "", isAdmin: false });
  const [settings, setSettings] = useState<Settings>({
    headerTitle: "Lecteur Audio",
    buttonColors: {
      primary: "#1d4ed8", // blue-700
      secondary: "#4b5563", // gray-600
      accent: "#059669", // emerald-600
    },
    audioFolderPath: "\\\\server\\audioLogs",
  });

  // Check if current user is admin
  useEffect(() => {
    const currentUser = localStorage.getItem("currentUser");
    if (!currentUser || currentUser !== "admin") {
      toast.error("Accès refusé. Seuls les administrateurs peuvent accéder à cette page.");
      navigate("/");
    }

    // Load users from localStorage
    const savedUsers = localStorage.getItem("users");
    if (savedUsers) {
      setUsers(JSON.parse(savedUsers));
    } else {
      // Initialize with default admin
      const defaultUsers = [
        { username: "admin", password: "password", isAdmin: true }
      ];
      localStorage.setItem("users", JSON.stringify(defaultUsers));
      setUsers(defaultUsers);
    }

    // Load settings
    const savedSettings = localStorage.getItem("appSettings");
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    } else {
      // Save default settings
      localStorage.setItem("appSettings", JSON.stringify(settings));
    }
  }, []);

  const handleAddUser = () => {
    if (!newUser.username || !newUser.password) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (users.some(user => user.username === newUser.username)) {
      toast.error("Ce nom d'utilisateur existe déjà");
      return;
    }

    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    localStorage.setItem("users", JSON.stringify(updatedUsers));
    
    setNewUser({ username: "", password: "", isAdmin: false });
    toast.success("Utilisateur ajouté avec succès");
  };

  const handleDeleteUser = (username: string) => {
    if (username === "admin") {
      toast.error("L'utilisateur admin ne peut pas être supprimé");
      return;
    }

    const updatedUsers = users.filter(user => user.username !== username);
    setUsers(updatedUsers);
    localStorage.setItem("users", JSON.stringify(updatedUsers));
    toast.success("Utilisateur supprimé avec succès");
  };

  const handleSaveSettings = () => {
    localStorage.setItem("appSettings", JSON.stringify(settings));
    
    // Apply the CSS variables for colors
    document.documentElement.style.setProperty('--primary', settings.buttonColors.primary);
    document.documentElement.style.setProperty('--secondary', settings.buttonColors.secondary);
    document.documentElement.style.setProperty('--accent', settings.buttonColors.accent);
    
    toast.success("Paramètres enregistrés avec succès");
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Administration</h1>
        <Button 
          onClick={() => navigate("/")}
          variant="outline"
        >
          Retour à l'application
        </Button>
      </div>
      
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="headers">Titres et En-têtes</TabsTrigger>
          <TabsTrigger value="colors">Couleurs</TabsTrigger>
          <TabsTrigger value="folders">Dossiers Audio</TabsTrigger>
        </TabsList>
        
        <TabsContent value="users" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Gestion des utilisateurs</CardTitle>
              <CardDescription>
                Ajouter, modifier ou supprimer des comptes utilisateurs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="username">Nom d'utilisateur</Label>
                    <Input 
                      id="username"
                      value={newUser.username}
                      onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                      placeholder="Nom d'utilisateur"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe</Label>
                    <Input 
                      id="password"
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      placeholder="Mot de passe"
                    />
                  </div>
                  <div className="pt-8">
                    <Button onClick={handleAddUser}>Ajouter un utilisateur</Button>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Utilisateurs existants</h3>
                  <div className="border rounded-md divide-y">
                    {users.map((user) => (
                      <div key={user.username} className="p-4 flex justify-between items-center">
                        <div>
                          <p className="font-medium">{user.username}</p>
                          <p className="text-sm text-muted-foreground">
                            {user.isAdmin ? "Administrateur" : "Utilisateur standard"}
                          </p>
                        </div>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleDeleteUser(user.username)}
                          disabled={user.username === "admin"}
                        >
                          Supprimer
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="headers" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Titres et En-têtes</CardTitle>
              <CardDescription>
                Personnaliser les titres affichés dans l'application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="headerTitle">Titre principal</Label>
                  <Input
                    id="headerTitle"
                    value={settings.headerTitle}
                    onChange={(e) => setSettings({...settings, headerTitle: e.target.value})}
                    placeholder="Titre principal de l'application"
                  />
                </div>
                
                <div className="pt-2">
                  <Button onClick={handleSaveSettings}>Enregistrer les modifications</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="colors" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Couleurs des boutons</CardTitle>
              <CardDescription>
                Personnaliser les couleurs des boutons de l'application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <Label>Couleur principale (boutons d'action)</Label>
                    <ColorPicker
                      color={settings.buttonColors.primary}
                      onChange={(color) => setSettings({
                        ...settings, 
                        buttonColors: {...settings.buttonColors, primary: color}
                      })}
                    />
                    <div 
                      className="h-10 rounded-md border"
                      style={{ backgroundColor: settings.buttonColors.primary }}
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <Label>Couleur secondaire</Label>
                    <ColorPicker
                      color={settings.buttonColors.secondary}
                      onChange={(color) => setSettings({
                        ...settings, 
                        buttonColors: {...settings.buttonColors, secondary: color}
                      })}
                    />
                    <div 
                      className="h-10 rounded-md border"
                      style={{ backgroundColor: settings.buttonColors.secondary }}
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <Label>Couleur d'accent (marqueurs)</Label>
                    <ColorPicker
                      color={settings.buttonColors.accent}
                      onChange={(color) => setSettings({
                        ...settings, 
                        buttonColors: {...settings.buttonColors, accent: color}
                      })}
                    />
                    <div 
                      className="h-10 rounded-md border"
                      style={{ backgroundColor: settings.buttonColors.accent }}
                    />
                  </div>
                </div>
                
                <div className="pt-2">
                  <Button onClick={handleSaveSettings}>Appliquer les couleurs</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="folders" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Emplacement des fichiers audio</CardTitle>
              <CardDescription>
                Configurer le dossier où sont stockés les fichiers audio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="audioFolder">Chemin du dossier audio</Label>
                  <Input
                    id="audioFolder"
                    value={settings.audioFolderPath}
                    onChange={(e) => setSettings({...settings, audioFolderPath: e.target.value})}
                    placeholder="Chemin du dossier (ex: \\server\audioLogs)"
                  />
                </div>
                
                <div className="pt-2">
                  <Button onClick={handleSaveSettings}>Enregistrer le chemin</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;

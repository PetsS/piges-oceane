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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface User {
  username: string;
  password: string;
  isAdmin: boolean;
}

interface CityFolder {
  displayName: string;
  folderName: string;
}

interface Settings {
  headerTitle: string;
  buttonColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  audioFolderPath: string;
  cities: string[] | CityFolder[];
}

const Admin = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState<User>({ username: "", password: "", isAdmin: false });
  const [settings, setSettings] = useState<Settings>({
    headerTitle: "Lecteur Audio",
    buttonColors: {
      primary: "hsl(221, 83%, 53%)",
      secondary: "hsl(210, 40%, 96%)",
      accent: "hsl(210, 40%, 96%)",
    },
    audioFolderPath: "\\\\server\\audioLogs",
    cities: [
      { displayName: "Paris", folderName: "paris" },
      { displayName: "Lyon", folderName: "lyon" },
      { displayName: "Marseille", folderName: "marseille" },
      { displayName: "Bordeaux", folderName: "bordeaux" }
    ]
  });
  
  const [newCityDisplayName, setNewCityDisplayName] = useState("");
  const [newCityFolderName, setNewCityFolderName] = useState("");
  const [editingCity, setEditingCity] = useState<CityFolder | null>(null);
  const [originalFolderName, setOriginalFolderName] = useState<string>("");
  
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("user");

  const migrateOldCityFormat = (cities: any[]): CityFolder[] => {
    if (cities.length > 0 && typeof cities[0] === 'string') {
      return cities.map(city => ({
        displayName: city.charAt(0).toUpperCase() + city.slice(1),
        folderName: city
      }));
    }
    return cities as CityFolder[];
  };

  useEffect(() => {
    const currentUser = localStorage.getItem("currentUser");
    if (!currentUser || currentUser !== "admin") {
      toast.error("Accès refusé. Seuls les administrateurs peuvent accéder à cette page.");
      navigate("/");
      return;
    }

    const savedUsers = localStorage.getItem("users");
    if (savedUsers) {
      try {
        const parsedUsers = JSON.parse(savedUsers);
        setUsers(Array.isArray(parsedUsers) ? parsedUsers : []);
      } catch (error) {
        console.error("Error parsing users from localStorage:", error);
        setUsers([{ username: "admin", password: "password", isAdmin: true }]);
        localStorage.setItem("users", JSON.stringify([{ username: "admin", password: "password", isAdmin: true }]));
      }
    } else {
      const defaultUsers = [
        { username: "admin", password: "password", isAdmin: true }
      ];
      localStorage.setItem("users", JSON.stringify(defaultUsers));
      setUsers(defaultUsers);
    }

    const savedSettings = localStorage.getItem("appSettings");
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        
        if (!parsedSettings.cities || !Array.isArray(parsedSettings.cities)) {
          parsedSettings.cities = [
            { displayName: "Paris", folderName: "paris" },
            { displayName: "Lyon", folderName: "lyon" },
            { displayName: "Marseille", folderName: "marseille" },
            { displayName: "Bordeaux", folderName: "bordeaux" }
          ];
        } else {
          parsedSettings.cities = migrateOldCityFormat(parsedSettings.cities);
        }
                
        setSettings(parsedSettings);
      } catch (error) {
        console.error("Error parsing settings from localStorage:", error);
        localStorage.setItem("appSettings", JSON.stringify(settings));
      }
    } else {
      localStorage.setItem("appSettings", JSON.stringify(settings));
    }
  }, [navigate]);

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
    setUserRole("user");
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
    
    document.documentElement.style.setProperty('--primary', colorToHsl(settings.buttonColors.primary));
    document.documentElement.style.setProperty('--secondary', colorToHsl(settings.buttonColors.secondary));
    document.documentElement.style.setProperty('--accent', colorToHsl(settings.buttonColors.accent));
    
    toast.success("Paramètres enregistrés avec succès");
  };

  const handleChangePassword = () => {
    if (!selectedUser) return;
    
    if (newPassword.length < 4) {
      toast.error("Le mot de passe doit contenir au moins 4 caractères");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    
    const updatedUsers = users.map(user => {
      if (user.username === selectedUser) {
        return {
          ...user,
          password: newPassword
        };
      }
      return user;
    });
    
    setUsers(updatedUsers);
    localStorage.setItem("users", JSON.stringify(updatedUsers));
    
    setSelectedUser(null);
    setNewPassword("");
    setConfirmPassword("");
    
    toast.success(`Mot de passe modifié pour ${selectedUser}`);
  };

  const handleAddCity = () => {
    if (!newCityDisplayName.trim() || !newCityFolderName.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    
    const folderNameLower = newCityFolderName.trim().toLowerCase();
    const cities = settings.cities as CityFolder[];
    
    if (cities.some(city => city.folderName === folderNameLower)) {
      toast.error("Ce nom de dossier existe déjà dans la liste");
      return;
    }
    
    const updatedCities = [...cities, { 
      displayName: newCityDisplayName.trim(), 
      folderName: folderNameLower 
    }];
    
    const updatedSettings = {...settings, cities: updatedCities};
    setSettings(updatedSettings);
    
    localStorage.setItem("appSettings", JSON.stringify(updatedSettings));
    
    setNewCityDisplayName("");
    setNewCityFolderName("");
    toast.success(`Ville "${newCityDisplayName}" ajoutée à la liste`);
  };

  const handleRemoveCity = (folderName: string) => {
    const cities = settings.cities as CityFolder[];
    if (cities.length <= 1) {
      toast.error("Vous devez garder au moins une ville dans la liste");
      return;
    }
    
    const updatedCities = cities.filter(city => city.folderName !== folderName);
    
    const updatedSettings = {...settings, cities: updatedCities};
    setSettings(updatedSettings);
    
    localStorage.setItem("appSettings", JSON.stringify(updatedSettings));
    
    toast.success(`Ville supprimée de la liste`);
  };

  const handleUpdateCity = () => {
    if (!editingCity) return;
    
    if (!editingCity.displayName.trim() || !editingCity.folderName.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    
    const cities = settings.cities as CityFolder[];
    const folderNameLower = editingCity.folderName.trim().toLowerCase();
    
    // Check if another city has the same folder name except the one we're editing
    const duplicateFolder = cities.some(
      city => city.folderName !== originalFolderName && 
              city.folderName === folderNameLower
    );
    
    if (duplicateFolder) {
      toast.error("Ce nom de dossier existe déjà pour une autre ville");
      return;
    }
    
    const updatedCities = cities.map(city => {
      if (city.folderName === originalFolderName) {
        return {
          displayName: editingCity.displayName.trim(),
          folderName: folderNameLower
        };
      }
      return city;
    });
    
    const updatedSettings = {...settings, cities: updatedCities};
    setSettings(updatedSettings);
    
    localStorage.setItem("appSettings", JSON.stringify(updatedSettings));
    
    setEditingCity(null);
    toast.success("Ville modifiée avec succès");
  };

  const handleChangeRole = () => {
    if (!editingUser) return;
    
    const updatedUsers = users.map(user => {
      if (user.username === editingUser) {
        return {
          ...user,
          isAdmin: userRole === "admin"
        };
      }
      return user;
    });
    
    setUsers(updatedUsers);
    localStorage.setItem("users", JSON.stringify(updatedUsers));
    
    setEditingUser(null);
    
    toast.success(`Rôle modifié pour ${editingUser}`);
  };

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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="headers">Titres et En-têtes</TabsTrigger>
          <TabsTrigger value="colors">Couleurs</TabsTrigger>
          <TabsTrigger value="folders">Dossiers Audio</TabsTrigger>
          <TabsTrigger value="cities">Villes</TabsTrigger>
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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
                  <div className="space-y-2">
                    <Label htmlFor="role">Rôle</Label>
                    <Select 
                      onValueChange={(value) => setNewUser({...newUser, isAdmin: value === "admin"})}
                      defaultValue="user"
                    >
                      <SelectTrigger id="role">
                        <SelectValue placeholder="Sélectionner un rôle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Utilisateur</SelectItem>
                        <SelectItem value="admin">Administrateur</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="pt-8">
                    <Button onClick={handleAddUser}>Ajouter un utilisateur</Button>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Utilisateurs existants</h3>
                  <div className="border rounded-md divide-y">
                    {users && users.length > 0 ? users.map((user) => (
                      <div key={user.username} className="p-4 flex justify-between items-center">
                        <div>
                          <p className="font-medium">{user.username}</p>
                          <p className="text-sm text-muted-foreground">
                            {user.isAdmin ? "Administrateur" : "Utilisateur standard"}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(user.username);
                                  setNewPassword("");
                                  setConfirmPassword("");
                                }}
                              >
                                Modifier mot de passe
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                              <DialogHeader>
                                <DialogTitle>Modifier le mot de passe</DialogTitle>
                                <DialogDescription>
                                  Définir un nouveau mot de passe pour {selectedUser}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="new-password">Nouveau mot de passe</Label>
                                  <Input
                                    id="new-password"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Nouveau mot de passe"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                                  <Input
                                    id="confirm-password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirmer le mot de passe"
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="outline">Annuler</Button>
                                </DialogClose>
                                <DialogClose asChild>
                                  <Button onClick={handleChangePassword}>Enregistrer</Button>
                                </DialogClose>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setEditingUser(user.username);
                                  setUserRole(user.isAdmin ? "admin" : "user");
                                }}
                              >
                                Modifier rôle
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                              <DialogHeader>
                                <DialogTitle>Modifier le rôle</DialogTitle>
                                <DialogDescription>
                                  Changer le rôle de l'utilisateur {editingUser}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="py-4">
                                <RadioGroup 
                                  value={userRole}
                                  onValueChange={setUserRole}
                                  className="space-y-3"
                                >
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="user" id="user-role" />
                                    <Label htmlFor="user-role">Utilisateur standard</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="admin" id="admin-role" />
                                    <Label htmlFor="admin-role">Administrateur</Label>
                                  </div>
                                </RadioGroup>
                              </div>
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="outline">Annuler</Button>
                                </DialogClose>
                                <DialogClose asChild>
                                  <Button onClick={handleChangeRole}>Enregistrer</Button>
                                </DialogClose>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="destructive" 
                                size="sm"
                                disabled={user.username === "admin"}
                              >
                                Supprimer
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cette action supprimera définitivement l'utilisateur {user.username} 
                                  et ne peut pas être annulée.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteUser(user.username)}>
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    )) : (
                      <div className="p-4 text-center text-muted-foreground">
                        Aucun utilisateur trouvé
                      </div>
                    )}
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
        
        <TabsContent value="cities" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Gestion des villes</CardTitle>
              <CardDescription>
                Configurez les noms des villes et leurs dossiers correspondants pour les fichiers audio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="new-city-display">Nom d'affichage</Label>
                    <Input 
                      id="new-city-display"
                      value={newCityDisplayName}
                      onChange={(e) => setNewCityDisplayName(e.target.value)}
                      placeholder="Ex: Paris (sera affiché dans l'interface)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-city-folder">Nom du dossier</Label>
                    <Input 
                      id="new-city-folder"
                      value={newCityFolderName}
                      onChange={(e) => setNewCityFolderName(e.target.value)}
                      placeholder="Ex: paris (nom du dossier réel)"
                    />
                  </div>
                  <div className="pt-8">
                    <Button onClick={handleAddCity}>Ajouter la ville</Button>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Villes disponibles</h3>
                  <div className="border rounded-md divide-y">
                    {settings.cities && Array.isArray(settings.cities) && settings.cities.length > 0 ? 
                      (settings.cities as CityFolder[]).map((city) => (
                        <div key={city.folderName} className="p-4 flex justify-between items-center">
                          <div>
                            <p className="font-medium">{city.displayName}</p>
                            <p className="text-sm text-muted-foreground">
                              Dossier: {city.folderName}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setEditingCity({...city});
                                    setOriginalFolderName(city.folderName);
                                  }}
                                >
                                  Modifier
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                  <DialogTitle>Modifier la ville</DialogTitle>
                                  <DialogDescription>
                                    Modifier le nom d'affichage et le nom du dossier
                                  </DialogDescription>
                                </DialogHeader>
                                {editingCity && (
                                  <div className="grid gap-4 py-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-city-display">Nom d'affichage</Label>
                                      <Input
                                        id="edit-city-display"
                                        value={editingCity.displayName}
                                        onChange={(e) => setEditingCity({
                                          ...editingCity,
                                          displayName: e.target.value
                                        })}
                                        placeholder="Nom affiché dans l'interface"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-city-folder">Nom du dossier</Label>
                                      <Input
                                        id="edit-city-folder"
                                        value={editingCity.folderName}
                                        onChange={(e) => setEditingCity({
                                          ...editingCity,
                                          folderName: e.target.value
                                        })}
                                        placeholder="Nom du dossier réel"
                                      />
                                    </div>
                                  </div>
                                )}
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="outline">Annuler</Button>
                                  </DialogClose>
                                  <DialogClose asChild>
                                    <Button onClick={handleUpdateCity}>Enregistrer</Button>
                                  </DialogClose>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleRemoveCity(city.folderName)}
                            >
                              Supprimer
                            </Button>
                          </div>
                        </div>
                      )) : (
                        <div className="p-4 text-center text-muted-foreground">
                          Aucune ville configurée
                        </div>
                      )
                    }
                  </div>
                </div>
                
                <div className="pt-2">
                  <Button onClick={handleSaveSettings}>Enregistrer les modifications</Button>
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


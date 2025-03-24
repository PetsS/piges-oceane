
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Login = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Since we're using .htaccess for authentication, redirect directly to the main page
    navigate("/");
  }, [navigate]);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-secondary/20">
      <div className="container max-w-md mx-auto">
        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Redirection</CardTitle>
            <CardDescription className="text-center">
              Vous êtes en cours de redirection vers l'application
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            Si vous n'êtes pas redirigé automatiquement, veuillez vérifier votre configuration .htaccess
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;

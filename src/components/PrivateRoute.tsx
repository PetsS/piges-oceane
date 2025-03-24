
import React from "react";

interface PrivateRouteProps {
  children: React.ReactNode;
}

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  // Since authentication is handled by htaccess, we simply render the children
  return <>{children}</>;
};

export default PrivateRoute;

import { useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "./auth-context";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoggedIn } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // Kullanıcı giriş yapmamışsa login sayfasına yönlendir
    if (!isLoggedIn && location !== "/login") {
      setLocation("/login");
    }
  }, [isLoggedIn, location, setLocation]);

  // Yönlendirme sırasında bir yükleme göstergesi göster
  if (!isLoggedIn && location !== "/login") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
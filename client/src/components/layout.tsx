import Sidebar from "./sidebar";
import { ReactNode, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { ROUTES } from "@/routes";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const { isLoggedIn } = useAuth();
  const [isLoginRoute] = useRoute(ROUTES.LOGIN);
  
  // Eğer giriş yapmamışsa ve login sayfasında değilse, login sayfasına yönlendir
  useEffect(() => {
    if (!isLoggedIn && !isLoginRoute) {
      setLocation(ROUTES.LOGIN);
    }
  }, [isLoggedIn, isLoginRoute, setLocation]);
  
  // Sidebar gösterme durumu
  const showSidebar = isLoggedIn && !isLoginRoute;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-discord-darker text-white">
      {showSidebar && <Sidebar />}
      <div className={`${showSidebar ? 'flex-1' : 'w-full'} overflow-auto`}>
        {children}
      </div>
    </div>
  );
}

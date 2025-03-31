import Sidebar from "./sidebar";
import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { isLoggedIn } = useAuth();
  
  // Eğer giriş yapmamışsa veya login sayfasındaysa Sidebar gösterme
  const showSidebar = isLoggedIn && location !== "/login";

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-discord-darker text-white">
      {showSidebar && <Sidebar />}
      <div className={`${showSidebar ? 'flex-1' : 'w-full'} overflow-auto`}>
        {children}
      </div>
    </div>
  );
}

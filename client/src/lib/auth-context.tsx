import { createContext, useContext, useEffect, useState, ReactNode } from "react";

// Admin tipini tanımla
export interface Admin {
  id: number;
  username: string;
  displayName: string;
  role: string;
}

// Auth context tipini tanımla
type AuthContextType = {
  isLoggedIn: boolean;
  admin: Admin | null;
  login: (adminData?: Admin) => void;
  logout: () => void;
  updateAdmin: (displayName: string) => void; // Yeni fonksiyon: admin bilgilerini güncelleme
};

// Context'i oluştur
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider bileşeni
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [admin, setAdmin] = useState<Admin | null>(null);

  // İlk yüklendiğinde localStorage'dan oturum durumunu kontrol et
  useEffect(() => {
    const loggedIn = localStorage.getItem("isLoggedIn") === "true";
    const savedAdmin = localStorage.getItem("admin");
    if (savedAdmin) {
      try {
        setAdmin(JSON.parse(savedAdmin));
      } catch (e) {
        console.error("Admin verisi çözümlenemedi:", e);
      }
    }
    setIsLoggedIn(loggedIn);
  }, []);

  // Giriş fonksiyonu
  const login = (adminData?: Admin) => {
    localStorage.setItem("isLoggedIn", "true");
    if (adminData) {
      localStorage.setItem("admin", JSON.stringify(adminData));
      setAdmin(adminData);
    }
    setIsLoggedIn(true);
  };

  // Çıkış fonksiyonu
  const logout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("admin");
    setAdmin(null);
    setIsLoggedIn(false);
  };
  
  // Admin bilgilerini güncelleme fonksiyonu
  const updateAdmin = (displayName: string) => {
    if (!admin) return;
    
    // Admin nesnesini güncelle
    const updatedAdmin = {
      ...admin,
      displayName
    };
    
    // State ve localStorage'u güncelle
    setAdmin(updatedAdmin);
    localStorage.setItem("admin", JSON.stringify(updatedAdmin));
    
    // API'ye güncelleme isteği gönder
    fetch('/api/admin/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ displayName }),
    }).catch(error => {
      console.error('Admin profili güncellenirken hata:', error);
    });
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, admin, login, logout, updateAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
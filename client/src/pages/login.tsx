import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { login, isLoggedIn } = useAuth();
  
  // Eğer kullanıcı zaten giriş yapmışsa anasayfaya yönlendir
  useEffect(() => {
    if (isLoggedIn && location === "/login") {
      setLocation("/");
    }
  }, [isLoggedIn, location, setLocation]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Basit şifre doğrulama - gerçek bir sunucu API'si olmadığından
    // doğrudan client tarafında kontrol ediyoruz (üretimde bu güvenli değildir)
    setTimeout(() => {
      if (password === "horno1234") {
        // Giriş başarılı
        login(); // Auth context'i güncelleyelim
        toast({
          title: "Giriş Başarılı",
          description: "Yönetim paneline yönlendiriliyorsunuz",
        });
        setLocation("/");
      } else {
        // Giriş başarısız
        toast({
          title: "Giriş Başarısız",
          description: "Girdiğiniz şifre yanlış",
          variant: "destructive",
        });
        setIsLoading(false);
      }
    }, 1000);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Yönetici Girişi</CardTitle>
          <CardDescription>
            Bot yönetim paneline erişmek için giriş yapın
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="password">Şifre</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Yönetici şifrenizi girin"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <CardFooter className="flex justify-end gap-2 px-0 pt-6">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Giriş Yapılıyor
                  </>
                ) : (
                  "Giriş Yap"
                )}
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
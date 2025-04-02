import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth-context';

interface Admin {
  id: number;
  username: string;
  displayName: string;
  role: string;
}

interface ChatMessage {
  id: number;
  content: string;
  createdAt: string;
  admin: Admin;
}

const AdminChatPage = () => {
  const { toast } = useToast();
  const { admin, updateAdmin } = useAuth();
  const [message, setMessage] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isProfileSet, setIsProfileSet] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Mesajları yükle
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['/api/chat/messages'],
    queryFn: async () => {
      const response = await fetch('/api/chat/messages');
      if (!response.ok) {
        throw new Error('Mesajlar yüklenemedi');
      }
      return response.json() as Promise<ChatMessage[]>;
    },
    refetchInterval: 1000 // Her 1 saniyede bir yenile (daha hızlı güncelleme)
  });
  
  // Mesaj gönder
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest('/api/chat/messages', 'POST', { 
        content
      });
    },
    onSuccess: () => {
      // Gönderim başarılı
      setMessage(''); // input alanını temizle
      // Cache'i güncelle - hemen yeni mesajlar yükle
      queryClient.invalidateQueries({ queryKey: ['/api/chat/messages'] });
      
      // Gönderimden sonra anında kaydır
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 100);
    },
    onError: (error) => {
      toast({
        title: 'Hata',
        description: 'Mesaj gönderilemedi: ' + String(error),
        variant: 'destructive'
      });
    }
  });
  
  // Mesaj gönderme işlemi
  const handleSendMessage = () => {
    if (message.trim() === '') return;
    sendMessageMutation.mutate(message);
  };
  
  // Enter tuşu ile gönderme
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // Mesajlar geldiğinde otomatik aşağı kaydır
  useEffect(() => {
    // Yeni mesaj geldiğinde anında ve her zaman aşağı kaydır
    if (messagesEndRef.current) {
      // Daha hızlı scroll için davranışı değiştir
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages]);
  
// Profil ayarlama
  const handleSetProfile = () => {
    if (displayName.trim().length < 3) {
      toast({
        title: "Hata",
        description: "İsim en az 3 karakter olmalıdır",
        variant: "destructive",
      });
      return;
    }
    
    // Hem localStorage'a kaydet hem de auth context'i güncelle
    localStorage.setItem('admin_display_name', displayName);
    setIsProfileSet(true);
    
    // Auth context üzerinden admin profilini güncelle
    if (admin) {
      // API üzerinden admin bilgilerini güncelle
      updateAdmin(displayName);
      
      toast({
        title: "Başarılı",
        description: "Sohbet isminiz güncellendi ve kaydedildi!",
      });
    } else {
      toast({
        title: "Uyarı",
        description: "İsminiz yerel olarak kaydedildi fakat oturum açılmadığı için sunucuya kaydedilemedi.",
        variant: "default",
      });
    }
  };

  // Sayfayı ziyaret ettiğinde isim kontrolü yapalım
  useEffect(() => {
    // Admin context'ten displayName'i al, yoksa localStorage'dan
    if (admin?.displayName) {
      setDisplayName(admin.displayName);
      setIsProfileSet(true);
    } else {
      const savedName = localStorage.getItem('admin_display_name');
      if (savedName) {
        setDisplayName(savedName);
        setIsProfileSet(true);
      }
    }
  }, [admin]);

  // Kullanıcı isim girmediyse önce isim formu gösterelim
  if (!isProfileSet) {
    return (
      <div className="container mx-auto py-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Profilinizi Ayarlayın</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Sohbette görünecek isminiz</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="İsminizi girin"
                  className="w-full"
                />
              </div>
              <Button onClick={handleSetProfile} disabled={displayName.trim().length < 3}>
                Sohbete Başla
              </Button>
              
              <div className="text-xs text-gray-400 mt-2">
                <p>İsim en az 3 karakter olmalıdır. Bu isim diğer adminler tarafından görülecektir.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl font-bold">Admin Sohbet</CardTitle>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 bg-gray-800 p-2 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                {displayName.charAt(0)}
              </div>
              <span className="font-semibold">{displayName}</span>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsProfileSet(false)}
            >
              Değiştir
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-800 rounded-lg p-4 mb-4 h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <p>Henüz mesaj yok</p>
                <p className="text-sm mt-2">İlk mesajı gönderen siz olun!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Mesajları tersten sırala - en yeni mesajlar en altta gösterilsin */}
                {[...messages].sort((a, b) => 
                  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                ).map((msg) => (
                  <div key={`msg-${msg.id}`} className="flex flex-col">
                    <div className="flex items-center mb-1">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                        {msg.admin.displayName.charAt(0)}
                      </div>
                      <div className="ml-2">
                        <span className="font-semibold">{msg.admin.displayName}</span>
                        <span className="text-gray-400 text-xs ml-2">
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-3 ml-10">
                      {msg.content}
                    </div>
                  </div>
                ))}
                {/* Mesaj sayfasının en alt noktasına referans */}
                <div ref={messagesEndRef} style={{ height: '1px', margin: '0' }} />
              </div>
            )}
          </div>
          
          <Separator className="my-4" />
          
          <div className="flex items-start space-x-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Mesajınızı yazın..."
              className="flex-1 h-20"
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={sendMessageMutation.isPending || message.trim() === ''}
              className="h-20"
            >
              {sendMessageMutation.isPending ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              ) : (
                'Gönder'
              )}
            </Button>
          </div>
          
          <div className="text-xs text-gray-400 mt-2">
            <p>Not: Enter tuşuna basarak mesaj gönderebilirsiniz. Yeni satır için Shift+Enter kullanın.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminChatPage;
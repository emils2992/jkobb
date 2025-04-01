
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { PlayerStats } from "@/lib/types";
import { apiRequest } from "@/lib/queryClient";
import { Bot, Send, User } from "lucide-react";

interface Message {
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'bot', 
      content: 'Merhaba! Ben Halısaha Asistanı. Oyuncuların nitelikleri, antrenmanları veya takım hakkında sorular sorabilirsin.',
      timestamp: new Date()
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Oyuncu istatistiklerini çek
  const { data: playersStats } = useQuery<PlayerStats[]>({
    queryKey: ['/api/players/stats'],
  });

  // İlgili veriler hazır olduğunda, chatbot context verisini hazırla
  const prepareBotContext = () => {
    if (!playersStats) return "Henüz veri yok.";
    
    return playersStats.map(player => {
      const topAttributes = [...player.attributes]
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
        
      return `Oyuncu: ${player.user.username}
Toplam Nitelik: ${player.totalValue}
Haftalık Nitelik: ${player.weeklyValue}
En İyi Nitelikleri: ${topAttributes.map(attr => `${attr.name}: ${attr.value}`).join(', ')}`;
    }).join('\n\n');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return;
    
    // Kullanıcı mesajını ekle
    const userMessage: Message = {
      role: 'user',
      content: currentMessage,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);

    try {
      // Gerçek bir yapay zeka API'si burada kullanılabilir
      // Şu an için sadece basit yanıtlar vereceğiz
      const botResponse = await generateResponse(currentMessage, playersStats);
      
      setTimeout(() => {
        setMessages(prev => [...prev, {
          role: 'bot',
          content: botResponse,
          timestamp: new Date()
        }]);
        setIsLoading(false);
      }, 500);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'bot',
        content: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.',
        timestamp: new Date()
      }]);
      setIsLoading(false);
    }
  };

  // Basit yanıt üretme fonksiyonu (gerçek yapay zeka API'si burada kullanılabilir)
  const generateResponse = async (message: string, stats?: PlayerStats[]): Promise<string> => {
    message = message.toLowerCase();
    
    if (!stats) return "Henüz oyuncu verisi yüklenmiyor.";

    // Kullanıcının bir oyuncu hakkında soru sorup sormadığını kontrol et
    const playerNameMatch = stats.find(player => 
      message.includes(player.user.username.toLowerCase())
    );

    if (playerNameMatch) {
      if (message.includes("nitelik") || message.includes("stat")) {
        const topAttributes = [...playerNameMatch.attributes]
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);
          
        return `${playerNameMatch.user.username} adlı oyuncunun toplam ${playerNameMatch.totalValue} nitelik puanı var. Bu hafta ${playerNameMatch.weeklyValue} puan kazanmış. En iyi nitelikleri: ${topAttributes.map(attr => `${attr.name}: ${attr.value}`).join(', ')}`;
      }
      
      if (message.includes("antrenman") || message.includes("training")) {
        return `${playerNameMatch.user.username} son antrenmanını ${playerNameMatch.lastFixDate ? new Date(playerNameMatch.lastFixDate).toLocaleDateString('tr-TR') : 'bilinmeyen bir tarihte'} yapmış.`;
      }
      
      return `${playerNameMatch.user.username} adlı oyuncu hakkında ne bilmek istiyorsun? Nitelikleri, antrenmanları veya başka bir şey?`;
    }
    
    // Genel takım istatistikleri
    if (message.includes("en iyi oyuncu") || message.includes("lider")) {
      const bestPlayer = [...stats].sort((a, b) => b.totalValue - a.totalValue)[0];
      return `Şu anda en yüksek nitelik puanına sahip oyuncu ${bestPlayer.totalValue} puanla ${bestPlayer.user.username}.`;
    }
    
    if (message.includes("toplam oyuncu")) {
      return `Sistemde toplam ${stats.length} oyuncu bulunuyor.`;
    }
    
    if (message.includes("bu hafta en çok")) {
      const weeklyBest = [...stats].sort((a, b) => b.weeklyValue - a.weeklyValue)[0];
      return `Bu hafta en çok nitelik puanı kazanan oyuncu ${weeklyBest.weeklyValue} puanla ${weeklyBest.user.username}.`;
    }
    
    if (message.includes("nitelik") && message.includes("toplam")) {
      const totalPoints = stats.reduce((sum, player) => sum + player.totalValue, 0);
      return `Tüm oyuncuların toplam nitelik puanı: ${totalPoints}`;
    }
    
    if (message.includes("nasıl antrenman")) {
      return "Antrenman yapmak için Discord'da antrenman kanalına '1/1 kısa pas' formatında mesaj yazabilirsiniz. İlk sayı süreyi (saat), ikinci sayı yoğunluğu (1-5 arası) belirtir.";
    }

    // Genel yanıtlar
    if (message.includes("merhaba") || message.includes("selam")) {
      return "Merhaba! Size nasıl yardımcı olabilirim?";
    }
    
    if (message.includes("teşekkür")) {
      return "Rica ederim! Başka bir sorunuz var mı?";
    }
    
    return "Bu konu hakkında daha fazla bilgi verebilmek için spesifik bir soru sorabilir misiniz? Oyuncular, nitelikler veya antrenmanlar hakkında sorular sorabilirsiniz.";
  };

  return (
    <>
      <header className="bg-discord-dark p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">Halısaha AI Asistanı</h1>
      </header>

      <div className="container mx-auto p-4 max-w-4xl">
        <Card className="border-discord-dark shadow-lg">
          <CardHeader className="bg-discord-dark">
            <CardTitle className="text-xl text-white flex items-center">
              <Bot className="mr-2 h-6 w-6" />
              Halısaha AI
            </CardTitle>
            <CardDescription className="text-discord-light">
              Nitelikler, antrenmanlar ve daha fazlası hakkında sorular sorun
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-6">
            <div className="h-[60vh] overflow-y-auto mb-4 p-4 bg-gray-900 rounded-lg">
              {messages.map((message, index) => (
                <div key={index} className={`flex mb-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-start max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`p-3 rounded-lg ${message.role === 'user' ? 'bg-discord-blue text-white' : 'bg-gray-800 text-white'}`}>
                      <p className="text-sm">{message.content}</p>
                      <span className="text-xs opacity-70 block mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className={`flex items-center justify-center h-10 w-10 rounded-full ${message.role === 'user' ? 'ml-2 bg-discord-blue' : 'mr-2 bg-discord-dark'}`}>
                      {message.role === 'user' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
              
              {isLoading && (
                <div className="flex justify-start mb-4">
                  <div className="flex items-start">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full mr-2 bg-discord-dark">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="p-3 rounded-lg bg-gray-800 text-white">
                      <p className="text-sm">Yanıt yazılıyor...</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          
          <CardFooter className="border-t border-gray-800 p-4">
            <form 
              className="flex w-full gap-2" 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              <Input
                placeholder="Bir soru sorun..."
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                className="flex-1 bg-gray-800 border-gray-700"
              />
              <Button 
                type="submit" 
                className="bg-discord-blue hover:bg-blue-600"
                disabled={isLoading || !currentMessage.trim()}
              >
                <Send className="h-4 w-4 mr-2" />
                Gönder
              </Button>
            </form>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}

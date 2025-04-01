
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { PlayerStats } from "@/lib/types";
import { apiRequest } from "@/lib/queryClient";
import { Bot, Send, User, Image, BarChart, RefreshCw, FileDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

interface Message {
  role: 'bot' | 'user';
  content: string;
  type?: 'text' | 'image' | 'chart';
  imageUrl?: string;
  chartData?: any[];
}

export default function AiChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'bot',
      content: 'Merhaba! Epic Lig Bot Asistanı olarak size nasıl yardımcı olabilirim? İstatistikler, grafikler veya bilgiler hakkında sorular sorabilirsiniz.',
      type: 'text'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: statsData } = useQuery<PlayerStats[]>({
    queryKey: ['/api/players/stats'],
  });

  const { data: trainingStats } = useQuery<PlayerStats[]>({
    queryKey: ['/api/players/training-stats'],
  });

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      type: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Simüle edilmiş bot cevabı - gerçek projede API'ye istek yapılabilir
    setTimeout(() => {
      const botResponse = generateResponse(input, statsData || [], trainingStats || []);
      setMessages(prev => [...prev, botResponse]);
      setLoading(false);
    }, 1000);
  };

  const generateResponse = (message: string, stats: PlayerStats[], trainingData: PlayerStats[]): Message => {
    message = message.toLowerCase();
    
    // İstatistik isteği
    if (message.includes("istatistik") || message.includes("stat")) {
      if (stats && stats.length > 0) {
        return {
          role: 'bot',
          content: 'İşte oyuncu istatistikleri:',
          type: 'chart',
          chartData: stats.slice(0, 5).map(s => ({
            name: s.user.username,
            value: s.totalValue
          }))
        };
      }
    }
    
    // Antrenman istatistikleri
    if (message.includes("antrenman") && message.includes("istatistik")) {
      if (trainingData && trainingData.length > 0) {
        return {
          role: 'bot',
          content: 'İşte antrenman istatistikleri:',
          type: 'chart',
          chartData: trainingData.slice(0, 5).map(s => ({
            name: s.user.username,
            value: s.totalTrainingValue || 0
          }))
        };
      }
    }
    
    // Görseller
    if (message.includes("görsel") || message.includes("fotograf") || message.includes("fotoğraf") || message.includes("resim")) {
      return {
        role: 'bot',
        content: 'İşte istediğiniz görsel:',
        type: 'image',
        imageUrl: selectRandomImage(message)
      };
    }
    
    // Bu hafta en çok gelişim gösteren
    if (message.includes("bu hafta en çok")) {
      const weeklyBest = [...(stats || [])].sort((a, b) => b.weeklyValue - a.weeklyValue)[0];
      if (weeklyBest) {
        return {
          role: 'bot',
          content: `Bu hafta en çok nitelik puanı kazanan oyuncu ${weeklyBest.weeklyValue} puanla ${weeklyBest.user.username}.`,
          type: 'text'
        };
      }
    }
    
    // Bot bilgisi
    if (message.includes("bot sahibi") || message.includes("sahibin")) {
      return {
        role: 'bot',
        content: 'Bot sahibim emilswd\'dir. Epic Lig discord sunucusunun yöneticisidir.',
        type: 'text'
      };
    }
    
    // Antrenman yapma talimatları
    if (message.includes("nasıl antrenman")) {
      return {
        role: 'bot',
        content: "Antrenman yapmak için Discord'da antrenman kanalına '1/1 kısa pas' formatında mesaj yazabilirsiniz. İlk sayı yoğunluğu (1-5 arası), ikinci sayı süreyi (saat olarak) belirtir. Son kısım ise antrenman niteliğini belirtir (kısa pas, uzun pas, şut, dribling vb).",
        type: 'text'
      };
    }
    
    // Genel yanıt
    return {
      role: 'bot',
      content: 'Üzgünüm, bu konuda bilgim yok. İstatistikler, antrenmanlar, bot sahibi veya Discord hakkında sorular sorabilirsiniz.',
      type: 'text'
    };
  };

  const selectRandomImage = (query: string): string => {
    const discordImages = [
      "/assets/Screenshot_2025-03-31-19-22-23-846_com.discord.jpg",
      "/assets/Screenshot_2025-04-01-01-29-43-114_com.discord.jpg",
      "/assets/Screenshot_2025-04-01-03-45-40-234_com.discord.jpg",
      "/assets/Screenshot_2025-04-01-13-09-11-178_com.discord.jpg",
      "/assets/Screenshot_2025-04-01-13-57-39-014_com.discord.jpg"
    ];
    
    // Random görsel seç
    const randomIndex = Math.floor(Math.random() * discordImages.length);
    return discordImages[randomIndex];
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMessageContent = (message: Message) => {
    if (message.type === 'image' && message.imageUrl) {
      return (
        <div className="mt-2">
          <p>{message.content}</p>
          <div className="mt-2 relative rounded-lg overflow-hidden">
            <img 
              src={message.imageUrl} 
              alt="Discord görüntüsü" 
              className="w-full max-w-md rounded-lg border border-gray-700"
            />
            <Button 
              size="sm" 
              variant="secondary"
              className="absolute bottom-2 right-2 bg-discord-darker bg-opacity-70"
              onClick={() => window.open(message.imageUrl, '_blank')}
            >
              <FileDown className="h-4 w-4 mr-1" />
              İndir
            </Button>
          </div>
        </div>
      );
    } else if (message.type === 'chart' && message.chartData) {
      return (
        <div className="mt-2">
          <p>{message.content}</p>
          <div className="mt-2 bg-discord-darker p-4 rounded-lg">
            <div className="h-64 w-full">
              {message.chartData.map((item, index) => (
                <div key={index} className="flex items-center mb-2">
                  <span className="w-24 truncate text-sm">{item.name}</span>
                  <div className="flex-1 mx-2">
                    <div 
                      className="bg-discord-blue h-6 rounded"
                      style={{ width: `${Math.min(100, (item.value / 100) * 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-right text-sm font-mono">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    } else {
      return <p>{message.content}</p>;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="bg-discord-dark p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">Epic Lig AI Asistanı</h1>
        <p className="text-discord-light text-sm">
          Bot sahibi: emilswd
        </p>
      </header>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto">
          <Tabs defaultValue="chat">
            <TabsList className="mb-4">
              <TabsTrigger value="chat">AI Sohbet</TabsTrigger>
              <TabsTrigger value="help">Yardım</TabsTrigger>
            </TabsList>
            
            <TabsContent value="chat" className="space-y-4">
              <div className="space-y-4 pb-20">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`flex max-w-[80%] ${
                        message.role === 'user'
                          ? 'bg-discord-blue rounded-tl-xl rounded-bl-xl rounded-br-xl'
                          : 'bg-discord-darker rounded-tr-xl rounded-br-xl rounded-bl-xl'
                      } p-3`}
                    >
                      <div className="flex-shrink-0 mr-3">
                        {message.role === 'user' ? (
                          <User className="h-6 w-6 text-white" />
                        ) : (
                          <Bot className="h-6 w-6 text-discord-blue" />
                        )}
                      </div>
                      <div className="flex-1">
                        {renderMessageContent(message)}
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-discord-darker rounded-tr-xl rounded-br-xl rounded-bl-xl p-3">
                      <div className="flex items-center space-x-2">
                        <Bot className="h-6 w-6 text-discord-blue" />
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-discord-blue rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                          <div className="w-2 h-2 bg-discord-blue rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-2 h-2 bg-discord-blue rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </TabsContent>
            
            <TabsContent value="help">
              <Card>
                <CardHeader>
                  <CardTitle>AI Asistan Nasıl Kullanılır?</CardTitle>
                  <CardDescription>
                    Epic Lig AI Asistanına sorabileceğiniz sorular ve komutlar
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-bold flex items-center">
                      <BarChart className="mr-2 h-5 w-5 text-discord-blue" />
                      İstatistikler
                    </h3>
                    <p className="text-discord-light text-sm mt-1">
                      "İstatistikleri göster", "Antrenman istatistiklerini göster", "Bu hafta en çok gelişim gösteren kim?"
                    </p>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="font-bold flex items-center">
                      <Image className="mr-2 h-5 w-5 text-discord-green" />
                      Görseller
                    </h3>
                    <p className="text-discord-light text-sm mt-1">
                      "Discord görsellerini göster", "Antrenman fotoğrafı göster"
                    </p>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="font-bold flex items-center">
                      <RefreshCw className="mr-2 h-5 w-5 text-discord-yellow" />
                      Yardım & Bilgi
                    </h3>
                    <p className="text-discord-light text-sm mt-1">
                      "Nasıl antrenman yapılır?", "Bot sahibi kim?", "Nitelikler nasıl kazanılır?"
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      <div className="p-4 absolute bottom-0 left-0 right-0 bg-discord-dark border-t border-gray-800">
        <div className="max-w-3xl mx-auto flex">
          <Input
            className="flex-1 bg-discord-darker border-gray-700"
            placeholder="Bir soru sorun veya komut yazın..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <Button 
            className="ml-2 bg-discord-blue hover:bg-blue-600"
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

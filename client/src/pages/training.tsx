import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { PlayerStats, Ticket } from "@/lib/types";
import { DumbbellIcon, Users, Clock, TrendingUp } from "lucide-react";

interface TrainingSession {
  id: number;
  userId: string;
  attributeName: string;
  duration: number;
  intensity: number;
  attributesGained: number;
  createdAt: string;
  source: string;
}

interface UserWithSessions {
  user: {
    userId: string;
    username: string;
    avatarUrl: string;
  };
  sessions: TrainingSession[];
}

export default function TrainingPage() {
  const { toast } = useToast();
  
  // Tüm nitelikler (ticket + antrenman) için
  const { data: playersStats } = useQuery<PlayerStats[]>({
    queryKey: ['/api/players/stats'],
  });
  
  // Sadece antrenman kaynaklı nitelikler için
  const { data: trainingStats } = useQuery<PlayerStats[]>({
    queryKey: ['/api/players/training-stats'],
  });

  const { data: userSessions } = useQuery<UserWithSessions[]>({
    queryKey: ['/api/training-sessions'],
  });

  // Sadece gerçek antrenman türündeki oturumları filtrele (ticket olmayan antrenmanlar)
  const messageSessions = userSessions?.flatMap(userSession => 
    userSession.sessions.filter(session => session.source === 'message' || session.source === 'training')
  ) || [];

  // Tüm antrenman süresini hesapla
  const totalTrainingDuration = messageSessions.reduce(
    (total, session) => total + session.duration, 0
  );

  // Sadece antrenman kaynaklı nitelikleri hesapla
  const totalTrainingAttributes = trainingStats?.reduce((total: number, player: PlayerStats) => 
    total + player.weeklyValue, 0
  ) || 0;

  const handleTrainingCommand = () => {
    toast({
      title: "Discord Antrenman Formatı",
      description: "Antrenman yapmak için antrenman kanalında şu formatta mesaj yazın: '1/1 kısa pas'",
    });
  };

  // Sadece antrenman kaynaklı niteliklere göre sıralama
  const topPlayers = [...(trainingStats || [])].sort((a: PlayerStats, b: PlayerStats) => b.weeklyValue - a.weeklyValue).slice(0, 10);

  return (
    <>
      <header className="bg-discord-dark p-4 border-b border-gray-800 flex justify-between items-center">
        <h1 className="text-xl font-bold">Antrenman Takibi</h1>
        <Button 
          onClick={handleTrainingCommand}
          className="bg-discord-blue hover:bg-blue-600"
        >
          <DumbbellIcon className="h-4 w-4 mr-2" />
          Antrenman Nasıl Yapılır?
        </Button>
      </header>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Users className="mr-2 h-5 w-5 text-discord-blue" />
                Toplam Antrenman
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{messageSessions.length}</p>
              <p className="text-discord-light text-sm">Toplam kaydedilen antrenmanlar</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Clock className="mr-2 h-5 w-5 text-discord-yellow" />
                Toplam Antrenman Süresi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalTrainingDuration} saat</p>
              <p className="text-discord-light text-sm">Toplam antrenman süresi</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <TrendingUp className="mr-2 h-5 w-5 text-discord-green" />
                Gelişim Puanları
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {totalTrainingAttributes}
              </p>
              <p className="text-discord-light text-sm">Sadece antrenman kaynaklı gelişim puanları</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="training-leaderboard">
          <TabsList className="mb-4">
            <TabsTrigger value="training-leaderboard">Haftalık Lider Tablosu</TabsTrigger>
            <TabsTrigger value="history">Antrenman Geçmişi</TabsTrigger>
          </TabsList>
          
          <TabsContent value="training-leaderboard">
            <Card>
              <CardHeader>
                <CardTitle>Haftalık Lider Tablosu</CardTitle>
                <p className="text-sm text-discord-light">Sadece antrenman kaynaklı gelişim puanları</p>
              </CardHeader>
              <CardContent>
                {topPlayers.length > 0 ? (
                  <div className="space-y-4">
                    {topPlayers.map((player, index) => {
                      // Bu oyuncunun yaptığı antrenman sayısını bul
                      const userTrainingCount = userSessions?.find(
                        us => us.user.userId === player.user.userId
                      )?.sessions.filter(s => s.source === 'message').length || 0;
                      
                      return (
                        <div key={player.user.userId} className="flex items-center justify-between p-3 bg-discord-darker rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 flex items-center justify-center bg-discord-blue rounded-full font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium">{player.user.username}</div>
                              <div className="text-sm text-discord-light">Antrenman: {userTrainingCount}</div>
                            </div>
                          </div>
                          <div className="text-xl font-bold text-discord-blue">+{player.weeklyValue}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-discord-light">
                    Henüz hiç oyuncu antrenman kaydı yok.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Antrenman Geçmişi</CardTitle>
              </CardHeader>
              <CardContent>
                {messageSessions.length > 0 ? (
                  <div className="space-y-4">
                    {messageSessions.slice(0, 20).map((session, index) => {
                      // Bu oturuma ait kullanıcıyı bul
                      const sessionUser = userSessions?.find(us => 
                        us.sessions.some(s => s.id === session.id)
                      )?.user;
                      
                      return (
                        <div key={index} className="p-4 bg-discord-darker rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-medium">{sessionUser?.username || "Unknown User"}</h3>
                              <p className="text-sm text-discord-light">
                                {new Date(session.createdAt).toLocaleDateString('tr-TR')}
                              </p>
                            </div>
                            <span className="px-2 py-1 text-xs bg-blue-500 bg-opacity-20 text-blue-400 rounded-full">
                              {session.attributeName}
                            </span>
                          </div>
                          
                          <div className="bg-gray-800 rounded p-3">
                            <h4 className="text-xs uppercase font-bold text-discord-light mb-2">Antrenman Detayları</h4>
                            <div className="flex justify-between mb-1 text-sm">
                              <span>Süre</span>
                              <span>{session.duration} saat</span>
                            </div>
                            <div className="flex justify-between mb-1 text-sm">
                              <span>Yoğunluk</span>
                              <span>{session.intensity}/5</span>
                            </div>
                            <div className="flex justify-between mb-1 text-sm">
                              <span>Kazanılan Puan</span>
                              <span>+{session.attributesGained}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {messageSessions.length > 20 && (
                      <div className="text-center text-discord-light">
                        <p>Toplam {messageSessions.length} antrenman kaydından 20 tanesi gösteriliyor.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-discord-light">
                    Henüz hiç antrenman kaydı yok.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { PlayerStats, Ticket } from "@/lib/types";
import { DumbbellIcon, Users, Clock, TrendingUp } from "lucide-react";

export default function TrainingPage() {
  const { toast } = useToast();
  
  const { data: playersStats } = useQuery<PlayerStats[]>({
    queryKey: ['/api/players/stats'],
  });

  const { data: tickets } = useQuery<Ticket[]>({
    queryKey: ['/api/tickets'],
  });

  const trainingTickets = tickets?.filter(ticket => ticket.type === 'training') || [];

  const handleTrainingCommand = () => {
    toast({
      title: "Discord Komutu",
      description: "Antreman kaydetmek için Discord'da /antrenman komutunu kullanın",
    });
  };

  const topPlayers = [...(playersStats || [])].sort((a, b) => b.weeklyValue - a.weeklyValue).slice(0, 5);

  return (
    <>
      <header className="bg-discord-dark p-4 border-b border-gray-800 flex justify-between items-center">
        <h1 className="text-xl font-bold">Antrenman Takibi</h1>
        <Button 
          onClick={handleTrainingCommand}
          className="bg-discord-blue hover:bg-blue-600"
        >
          <DumbbellIcon className="h-4 w-4 mr-2" />
          Antrenman Kaydet
        </Button>
      </header>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Users className="mr-2 h-5 w-5 text-discord-blue" />
                Aktif Antrenman
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{trainingTickets.length}</p>
              <p className="text-discord-light text-sm">Bu hafta kaydedilen antrenmanlar</p>
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
              <p className="text-3xl font-bold">120 dk</p>
              <p className="text-discord-light text-sm">Bu hafta toplam antrenman süresi</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <TrendingUp className="mr-2 h-5 w-5 text-discord-green" />
                Kazanılan Nitelikler
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {playersStats?.reduce((sum, player) => sum + player.weeklyValue, 0) || 0}
              </p>
              <p className="text-discord-light text-sm">Bu hafta kazanılan toplam nitelik</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="leaderboard">
          <TabsList className="mb-4">
            <TabsTrigger value="leaderboard">Lider Tablosu</TabsTrigger>
            <TabsTrigger value="history">Antrenman Geçmişi</TabsTrigger>
          </TabsList>
          
          <TabsContent value="leaderboard">
            <Card>
              <CardHeader>
                <CardTitle>Haftalık Lider Tablosu</CardTitle>
              </CardHeader>
              <CardContent>
                {topPlayers.length > 0 ? (
                  <div className="space-y-4">
                    {topPlayers.map((player, index) => (
                      <div key={player.user.userId} className="flex items-center justify-between p-3 bg-discord-darker rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 flex items-center justify-center bg-discord-blue rounded-full font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{player.user.username}</div>
                            <div className="text-sm text-discord-light">#{player.user.userId.slice(0, 4)}</div>
                          </div>
                        </div>
                        <div className="text-xl font-bold text-discord-blue">+{player.weeklyValue}</div>
                      </div>
                    ))}
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
                {trainingTickets.length > 0 ? (
                  <div className="space-y-4">
                    {trainingTickets.map((ticket) => (
                      <div key={ticket.ticketId} className="p-4 bg-discord-darker rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-medium">{ticket.user?.username || "Unknown User"}</h3>
                            <p className="text-sm text-discord-light">
                              {new Date(ticket.createdAt).toLocaleDateString('tr-TR')}
                            </p>
                          </div>
                          <span className="px-2 py-1 text-xs bg-blue-500 bg-opacity-20 text-blue-400 rounded-full">
                            Antrenman
                          </span>
                        </div>
                        
                        <div className="bg-gray-800 rounded p-3">
                          <h4 className="text-xs uppercase font-bold text-discord-light mb-2">Antrenman Kaydı</h4>
                          <div className="flex justify-between mb-1 text-sm">
                            <span>Süre</span>
                            <span>45 dakika</span>
                          </div>
                          <div className="flex justify-between mb-1 text-sm">
                            <span>Kazanılan Nitelik</span>
                            <span>+3</span>
                          </div>
                        </div>
                      </div>
                    ))}
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

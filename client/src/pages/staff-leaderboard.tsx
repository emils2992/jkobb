
import { useQuery } from "@tanstack/react-query";
import { Crown, Smile, Award, Star, Shield, User, Loader2 } from "lucide-react";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface StaffStat {
  user: {
    userId: string;
    username: string;
    avatarUrl?: string;
  };
  closedCount: number;
}

export default function StaffLeaderboard() {
  const { data: staffStats, isLoading, error } = useQuery<StaffStat[]>({
    queryKey: ['/api/staff/leaderboard'],
    refetchInterval: 60000 // Her dakika yenile
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin h-10 w-10 text-[#5865F2]" />
        <span className="ml-2 text-lg">Yetkili istatistikleri yükleniyor...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4">
        Yetkili istatistikleri yüklenirken bir hata oluştu: {(error as Error).message}
      </div>
    );
  }

  if (!staffStats || staffStats.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="text-4xl mb-4">🏆</div>
        <h3 className="text-xl font-medium mb-2">Henüz Veri Yok</h3>
        <p className="text-discord-light mb-6">
          Şu ana kadar hiçbir yetkili ticket kapatmamış. İlk yetkili siz olun!
        </p>
      </div>
    );
  }

  // İlk 3 kişi için özel ikonlar
  const getIconForRank = (rank: number) => {
    switch (rank) {
      case 0: return <Crown className="h-6 w-6 text-yellow-400" />;
      case 1: return <Award className="h-6 w-6 text-gray-400" />;
      case 2: return <Star className="h-6 w-6 text-amber-700" />;
      default: return <Shield className="h-5 w-5 text-discord-blue" />;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold gradient-text mb-2">Yetkili Leaderboard</h1>
        <p className="text-discord-light">
          En çok ticket kapatan yetkililer burada listelenir. Sıralamada üst sıralara çıkmak için daha fazla ticket kapatın!
        </p>
      </div>

      {/* Üst 3 Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {staffStats.slice(0, 3).map((stat, index) => (
          <Card key={stat.user.userId} className={`
            hover-scale 
            ${index === 0 ? 'bg-gradient-to-br from-yellow-900/20 to-yellow-500/20 border-yellow-500/40' : ''} 
            ${index === 1 ? 'bg-gradient-to-br from-gray-900/20 to-gray-400/20 border-gray-400/40' : ''} 
            ${index === 2 ? 'bg-gradient-to-br from-amber-900/20 to-amber-700/20 border-amber-700/40' : ''} 
          `}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl flex items-center gap-2">
                  {getIconForRank(index)}
                  {index === 0 ? '🥇 Altın' : index === 1 ? '🥈 Gümüş' : '🥉 Bronz'}
                </CardTitle>
                <div className="text-2xl font-bold text-[#5865F2]">#{index + 1}</div>
              </div>
              <CardDescription>
                Toplam {stat.closedCount} ticket kapatıldı
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-discord-dark flex items-center justify-center overflow-hidden border-2 border-[#5865F2]">
                  {stat.user.avatarUrl ? 
                    <img src={stat.user.avatarUrl} alt={stat.user.username} className="w-full h-full object-cover" /> :
                    <User className="h-6 w-6 text-[#5865F2]" />
                  }
                </div>
                <div>
                  <div className="font-semibold text-lg">{stat.user.username}</div>
                  <div className="text-sm text-discord-light flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Discord ID: {stat.user.userId.slice(0, 8)}...
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tam Sıralama Tablosu */}
      <Card>
        <CardHeader>
          <CardTitle>Tüm Yetkililer Sıralaması</CardTitle>
          <CardDescription>
            Kapatılan ticket sayısına göre sıralanmıştır
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>Epic Lig Yetkili Leaderboard - Toplam {staffStats.length} yetkili</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Sıra</TableHead>
                <TableHead>Yetkili</TableHead>
                <TableHead className="text-right">Kapatılan Ticket</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffStats.map((stat, index) => (
                <TableRow key={stat.user.userId} className={index < 3 ? 'font-medium' : ''}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getIconForRank(index)}
                      {index + 1}
                    </div>
                  </TableCell>
                  <TableCell>{stat.user.username}</TableCell>
                  <TableCell className="text-right">{stat.closedCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PlayerStats } from "@/lib/types";
import { Search } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { FixModal } from "@/components/fix-modal";
import { FixResetModal } from "@/components/fix-reset-modal";

export default function PlayerStatsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFixsonModal, setShowFixsonModal] = useState(false);
  const [showFixresetModal, setShowFixresetModal] = useState(false);
  
  const { data: playersStats, isLoading, error } = useQuery<PlayerStats[]>({
    queryKey: ['/api/players/stats'],
  });

  const filteredPlayers = playersStats?.filter(player => 
    player.user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      accessorKey: "user.username",
      header: "Oyuncu",
      cell: ({ row }: any) => {
        const player = row.original;
        return (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
              {player.user.username.charAt(0).toUpperCase()}
            </div>
            <span>{player.user.username}</span>
          </div>
        );
      }
    },
    {
      accessorKey: "user.userId",
      header: "ID",
      cell: ({ row }: any) => {
        return <span>#{row.original.user.userId.slice(0, 4)}</span>;
      }
    },
    {
      accessorKey: "attributes",
      header: "Nitelikler",
      cell: ({ row }: any) => {
        const attributes = row.original.attributes || [];
        return (
          <div className="max-w-xs overflow-hidden">
            {attributes.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {attributes.map((attr: any, index: number) => (
                  <span key={index} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-discord-blue bg-opacity-20 text-gray-200">
                    {attr.name}: {attr.value}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-gray-500">Nitelik yok</span>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: "weeklyValue",
      header: "Bu Hafta",
      cell: ({ row }: any) => row.original.weeklyValue
    },
    {
      accessorKey: "totalValue",
      header: "Toplam",
      cell: ({ row }: any) => row.original.totalValue
    },
    {
      accessorKey: "lastFixDate",
      header: "Son Fix",
      cell: ({ row }: any) => {
        const date = row.original.lastFixDate;
        if (!date) return "Hiç";
        return new Date(date).toLocaleDateString('tr-TR');
      }
    }
  ];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-10 w-64 bg-gray-700 rounded mb-6"></div>
          <div className="h-80 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-500">
          İstatistikler yüklenirken bir hata oluştu: {(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="bg-discord-dark p-4 border-b border-gray-800 flex justify-between items-center">
        <h1 className="text-xl font-bold">Nitelik İstatistikleri</h1>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Input 
              type="text"
              placeholder="Oyuncu ara..."
              className="bg-gray-700 px-4 py-2 rounded text-sm w-64 focus:outline-none focus:ring-2 focus:ring-discord-blue"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute right-3 top-2.5 text-discord-light h-4 w-4" />
          </div>
        </div>
      </header>

      <div className="p-6">
        <div className="flex gap-4 mb-6">
          <Card className="w-1/2">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Komutlar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <button 
                  onClick={() => setShowFixsonModal(true)}
                  className="w-full text-left flex items-center space-x-2 p-3 rounded hover:bg-gray-700 text-discord-light"
                >
                  <i className="fas fa-terminal w-5"></i>
                  <span>/fixson</span>
                </button>
                <button 
                  onClick={() => setShowFixresetModal(true)}
                  className="w-full text-left flex items-center space-x-2 p-3 rounded hover:bg-gray-700 text-discord-light"
                >
                  <i className="fas fa-redo-alt w-5"></i>
                  <span>/fixreset</span>
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="w-1/2">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Özet</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-discord-light text-sm">Toplam Oyuncu</p>
                  <p className="text-3xl font-bold text-white">{playersStats?.length || 0}</p>
                </div>
                <div>
                  <p className="text-discord-light text-sm">Haftalık Nitelikler</p>
                  <p className="text-3xl font-bold text-discord-blue">
                    {playersStats?.reduce((sum, player) => sum + player.weeklyValue, 0) || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {filteredPlayers && filteredPlayers.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <DataTable columns={columns} data={filteredPlayers} />
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-10">
            <div className="text-4xl mb-4">🏆</div>
            <h3 className="text-xl font-medium mb-2">Hiç oyuncu bulunamadı</h3>
            <p className="text-discord-light mb-6">
              {searchQuery ? 
                "Aramanızla eşleşen bir oyuncu yok. Farklı bir arama terimi deneyin." :
                "Henüz hiç oyuncu kaydedilmemiş. Discord'da /ticket komutunu kullanarak yeni bir ticket oluşturabilirsiniz."
              }
            </p>
          </div>
        )}
      </div>

      <FixModal isOpen={showFixsonModal} onClose={() => setShowFixsonModal(false)} playerStats={filteredPlayers || []} />
      <FixResetModal isOpen={showFixresetModal} onClose={() => setShowFixresetModal(false)} />
    </>
  );
}

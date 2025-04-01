import { useQuery } from "@tanstack/react-query";
import TicketCard from "@/components/ticket-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, BarChart2, Activity } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Ticket } from "@/lib/types";
import { useLocation } from "wouter";
import { ROUTES } from "@/routes";
import LiveChart from "@/components/live-chart";

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const { data: tickets, isLoading, error } = useQuery<Ticket[]>({
    queryKey: ['/api/tickets'],
  });

  const filteredTickets = tickets?.filter(ticket => 
    ticket.ticketId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.user?.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNewTicket = () => {
    toast({
      title: "Not Implemented",
      description: "Bu özellik şu anda sadece Discord bot üzerinden kullanılabilir.",
      variant: "destructive"
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center mb-8 slide-up-animation">
          <div className="inline-block p-4 rounded-full bg-discord-dark glow-animation mb-4">
            <img src="/assets/logo.png" alt="Epic Lig Logo" className="w-16 h-16 rotate-spin-animation" onError={(e) => e.currentTarget.src = "../src/assets/logo.png"} />
          </div>
          <h2 className="text-xl font-bold gradient-text mb-2">Veri Yükleniyor</h2>
          <p className="text-discord-light">Ticketlar hazırlanıyor, lütfen bekleyin...</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div 
              key={i} 
              className="bg-discord-dark rounded-md shadow-lg overflow-hidden h-80 animate-pulse" 
              style={{ 
                animationDelay: `${i * 0.1}s`,
                background: 'linear-gradient(110deg, #2f3136 30%, #36393f 50%, #2f3136 70%)',
                backgroundSize: '200% 100%',
                animation: 'pulse-gradient 1.5s ease-in-out infinite'
              }} 
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-500">
          Biletler yüklenirken bir hata oluştu: {(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="bg-discord-dark p-4 border-b border-gray-800 slide-up-animation">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <img src="/assets/logo.png" alt="Epic Lig Logo" className="w-10 h-10 float-animation" onError={(e) => e.currentTarget.src = "../src/assets/logo.png"} />
            <div>
              <h1 className="text-2xl font-bold gradient-text">Tüm Ticketlar</h1>
              <div className="flex items-center text-sm">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse glow-animation"></span>
                <span className="text-discord-light">Bot Çevrimiçi</span>
                <span className="mx-2 text-discord-light">•</span>
                <span className="text-[#5865F2] fancy-hover"><i className="fas fa-crown text-yellow-400 mr-1 rotate-spin-animation"></i>Epic Lig Yönetim</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3 slide-up-animation" style={{animationDelay: '0.2s'}}>
            <div className="relative">
              <Input 
                type="text"
                placeholder="Ticket ara..."
                className="bg-gray-700 px-4 py-2 rounded text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#3eb8df] hover-scale"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute right-3 top-2.5 text-discord-light h-4 w-4" />
            </div>
            
            <Button 
              className="bg-[#3eb8df] hover:bg-[#2da7ce] hover-scale gradient-border"
              onClick={() => navigate(ROUTES.PLAYER_STATS)}
            >
              <BarChart2 className="h-4 w-4 mr-2" />
              Nitelik İstatistikleri
            </Button>
            
            <Button 
              className="bg-[#3eb8df] hover:bg-[#2da7ce] hover-scale gradient-border"
              onClick={handleNewTicket}
            >
              <Plus className="h-4 w-4 mr-2" />
              Yeni Ticket
            </Button>
          </div>
        </div>
        <p className="text-gray-400 mt-2 slide-up-animation" style={{animationDelay: '0.3s'}}>
          Epic Lig ticket sisteminde tüm açık ve kapalı talepleri görüntüleyip yönetebilirsiniz.
          <span className="ml-2 text-xs bg-discord-blue bg-opacity-20 text-discord-blue px-2 py-1 rounded-full">
            <i className="fas fa-code mr-1"></i>Bot sahibi: <span className="font-bold text-white">emilswd</span>
          </span>
        </p>
      </header>

      <div className="p-6">
        {/* Canlı Aktivite Grafikleri */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6 slide-up-animation">
          <LiveChart 
            title="Son 24 Saat - Ticket Aktivitesi" 
            dataEndpoint="/api/tickets/stats/daily"
            refreshInterval={15000}
            colors={['#3eb8df', '#5865F2', '#43B581', '#FAA61A']}
          />
          
          <LiveChart 
            title="Haftalık Nitelik Dağılımı" 
            dataEndpoint="/api/players/stats/weekly"
            refreshInterval={30000}
            colors={['#5865F2', '#43B581', '#FAA61A', '#ED4245']}
          />
        </div>
        
        {/* Ticket Listesi */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold gradient-text">
            <Activity className="inline-block mr-2 h-5 w-5" />
            Aktif Ticketlar
          </h2>
          <div className="text-sm text-discord-light">
            {filteredTickets?.length || 0} ticket görüntüleniyor
          </div>
        </div>
        
        {filteredTickets && filteredTickets.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredTickets.map(ticket => (
              <TicketCard key={ticket.ticketId} ticket={ticket} />
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <div className="text-4xl mb-4">🎫</div>
            <h3 className="text-xl font-medium mb-2">Hiç ticket bulunamadı</h3>
            <p className="text-discord-light mb-6">
              {searchQuery ? 
                "Aramanızla eşleşen bir ticket yok. Farklı bir arama terimi deneyin." :
                "Şu anda hiçbir ticket bulunmuyor. Discord'da /ticket komutunu kullanarak yenisini oluşturabilirsiniz."
              }
            </p>
          </div>
        )}
      </div>
    </>
  );
}

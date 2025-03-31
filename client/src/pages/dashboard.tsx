import { useQuery } from "@tanstack/react-query";
import TicketCard from "@/components/ticket-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Ticket } from "@/lib/types";

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
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
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-discord-dark rounded-md shadow-lg overflow-hidden h-80 animate-pulse" />
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
      <header className="bg-discord-dark p-4 border-b border-gray-800 flex justify-between items-center">
        <h1 className="text-xl font-bold">Aktif Ticketlar</h1>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Input 
              type="text"
              placeholder="Ticket ara..."
              className="bg-gray-700 px-4 py-2 rounded text-sm w-64 focus:outline-none focus:ring-2 focus:ring-discord-blue"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute right-3 top-2.5 text-discord-light h-4 w-4" />
          </div>
          <Button 
            className="bg-discord-blue hover:bg-blue-600"
            onClick={handleNewTicket}
          >
            <Plus className="h-4 w-4 mr-2" />
            Yeni Ticket
          </Button>
        </div>
      </header>

      <div className="p-6">
        {filteredTickets && filteredTickets.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredTickets.map(ticket => (
              <TicketCard key={ticket.ticketId} ticket={ticket} />
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <div className="text-4xl mb-4">🎫</div>
            <h3 className="text-xl font-medium mb-2">Hiç aktif ticket bulunamadı</h3>
            <p className="text-discord-light mb-6">
              {searchQuery ? 
                "Aramanızla eşleşen bir ticket yok. Farklı bir arama terimi deneyin." :
                "Şu anda aktif bir ticket bulunmuyor. Discord'da /ticket komutunu kullanarak yenisini oluşturabilirsiniz."
              }
            </p>
          </div>
        )}
      </div>
    </>
  );
}

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Edit, MoreVertical } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Ticket, AttributeRequest } from "@/lib/types";
import { useState } from "react";
import { EditTicketModal } from "./edit-ticket-modal";

interface TicketCardProps {
  ticket: Ticket;
}

export default function TicketCard({ ticket }: TicketCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showEditModal, setShowEditModal] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: async (requestId: number) => {
      return apiRequest("PATCH", `/api/attribute-requests/${requestId}`, { approved: true });
    },
    onSuccess: () => {
      toast({
        title: "Nitelik onaylandı",
        description: "Nitelik talebi başarıyla onaylandı.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Nitelik onaylanırken bir hata oluştu.",
        variant: "destructive",
      });
    }
  });

  const handleApprove = () => {
    // Discord bot olmadan da onaylama yapabilmek için
    if (ticket.attributeRequests && ticket.attributeRequests.length > 0) {
      const requestId = ticket.attributeRequests[0].id;
      mutate(requestId);
    } else {
      toast({
        title: "Hata",
        description: "Onaylanacak nitelik talebi bulunamadı.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = () => {
    setShowEditModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-500 bg-opacity-20 text-green-400';
      case 'pending': return 'bg-yellow-500 bg-opacity-20 text-yellow-400';
      case 'closed': return 'bg-red-500 bg-opacity-20 text-red-400';
      default: return 'bg-blue-500 bg-opacity-20 text-blue-400';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-400';
      case 'pending': return 'bg-yellow-400';
      case 'closed': return 'bg-red-400';
      default: return 'bg-blue-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open': return 'Açık';
      case 'pending': return 'Beklemede';
      case 'closed': return 'Kapalı';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    });
  };

  return (
    <>
      <Card className={`bg-discord-dark rounded-md shadow-lg overflow-hidden slide-up-animation hover-scale ${ticket.status === 'closed' ? 'opacity-75' : ''}`} style={{animationDelay: `${Math.random() * 0.5}s`}}>
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${getStatusDot(ticket.status)}`}></div>
            <h3 className="font-medium">{ticket.ticketId.substring(0, 8)}</h3>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(ticket.status)}`}>
            {getStatusText(ticket.status)}
          </span>
        </div>
        <div className="p-4">
          <div className="flex items-start mb-3">
            <div className="w-8 h-8 rounded-full bg-discord-blue flex items-center justify-center mr-3">
              {ticket.user?.username.charAt(0).toUpperCase() || "?"}
            </div>
            <div>
              <div className="text-discord-light text-xs">Açan:</div>
              <div className="font-medium">{ticket.user?.username || "Unknown"}</div>
            </div>
          </div>
          <div className="text-sm text-discord-light mb-3">
            <div><span className="font-medium text-white">Oluşturulma:</span> {formatDate(ticket.createdAt)}</div>
            <div><span className="font-medium text-white">Son aktivite:</span> {formatDate(ticket.updatedAt)}</div>
          </div>

          {ticket.attributeRequests && ticket.attributeRequests.length > 0 && (
            <div className="bg-gray-800 rounded p-3 mb-3 glow-animation">
              <h4 className="text-xs uppercase font-bold gradient-text mb-2">Nitelik Talebi</h4>
              <ul className="text-sm">
                {ticket.attributeRequests.map((request: AttributeRequest, index) => (
                  <li key={request.id} className="flex justify-between mb-2 p-1 hover:bg-gray-700 rounded transition-all duration-300 slide-up-animation" style={{animationDelay: `${index * 0.1}s`}}>
                    <span className="fancy-hover">{request.attributeName}</span>
                    <span className="text-green-400 font-bold bg-green-400 bg-opacity-10 px-2 rounded">+{request.valueRequested}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 pt-2 border-t border-gray-700 flex justify-between items-center">
                <span className="text-xs font-medium">Toplam</span>
                <span className="gradient-text font-bold text-lg">+{ticket.totalAttributes} Nitelik</span>
              </div>
            </div>
          )}

          <div className="flex space-x-2">
            <Button 
              variant="default" 
              className="flex-1 bg-discord-green hover:bg-green-600 hover-scale gradient-border"
              onClick={handleApprove}
            >
              <Check className="h-4 w-4 mr-1 rotate-spin-animation" style={{animationDuration: '0.5s', animationIterationCount: '1', animationPlayState: isPending ? 'running' : 'paused'}} /> 
              <span className="relative">
                Onayla
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-white transition-all group-hover:w-full duration-300"></span>
              </span>
            </Button>
            <Button 
              variant="secondary" 
              className="flex-1 bg-gray-700 hover:bg-gray-600 hover-scale"
              onClick={handleEdit}
            >
              <Edit className="h-4 w-4 mr-1" /> 
              <span className="relative">
                Düzenle
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-white transition-all group-hover:w-full duration-300"></span>
              </span>
            </Button>
            <Button variant="secondary" className="bg-gray-700 hover:bg-gray-600 p-2 hover-scale" style={{borderRadius: '50%'}}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <EditTicketModal 
        isOpen={showEditModal} 
        onClose={() => setShowEditModal(false)} 
        ticket={ticket} 
      />
    </>
  );
}
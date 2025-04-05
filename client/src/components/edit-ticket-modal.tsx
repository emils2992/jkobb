import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Ticket, AttributeRequest } from "@/lib/types";
import { Trash2, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EditTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: Ticket | null;
}

export function EditTicketModal({ isOpen, onClose, ticket }: EditTicketModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [requests, setRequests] = useState<Array<{id?: number, attributeName: string, valueRequested: number}>>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (ticket && ticket.attributeRequests) {
      setRequests(ticket.attributeRequests.map(req => ({
        id: req.id,
        attributeName: req.attributeName,
        valueRequested: req.valueRequested
      })));
      setStatus(ticket.status);
    }
  }, [ticket]);

  const { mutate: updateTicket, isPending: isUpdating } = useMutation({
    mutationFn: async () => {
      if (!ticket) return null;
      
      // İlk olarak ticket durumunu güncelle
      await apiRequest("PATCH", `/api/tickets/${ticket.ticketId}`, { status });
      
      // Sonra her bir nitelik isteğini güncelle
      for (const request of requests) {
        if (request.id) {
          // Mevcut isteği güncelle
          await apiRequest("PATCH", `/api/attribute-requests/${request.id}`, { 
            attributeName: request.attributeName,
            valueRequested: request.valueRequested
          });
        } else {
          // Yeni istek oluştur
          await apiRequest("POST", `/api/attribute-requests`, {
            ticketId: ticket.ticketId,
            attributeName: request.attributeName,
            valueRequested: request.valueRequested
          });
        }
      }
      
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Ticket güncellendi",
        description: "Ticket başarıyla güncellendi.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      onClose();
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Ticket güncellenirken bir hata oluştu.",
        variant: "destructive",
      });
    }
  });
  
  const addNewRequest = () => {
    setRequests([...requests, { attributeName: "", valueRequested: 1 }]);
  };
  
  const removeRequest = (index: number) => {
    const newRequests = [...requests];
    newRequests.splice(index, 1);
    setRequests(newRequests);
  };
  
  const updateRequestField = (index: number, field: string, value: string | number) => {
    const newRequests = [...requests];
    newRequests[index] = { ...newRequests[index], [field]: value };
    setRequests(newRequests);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateTicket();
  };
  
  const attributes = [
    "Hız", "Şut", "Pas", "Dribling", "Fizik", "Defans",
    "Kafa", "Refleks", "Serbest Vuruş", "Pozisyon Alma",
    "Liderlik", "Uzun Top", "Kaleci"
  ];

  if (!ticket) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] bg-discord-dark text-white">
        <DialogHeader>
          <DialogTitle className="text-xl">Ticket Düzenle</DialogTitle>
          <DialogDescription className="text-discord-light">
            {ticket.ticketId} - {ticket.user?.username || "Bilinmeyen Kullanıcı"}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status">Durum</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status" className="w-full bg-discord-darker">
                <SelectValue placeholder="Durum seçin" />
              </SelectTrigger>
              <SelectContent className="bg-discord-darker text-white">
                <SelectItem value="open">Açık</SelectItem>
                <SelectItem value="pending">Beklemede</SelectItem>
                <SelectItem value="closed">Kapalı</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Nitelik Talepleri</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="h-8 bg-discord-darker border-discord-light"
                onClick={addNewRequest}
              >
                <Plus className="h-4 w-4 mr-1" /> Yeni Ekle
              </Button>
            </div>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {requests.map((request, index) => (
                <div key={index} className="flex items-end space-x-2 bg-discord-darker p-2 rounded-md">
                  <div className="flex-1">
                    <Label htmlFor={`attribute-${index}`} className="text-xs">Nitelik</Label>
                    <Input
                      id={`attribute-${index}`}
                      type="text"
                      value={request.attributeName}
                      onChange={(e) => updateRequestField(index, "attributeName", e.target.value)}
                      className="bg-discord-dark border-discord-light"
                      placeholder="Nitelik adını yazın"
                    />
                  </div>
                  
                  <div className="w-24">
                    <Label htmlFor={`value-${index}`} className="text-xs">Değer</Label>
                    <Input
                      id={`value-${index}`}
                      type="number"
                      min="1"
                      value={request.valueRequested}
                      onChange={(e) => updateRequestField(index, "valueRequested", parseInt(e.target.value) || 0)}
                      className="bg-discord-dark border-discord-light"
                    />
                  </div>
                  
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => removeRequest(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              {requests.length === 0 && (
                <div className="bg-discord-darker text-discord-light p-4 rounded-md text-center">
                  Henüz nitelik talebi bulunmuyor. Yeni eklemek için "Yeni Ekle" butonuna tıklayın.
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>İptal</Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? "Güncelleniyor..." : "Güncelle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
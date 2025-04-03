import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCcw, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface FixResetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FixResetModal({ isOpen, onClose }: FixResetModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const { toast } = useToast();

  const handleCancel = () => {
    setConfirmText("");
    onClose();
  };

  const handleReset = async () => {
    if (confirmText !== "ONAYLA") {
      toast({
        title: "Onay Hatası",
        description: "Sıfırlama işlemini onaylamak için 'ONAYLA' yazmalısınız.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsResetting(true);
      
      // API isteğini yap
      const result = await apiRequest("POST", "/api/fix/reset");
      console.log("Fixreset API yanıtı:", result);
      
      // Tüm ilgili verileri yeniden getir
      queryClient.invalidateQueries({ queryKey: ['/api/players/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/players/stats/weekly'] });
      queryClient.invalidateQueries({ queryKey: ['/api/players/training-stats'] });
      
      toast({
        title: "Başarılı",
        description: "Tüm nitelikler başarıyla sıfırlandı.",
      });
      
      setConfirmText("");
      onClose();
    } catch (error) {
      console.error("Fixreset hatası:", error);
      toast({
        title: "Hata",
        description: "Nitelikler sıfırlanırken bir hata oluştu. Tekrar deneyin.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-discord-dark text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center text-lg">
            <RefreshCcw className="h-5 w-5 text-discord-red mr-2" />
            /fixreset Komutu
          </DialogTitle>
        </DialogHeader>

        <div className="mb-6">
          <p className="text-discord-light mb-4">
            Bu komut, tüm nitelik değerlerini tamamen sıfırlar. Dikkatli kullanılmalıdır, bu işlem geri alınamaz!
          </p>
          
          <div className="bg-gray-800 rounded-md p-3 font-mono text-sm">
            <code>/fixreset [onay_kodu]</code>
          </div>
        </div>
        
        <div className="bg-discord-red bg-opacity-10 border border-discord-red rounded-md p-4 mb-6">
          <div className="flex items-start">
            <AlertTriangle className="text-discord-red mt-1 mr-3 h-5 w-5" />
            <div>
              <h3 className="font-bold text-discord-red">Uyarı</h3>
              <p className="text-sm text-discord-light">
                Bu işlem tüm oyuncuların nitelik değerlerini ve haftalık sayaçlarını tamamen sıfırlayacaktır. Bu işlem geri alınamaz. İşlemi onaylamak için aşağıdaki kutuya "ONAYLA" yazınız.
              </p>
            </div>
          </div>
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-discord-light mb-2">Onay Kodu</label>
          <Input
            type="text"
            placeholder="ONAYLA"
            className="w-full bg-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-discord-blue"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        </div>

        <DialogFooter className="flex justify-end space-x-3">
          <Button 
            variant="secondary" 
            className="bg-gray-700 hover:bg-gray-600" 
            onClick={handleCancel}
          >
            İptal
          </Button>
          <Button 
            variant="destructive" 
            className="bg-discord-red hover:bg-red-600" 
            onClick={handleReset}
            disabled={isResetting}
          >
            {isResetting ? (
              <>
                <RefreshCcw className="h-4 w-4 mr-1 animate-spin" /> Sıfırlanıyor...
              </>
            ) : (
              <>
                <RefreshCcw className="h-4 w-4 mr-1" /> Sıfırla
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
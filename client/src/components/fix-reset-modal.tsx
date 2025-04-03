
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";

interface FixResetModalProps {
  open: boolean;
  onClose: () => void;
}

export function FixResetModal({ open, onClose }: FixResetModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();

  const handleReset = async () => {
    if (confirmText !== "ONAYLA") {
      setError("Lütfen 'ONAYLA' yazarak işlemi onaylayın.");
      return;
    }

    setIsLoading(true);
    setError("");
    
    try {
      // axios kullanarak POST isteği gönder
      const response = await axios.post("/api/fix/reset");
      
      console.log("Reset yanıtı:", response.data);
      
      if (response.data.success) {
        setSuccess(true);
        
        // Tüm ilgili sorguları yeniden yükle
        queryClient.invalidateQueries({ queryKey: ['/api/players/stats'] });
        queryClient.invalidateQueries({ queryKey: ['/api/players/training-stats'] });
        queryClient.invalidateQueries({ queryKey: ['/api/training-sessions'] });
        
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setConfirmText("");
        }, 2000);
      } else {
        setError(response.data.message || "İşlem sırasında bir hata oluştu");
      }
    } catch (error: any) {
      console.error("Fixreset hatası:", error);
      setError(
        error.response?.data?.message || 
        "Nitelikler sıfırlanırken bir hata oluştu. Lütfen tekrar deneyin."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setConfirmText("");
      setError("");
      setSuccess(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-500">⚠️ Tüm Nitelikleri Sıfırla</DialogTitle>
          <DialogDescription>
            Bu işlem tüm oyuncuların niteliklerini ve antrenman kayıtlarını <strong>tamamen silecek</strong> ve sıfırlayacaktır.
            Bu işlem geri alınamaz!
          </DialogDescription>
        </DialogHeader>
        
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Hata</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {success ? (
          <Alert className="bg-green-50 border-green-200">
            <AlertTitle className="text-green-800">Başarılı</AlertTitle>
            <AlertDescription className="text-green-700">
              Tüm nitelikler başarıyla sıfırlandı ve silindi.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="py-4">
              <p className="text-sm text-red-600 mb-2">
                Onaylamak için aşağıdaki alana "ONAYLA" yazın.
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="ONAYLA"
                className="w-full p-2 border border-gray-300 rounded"
                disabled={isLoading}
              />
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                İptal
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleReset} 
                disabled={isLoading || confirmText !== "ONAYLA"}
              >
                {isLoading ? "İşleniyor..." : "Tüm Nitelikleri Sıfırla"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

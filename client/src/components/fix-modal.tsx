import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Terminal, Copy } from "lucide-react";
import { PlayerStats } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface FixModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerStats: PlayerStats[];
}

export function FixModal({ isOpen: open, onClose, playerStats }: FixModalProps) {
  const { toast } = useToast();

  const handleCopy = () => {
    toast({
      title: "Kopyalandı",
      description: "/fixson komutu panoya kopyalandı.",
    });
  };

  const handleRun = () => {
    toast({
      title: "Discord Komutu",
      description: "Bu komut yalnızca Discord üzerinde çalıştırılabilir.",
    });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString('tr-TR');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-discord-dark text-white max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center text-lg">
            <Terminal className="h-5 w-5 text-discord-blue mr-2" />
            /fixson Komutu
          </DialogTitle>
          <DialogDescription className="text-discord-light">
            Bu komut, oyuncuların toplam kazandığı nitelikleri gösterir. Filtreleme seçenekleri ile haftalık, aylık veya özel bir tarih aralığında arama yapabilirsiniz.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-gray-800 rounded-md p-3 font-mono text-sm">
          <code>/fixson [oyuncu_id] [zaman_aralığı]</code>
        </div>
        
        <div className="bg-discord-darker p-4 rounded-md">
          <h3 className="font-bold mb-3">Örnek Çıktı:</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-700">
                  <TableHead className="font-medium">Oyuncu</TableHead>
                  <TableHead className="font-medium">ID</TableHead>
                  <TableHead className="font-medium">Nitelikler</TableHead>
                  <TableHead className="font-medium">Bu Hafta</TableHead>
                  <TableHead className="font-medium">Toplam</TableHead>
                  <TableHead className="font-medium">Son Fix</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {playerStats.slice(0, 3).map((player) => (
                  <TableRow key={player.user.userId} className="border-b border-gray-700">
                    <TableCell className="p-2 flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-discord-blue flex items-center justify-center text-white">
                        {player.user.username.charAt(0).toUpperCase()}
                      </div>
                      <span>{player.user.username}</span>
                    </TableCell>
                    <TableCell>#{player.user.userId.slice(0, 4)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {player.attributes?.map((attr: any, idx: number) => (
                          <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-discord-blue bg-opacity-20 text-discord-blue">
                            {attr.name}: {attr.value}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{player.weeklyValue}</TableCell>
                    <TableCell>{player.totalValue}</TableCell>
                    <TableCell>{formatDate(player.lastFixDate)}</TableCell>
                  </TableRow>
                ))}
                {playerStats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4">
                      Oyuncu verisi bulunamadı
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="flex justify-end space-x-3">
          <Button variant="secondary" className="bg-gray-700 hover:bg-gray-600" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-1" /> Kopyala
          </Button>
          <Button className="bg-discord-blue hover:bg-blue-600" onClick={handleRun}>
            <Terminal className="h-4 w-4 mr-1" /> Çalıştır
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

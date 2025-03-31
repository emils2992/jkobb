import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Settings } from "lucide-react";

const formSchema = z.object({
  guildId: z.string().min(1, "Discord sunucu ID'si gereklidir"),
  fixLogChannelId: z.string().min(1, "Fix log kanal ID'si gereklidir"),
  trainingChannelId: z.string().min(1, "Antrenman kanal ID'si gereklidir"),
});

type FormValues = z.infer<typeof formSchema>;

export default function SettingsPage() {
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get the default guild ID from the first config
  const { data: configs } = useQuery<any[]>({
    queryKey: ['/api/config/list'],
    // This is a dummy endpoint, in a real app we would have this
    // Since it's not implemented, we'll provide fallback data
    onError: () => {},
    enabled: false
  });
  
  const defaultGuildId = configs?.[0]?.guildId || "";
  const defaultConfig = configs?.[0] || { 
    guildId: "", 
    fixLogChannelId: "", 
    trainingChannelId: "" 
  };
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      guildId: defaultConfig.guildId,
      fixLogChannelId: defaultConfig.fixLogChannelId,
      trainingChannelId: defaultConfig.trainingChannelId,
    }
  });
  
  const { mutate, isPending } = useMutation({
    mutationFn: async (values: FormValues) => {
      return apiRequest("POST", "/api/config", values);
    },
    onSuccess: () => {
      toast({
        title: "Ayarlar Kaydedildi",
        description: "Bot ayarları başarıyla güncellendi.",
        variant: "default",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/config/list'] });
    },
    onError: (error) => {
      toast({
        title: "Hata",
        description: `Ayarlar kaydedilirken bir hata oluştu: ${error}`,
        variant: "destructive",
      });
    }
  });
  
  function onSubmit(values: FormValues) {
    mutate(values);
  }
  
  return (
    <>
      <header className="bg-discord-dark p-4 border-b border-gray-800 flex justify-between items-center">
        <h1 className="text-xl font-bold flex items-center">
          <Settings className="mr-2 h-5 w-5" />
          Ayarlar
        </h1>
      </header>

      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Bot Ayarları</CardTitle>
            <CardDescription>
              Discord kanallarının ID'lerini ve diğer ayarları buradan yapılandırabilirsiniz.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="guildId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discord Sunucu ID</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Discord sunucu ID'sini girin" 
                          {...field} 
                          disabled={!isEditing}
                        />
                      </FormControl>
                      <FormDescription>
                        Botun çalışacağı Discord sunucusunun ID'si.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="fixLogChannelId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fix Log Kanal ID</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Fix log kanal ID'sini girin" 
                          {...field} 
                          disabled={!isEditing}
                        />
                      </FormControl>
                      <FormDescription>
                        Ticket kapanışlarının ve nitelik güncellemelerinin loglanacağı kanal.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="trainingChannelId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Antrenman Kanal ID</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Antrenman kanal ID'sini girin" 
                          {...field} 
                          disabled={!isEditing}
                        />
                      </FormControl>
                      <FormDescription>
                        Antrenman kayıtlarının loglanacağı kanal.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {isEditing && (
                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsEditing(false)}
                    >
                      İptal
                    </Button>
                    <Button type="submit" disabled={isPending}>
                      {isPending ? "Kaydediliyor..." : "Kaydet"}
                    </Button>
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
          {!isEditing && (
            <CardFooter className="flex justify-between border-t pt-6">
              <p className="text-sm text-muted-foreground">
                Ayarları düzenlemek için düzenleme modunu etkinleştirin.
              </p>
              <Button onClick={() => setIsEditing(true)}>Düzenle</Button>
            </CardFooter>
          )}
        </Card>
        
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Discord Bot Komutları</CardTitle>
            <CardDescription>
              Mevcut Discord bot komutlarının listesi ve açıklamaları.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-discord-darker rounded-lg">
                <h3 className="font-medium mb-1">/ticket</h3>
                <p className="text-sm text-discord-light">Yeni bir nitelik talebi oluşturur</p>
              </div>
              
              <div className="p-3 bg-discord-darker rounded-lg">
                <h3 className="font-medium mb-1">/fixson [oyuncu]</h3>
                <p className="text-sm text-discord-light">Oyuncuların toplam nitelik puanlarını gösterir</p>
              </div>
              
              <div className="p-3 bg-discord-darker rounded-lg">
                <h3 className="font-medium mb-1">/fixreset</h3>
                <p className="text-sm text-discord-light">Tüm oyuncuların haftalık nitelik sayaçlarını sıfırlar</p>
              </div>
              
              <div className="p-3 bg-discord-darker rounded-lg">
                <h3 className="font-medium mb-1">/antrenman [süre] [nitelik]</h3>
                <p className="text-sm text-discord-light">Antrenman kaydı oluşturur</p>
              </div>
              
              <div className="p-3 bg-discord-darker rounded-lg">
                <h3 className="font-medium mb-1">/kapat</h3>
                <p className="text-sm text-discord-light">Açık olan ticket'ı kapatır ve nitelikleri kaydeder</p>
              </div>
              
              <div className="p-3 bg-discord-darker rounded-lg">
                <h3 className="font-medium mb-1">/ayarla fixlog [kanal]</h3>
                <p className="text-sm text-discord-light">Fix log kanalını ayarlar</p>
              </div>
              
              <div className="p-3 bg-discord-darker rounded-lg">
                <h3 className="font-medium mb-1">/ayarla antrenman [kanal]</h3>
                <p className="text-sm text-discord-light">Antrenman log kanalını ayarlar</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

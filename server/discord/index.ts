import { initBot } from './bot';
import { setupEventHandlers } from './events';
import { client } from './bot';
// Commands are now imported directly in initBot(), so no additional import needed here

// Maksimum yeniden bağlanma denemesi
const MAX_RECONNECT_ATTEMPTS = 5;
let reconnectAttempts = 0;

export async function initDiscordBot() {
  try {
    // Check if Discord token exists
    if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CLIENT_ID) {
      console.log('Discord tokens not found, bot will not be initialized');
      return; // Gracefully exit if no tokens
    }
    
    console.log('Discord tokens found, bot will initialize in the background');
    
    // Yeniden bağlanma işlevi - sorun olursa yeniden deneyecek
    const connectWithRetry = async () => {
      try {
        // Properly handle the Discord bot initialization flow to avoid circular dependencies
        const botClient = await initBot();
        
        // Check if bot initialized correctly
        if (botClient) {
          console.log('✅ Discord bot başarıyla bağlandı! Bot artık aktif.');
          console.log(`Bot olarak giriş yapıldı: ${botClient.user?.tag}`);
          
          // Bot bağlantı durumunu kontrol etmek için bir interval başlat
          setInterval(() => {
            if (!client.isReady()) {
              console.log('⚠️ Bot bağlantısı koptu, yeniden bağlanmaya çalışılıyor...');
              reconnectBot();
            }
          }, 30000); // Her 30 saniyede bir kontrol et
          
          reconnectAttempts = 0; // Başarılı bağlantıda sayacı sıfırla
        } else {
          console.log('❌ Bot istemcisi düzgün başlatılamadı');
          reconnectBot();
        }
      } catch (error) {
        console.error('Discord bot başlatma hatası:', error);
        reconnectBot();
      }
    };
    
    // Yeniden bağlanma işlevi
    const reconnectBot = () => {
      reconnectAttempts++;
      if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
        console.log(`🔄 Yeniden bağlanma denemesi ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`);
        setTimeout(connectWithRetry, 5000 * reconnectAttempts); // Her denemede biraz daha uzun bekle
      } else {
        console.log('❌ Maksimum yeniden bağlanma denemesi aşıldı. Bot başlatılamıyor.');
      }
    };
    
    // İlk bağlantıyı başlat (5 saniye sonra)
    setTimeout(connectWithRetry, 5000);
    
    // Return immediately to not block server startup
    return;
  } catch (error) {
    console.error('Failed to initialize Discord bot:', error);
    // Don't prevent server from running if bot fails
  }
}

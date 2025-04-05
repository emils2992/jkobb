import { initBot } from './bot';
import { setupEventHandlers } from './events';
// Commands are now imported directly in initBot(), so no additional import needed here

export async function initDiscordBot() {
  try {
    // Check if Discord token exists
    if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CLIENT_ID) {
      console.log('Discord tokens not found, bot will not be initialized');
      return; // Gracefully exit if no tokens
    }
    
    console.log('Discord tokens found, bot will initialize in the background');
    
    // Start bot initialization in the background without waiting
    setTimeout(async () => {
      try {
        // Properly handle the Discord bot initialization flow to avoid circular dependencies
        const botClient = await initBot();
        
        // Check if bot initialized correctly
        if (botClient) {
          console.log('Bot logged in successfully, setup already completed in initBot...');
          console.log('Discord bot initialized successfully');
        } else {
          console.log('Bot client not initialized properly');
        }
      } catch (error) {
        console.error('Failed to initialize Discord bot:', error);
      }
    }, 5000);
    
    // Return immediately to not block server startup
    return;
  } catch (error) {
    console.error('Failed to initialize Discord bot:', error);
    // Don't prevent server from running if bot fails
  }
}

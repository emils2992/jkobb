import { initBot } from './bot';
import { setupEventHandlers } from './events';
import { registerCommands } from './commands';

export async function initDiscordBot() {
  try {
    // Check if Discord token exists
    if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CLIENT_ID) {
      console.log('Discord tokens not found, bot will not be initialized');
      return; // Gracefully exit if no tokens
    }
    
    await initBot();
    setupEventHandlers();
    await registerCommands();
    
    console.log('Discord bot initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Discord bot:', error);
    // Don't prevent server from running if bot fails
  }
}

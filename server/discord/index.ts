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
    
    // Properly handle the Discord bot initialization flow to avoid circular dependencies
    const botClient = await initBot();
    
    // Only setup event handlers and register commands if bot login was successful
    if (botClient) {
      console.log('Bot logged in successfully, setting up handlers and commands...');
      setupEventHandlers();
      // Don't register commands again, it's already done in initBot
      console.log('Discord bot initialized successfully');
    } else {
      console.log('Bot client not initialized properly');
    }
  } catch (error) {
    console.error('Failed to initialize Discord bot:', error);
    // Don't prevent server from running if bot fails
  }
}

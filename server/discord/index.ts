import { initBot } from './bot';

export async function initDiscordBot() {
  try {
    // Check if Discord token exists
    if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CLIENT_ID) {
      console.log('Discord tokens not found, bot will not be initialized');
      return; // Gracefully exit if no tokens
    }
    
    console.log('Starting Discord bot initialization');
    
    // Properly handle the Discord bot initialization flow
    const botClient = await initBot();
    
    // Check if bot was initialized successfully
    if (botClient) {
      console.log('Discord bot initialized successfully');
    } else {
      console.log('Bot client not initialized properly');
    }
  } catch (error) {
    console.error('Failed to initialize Discord bot:', error);
    // Don't prevent server from running if bot fails
  }
}

import { initBot } from './bot';

export async function initDiscordBot() {
  try {
    await initBot();
    console.log('Discord bot initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Discord bot:', error);
  }
}

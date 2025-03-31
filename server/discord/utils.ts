import { EmbedBuilder } from 'discord.js';
import { User, AttributeRequest } from '@shared/schema';

// Format date for display
export function formatDate(date: Date): string {
  if (!date) return 'Bilinmiyor';
  
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Parse attribute request from message content
export function parseAttributeRequest(content: string): { name: string, value: number } | null {
  // Match patterns like "Nitelik: +2 Hız" or "Hız +3" or similar variations
  const patterns = [
    /Nitelik:\s*\+?(\d+)\s+(.+)/i,
    /(.+):\s*\+?(\d+)/i,
    /(.+)\s+\+(\d+)/i
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      if (pattern === patterns[0]) {
        const value = parseInt(match[1], 10);
        const name = match[2].trim();
        return { name, value };
      } else {
        const name = match[1].trim();
        const value = parseInt(match[2], 10);
        return { name, value };
      }
    }
  }
  
  return null;
}

// Create an embed for attribute requests
export function createAttributeEmbed(
  user: User,
  attributeRequests: AttributeRequest[],
  totalAttributes: number
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🎫 Ticket Kapatıldı')
    .setColor('#43B581')
    .setDescription(`${user.username} adlı oyuncunun nitelik talebi tamamlandı.`)
    .setTimestamp();
  
  const approvedRequests = attributeRequests.filter(req => req.approved);
  const pendingRequests = attributeRequests.filter(req => !req.approved);
  
  if (approvedRequests.length > 0) {
    const requestsText = approvedRequests
      .map(req => `${req.attributeName}: +${req.valueRequested}`)
      .join('\n');
    
    embed.addFields({
      name: '✅ Onaylanan Nitelikler',
      value: requestsText,
      inline: false
    });
  }
  
  if (pendingRequests.length > 0) {
    const requestsText = pendingRequests
      .map(req => `${req.attributeName}: +${req.valueRequested}`)
      .join('\n');
    
    embed.addFields({
      name: '❌ Reddedilen Nitelikler',
      value: requestsText,
      inline: false
    });
  }
  
  embed.addFields({
    name: '📊 Toplam Kazanılan Nitelik',
    value: `+${totalAttributes} puan`,
    inline: false
  });
  
  return embed;
}

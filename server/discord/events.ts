import { 
  Events, 
  Interaction, 
  Message, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  ButtonInteraction, 
  ModalSubmitInteraction, 
  EmbedBuilder
} from 'discord.js';
import { client } from './bot';
import { commands } from './commands';
import { storage } from '../storage';
import { parseAttributeRequest } from './utils';

export function setupEventHandlers() {
  // Handle command interactions
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    // Handle slash commands
    if (interaction.isCommand()) {
      const { commandName } = interaction;
      const command = commands.get(commandName);
      
      if (!command) return;
      
      try {
        await command(interaction);
      } catch (error) {
        console.error(`Error executing command ${commandName}:`, error);
        
        const errorContent = { 
          content: 'Komut çalıştırılırken bir hata oluştu.', 
          ephemeral: true 
        };
        
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply(errorContent);
        } else {
          await interaction.reply(errorContent);
        }
      }
    }
    
    // Handle button interactions
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    }
    
    // Handle modal submissions
    if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    }
  });

  // Handle messages for attribute requests in tickets
  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;
    
    // Check if this is in a ticket channel
    const ticketId = message.channelId;
    const ticket = await storage.getTicket(ticketId);
    
    if (!ticket || ticket.status === 'closed') return;
    
    // Parse attribute requests from message
    const attributeRequest = parseAttributeRequest(message.content);
    
    if (attributeRequest) {
      try {
        // Save the attribute request
        await storage.createAttributeRequest({
          ticketId,
          attributeName: attributeRequest.name,
          valueRequested: attributeRequest.value,
          approved: false
        });
        
        // Acknowledge the request
        const embed = new EmbedBuilder()
          .setTitle('📝 Nitelik Talebi Alındı')
          .setColor('#5865F2')
          .addFields(
            { name: 'Nitelik', value: attributeRequest.name, inline: true },
            { name: 'Değer', value: `+${attributeRequest.value}`, inline: true }
          )
          .setTimestamp();
        
        await message.reply({ embeds: [embed] });
      } catch (error) {
        console.error('Error processing attribute request:', error);
        await message.reply('Nitelik talebi işlenirken bir hata oluştu.');
      }
    }
  });
}

// Handle button interactions
async function handleButtonInteraction(interaction: ButtonInteraction) {
  const { customId } = interaction;
  
  // Handle close ticket button
  if (customId === 'close_ticket') {
    // Check if this is a ticket channel
    const ticketId = interaction.channelId;
    const ticket = await storage.getTicket(ticketId);
    
    if (!ticket) {
      return interaction.reply({
        content: 'Bu bir ticket kanalı değil.',
        ephemeral: true
      });
    }
    
    if (ticket.status === 'closed') {
      return interaction.reply({
        content: 'Bu ticket zaten kapatılmış.',
        ephemeral: true
      });
    }
    
    // Create confirmation modal
    const modal = new ModalBuilder()
      .setCustomId('close_ticket_confirm')
      .setTitle('Ticket\'ı Kapat');
    
    const confirmInput = new TextInputBuilder()
      .setCustomId('confirmation')
      .setLabel('Onaylamak için "KAPAT" yazın')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    
    const confirmRow = new ActionRowBuilder<TextInputBuilder>().addComponents(confirmInput);
    modal.addComponents(confirmRow);
    
    await interaction.showModal(modal);
  }
  
  // Handle add attribute button
  if (customId === 'add_attribute') {
    // Check if this is a ticket channel
    const ticketId = interaction.channelId;
    const ticket = await storage.getTicket(ticketId);
    
    if (!ticket) {
      return interaction.reply({
        content: 'Bu bir ticket kanalı değil.',
        ephemeral: true
      });
    }
    
    if (ticket.status === 'closed') {
      return interaction.reply({
        content: 'Bu ticket kapatılmış, nitelik eklenemez.',
        ephemeral: true
      });
    }
    
    // Create attribute modal
    const modal = new ModalBuilder()
      .setCustomId('add_attribute_modal')
      .setTitle('Nitelik Ekle');
    
    const nameInput = new TextInputBuilder()
      .setCustomId('attribute_name')
      .setLabel('Nitelik Adı')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Örn: Hız, Şut, Pas')
      .setRequired(true);
    
    const valueInput = new TextInputBuilder()
      .setCustomId('attribute_value')
      .setLabel('Nitelik Değeri')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Pozitif bir sayı girin (1-10)')
      .setRequired(true);
    
    const nameRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
    const valueRow = new ActionRowBuilder<TextInputBuilder>().addComponents(valueInput);
    
    modal.addComponents(nameRow, valueRow);
    
    await interaction.showModal(modal);
  }
}

// Handle modal submissions
async function handleModalSubmit(interaction: ModalSubmitInteraction) {
  const { customId } = interaction;
  
  // Handle ticket close confirmation
  if (customId === 'close_ticket_confirm') {
    const confirmation = interaction.fields.getTextInputValue('confirmation');
    
    if (confirmation !== 'KAPAT') {
      return interaction.reply({
        content: 'Ticket kapatma işlemi iptal edildi.',
        ephemeral: true
      });
    }
    
    try {
      // Use the kapat command to handle the ticket closing
      const command = commands.get('kapat');
      if (command) {
        await command(interaction);
      } else {
        await interaction.reply({
          content: 'Ticket kapatma komutu bulunamadı.',
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('Error closing ticket:', error);
      await interaction.reply({
        content: 'Ticket kapatılırken bir hata oluştu.',
        ephemeral: true
      });
    }
  }
  
  // Handle add attribute modal
  if (customId === 'add_attribute_modal') {
    const attributeName = interaction.fields.getTextInputValue('attribute_name');
    const attributeValueStr = interaction.fields.getTextInputValue('attribute_value');
    
    const attributeValue = parseInt(attributeValueStr, 10);
    
    if (isNaN(attributeValue) || attributeValue < 1 || attributeValue > 10) {
      return interaction.reply({
        content: 'Geçersiz nitelik değeri. 1 ile 10 arasında bir sayı girin.',
        ephemeral: true
      });
    }
    
    try {
      // Save attribute request
      const ticketId = interaction.channelId;
      
      await storage.createAttributeRequest({
        ticketId,
        attributeName,
        valueRequested: attributeValue,
        approved: false
      });
      
      // Create response embed
      const embed = new EmbedBuilder()
        .setTitle('📝 Nitelik Talebi Eklendi')
        .setColor('#5865F2')
        .addFields(
          { name: 'Nitelik', value: attributeName, inline: true },
          { name: 'Değer', value: `+${attributeValue}`, inline: true }
        )
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error adding attribute request:', error);
      await interaction.reply({
        content: 'Nitelik talebi eklenirken bir hata oluştu.',
        ephemeral: true
      });
    }
  }
}

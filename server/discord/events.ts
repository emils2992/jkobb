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
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  ButtonStyle,
  ButtonBuilder,
  TextChannel
} from 'discord.js';
import { client } from './bot';
import { commands } from './commands';
import { storage } from '../storage';
import { parseAttributeRequest, parseTrainingMessage, createAttributeEmbed } from './utils';

export function setupEventHandlers() {
  // Handle command interactions
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
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

  // Handle messages for attribute requests in tickets and training
  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;
    
    try {
      // Önce ticket channel kontrolü yap
      const ticketId = message.channelId;
      const ticket = await storage.getTicket(ticketId);
      
      if (ticket && ticket.status !== 'closed') {
        // Bu bir ticket kanalıdır, nitelik taleplerini işle
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
      }
      
      // Emoji reaksiyonlarını işle - ticket kapatma
      if (message.reference && message.reference.messageId) {
        // Mesaj bir yanıt ise
        try {
          const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
          
          // Reaksiyonları ve ticket kapatma mesajını kontrol et
          if (referencedMessage.embeds.length > 0 && 
              referencedMessage.embeds[0].title === '❓ Ticket Kapatma Onayı') {
            
            // Evet (✅) reaksiyonu varsa
            if (message.content.includes('✅') || message.content.toLowerCase().includes('evet')) {
              // Ticket kapatma işlemini burada ele alıyoruz
              const ticketId = message.channel.id;
              const ticket = await storage.getTicket(ticketId);
              
              if (!ticket) {
                return message.reply('Bu bir ticket kanalı değil.');
              }
              
              if (ticket.status === 'closed') {
                return message.reply('Bu ticket zaten kapatılmış.');
              }
              
              try {
                // Get attribute requests for this ticket
                const attributeRequests = await storage.getAttributeRequests(ticketId);
                const totalAttributes = await storage.getTotalAttributesForTicket(ticketId);
                
                // Update user's attributes
                const user = await storage.getUserById(ticket.userId);
                if (!user) {
                  return message.reply('Bu ticketin sahibi bulunamadı.');
                }
                
                // Process approved attribute requests
                for (const request of attributeRequests) {
                  if (request.approved) {
                    await storage.updateAttribute(
                      user.userId,
                      request.attributeName,
                      request.valueRequested
                    );
                  }
                }
                
                // Close the ticket
                await storage.closeTicket(ticketId);
                
                // Create embed for the response
                const embed = createAttributeEmbed(user, attributeRequests, totalAttributes);
                await message.reply({ embeds: [embed] });
                
                // Post to fix log channel if configured
                if (message.guild?.id) {
                  const serverConfig = await storage.getServerConfig(message.guild.id);
                  if (serverConfig?.fixLogChannelId) {
                    const logChannel = await client.channels.fetch(serverConfig.fixLogChannelId) as TextChannel;
                    if (logChannel) {
                      await logChannel.send({ 
                        content: `${user.username} için ticket kapatıldı:`,
                        embeds: [embed] 
                      });
                    }
                  }
                }
                
                // Mesaj göndermek yerine reply kullan
              await message.reply('Bu ticket kapatıldı ve işlendi. ✅');
              } catch (error) {
                console.error('Error closing ticket:', error);
                await message.reply('Ticket kapatılırken bir hata oluştu.');
              }
            }
            
            // Hayır (❌) reaksiyonu varsa
            if (message.content.includes('❌') || message.content.toLowerCase().includes('hayır')) {
              await message.reply('Ticket kapatma işlemi iptal edildi.');
            }
          }
        } catch (error) {
          console.error('Error processing reaction message:', error);
        }
      }
      
      // Antrenman mesajlarını kontrol et
      if (message.guild) {
        const serverConfig = await storage.getServerConfig(message.guild.id);
        
        // Antrenman kanalındaysa kontrol et
        if (serverConfig?.trainingChannelId && message.channelId === serverConfig.trainingChannelId) {
          // Kullanıcıyı oluştur veya al
          const user = await storage.getOrCreateUser(
            message.author.id,
            message.author.username,
            message.author.displayAvatarURL()
          );
          
          // Kullanıcının niteliklerini al
          const attributes = await storage.getAttributes(user.userId);
          
          // Kullanıcının son antrenman kaydını al
          const trainingSessions = await storage.getTrainingSessions(user.userId);
          let lastTrainingTime: Date | null = null;
          
          if (trainingSessions.length > 0) {
            const lastSession = trainingSessions.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )[0];
            lastTrainingTime = new Date(lastSession.createdAt);
          }
          
          // Antrenman mesajını analiz et
          const trainingInfo = parseTrainingMessage(message.content, attributes, lastTrainingTime);
          
          if (trainingInfo) {
            // Antrenman yapılabilir mi kontrol et
            if (!trainingInfo.isAllowed) {
              // Daha çok beklenmesi gerekiyorsa bilgilendir
              const hoursLeft = Math.max(0, trainingInfo.hoursRequired - trainingInfo.timeSinceLastTraining).toFixed(1);
              
              const embed = new EmbedBuilder()
                .setTitle('⏱️ Antrenman Limiti')
                .setColor('#e74c3c')
                .setDescription(`${message.author} henüz bu nitelikte antrenman yapamazsın!`)
                .addFields(
                  { name: 'Nitelik', value: trainingInfo.attributeName, inline: true },
                  { name: 'Mevcut Değer', value: `${trainingInfo.attributeValue}`, inline: true },
                  { name: 'Gereken Bekleme', value: `${trainingInfo.hoursRequired} saat`, inline: true },
                  { name: 'Kalan Süre', value: `${hoursLeft} saat`, inline: true }
                )
                .setTimestamp();
              
              await message.reply({ embeds: [embed] });
              await message.react('⏱️');
              return;
            }
            
            // Antrenman oturumu oluştur
            const session = await storage.createTrainingSession({
              userId: user.userId,
              ticketId: "", // Boş string kullanıyoruz, null yerine
              duration: trainingInfo.duration,
              attributesGained: trainingInfo.points
            });
            
            // Kullanıcının niteliklerini güncelle
            await storage.updateAttribute(user.userId, trainingInfo.attributeName, trainingInfo.points);
            
            // Onaylamak için emoji ekle
            await message.react('🏋️');
            
            // Antrenmanı kaydet
            const embed = new EmbedBuilder()
              .setTitle('🏋️ Antrenman Kaydı')
              .setColor('#43B581')
              .setDescription(`${message.author} adlı oyuncunun antrenman kaydı oluşturuldu.`)
              .addFields(
                { name: 'Nitelik', value: trainingInfo.attributeName, inline: true },
                { name: 'Süre/Yoğunluk', value: `${trainingInfo.duration}/${trainingInfo.intensity}`, inline: true },
                { name: 'Kazanılan Puan', value: `+${trainingInfo.points}`, inline: true },
                { name: 'Mevcut Değer', value: `${trainingInfo.attributeValue + trainingInfo.points}`, inline: true },
                { name: 'Sonraki Antrenman', value: `${trainingInfo.hoursRequired} saat sonra yapılabilir`, inline: false }
              )
              .setTimestamp();
            
            await message.reply({ embeds: [embed] });
          }
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
}

// Handle button interactions
async function handleButtonInteraction(interaction: ButtonInteraction) {
  const { customId } = interaction;
  
  // Handle create ticket button
  if (customId === 'create_ticket') {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const guild = interaction.guild;
      if (!guild) {
        return interaction.editReply('Bu komut sadece sunucularda kullanılabilir.');
      }
      
      // Create user if doesn't exist
      await storage.getOrCreateUser(
        interaction.user.id,
        interaction.user.username,
        interaction.user.displayAvatarURL()
      );
      
      // Create ticket channel - visible to everyone
      const channel = await guild.channels.create({
        name: `ticket-${Date.now().toString().slice(-4)}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.id, // @everyone role
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ReadMessageHistory
            ],
            deny: []
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          }
        ]
      });
      
      // Create ticket in database
      const ticket = await storage.createTicket({
        ticketId: channel.id,
        userId: interaction.user.id,
        status: 'open',
        type: 'attribute'
      });
      
      // Get player stats to show in the ticket
      const playerStats = await storage.getPlayerAttributeStats(interaction.user.id);
      const playerStat = playerStats && playerStats.length > 0 ? playerStats[0] : null;
      
      // Prepare player stats text
      let statsText = '';
      if (playerStat) {
        statsText = `\n\n**Mevcut Nitelik Durumu:**\nToplam Nitelik: **${playerStat.totalValue}**\nBu Hafta: **${playerStat.weeklyValue}**`;
        
        if (playerStat.attributes && playerStat.attributes.length > 0) {
          statsText += '\n\n**Detaylı Nitelikler:**\n';
          playerStat.attributes.forEach((attr: { name: string, value: number }) => {
            statsText += `${attr.name}: **${attr.value}**\n`;
          });
        }
      }
      
      // Send initial message in the ticket channel
      const embed = new EmbedBuilder()
        .setTitle('🎫 Yeni Nitelik Talebi')
        .setColor('#5865F2')
        .setDescription(`${interaction.user} tarafından açıldı.\n\nNitelik talebini aşağıdaki formatta gönderebilirsin:\n\`\`\`Nitelik: +2 Hız\nNitelik: +1 Şut\n\`\`\`${statsText}`)
        .setTimestamp();
      
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Ticket\'ı Kapat')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('add_attribute')
            .setLabel('Nitelik Ekle')
            .setStyle(ButtonStyle.Primary)
        );
      
      await channel.send({ embeds: [embed], components: [row] });
      
      await interaction.editReply(`Ticket oluşturuldu: <#${channel.id}>`);
    } catch (error) {
      console.error('Error creating ticket:', error);
      await interaction.editReply('Ticket oluşturulurken bir hata oluştu.');
    }
  }
  
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
    
    // Instead of opening a modal, directly send a confirmation message with emojis
    await interaction.deferReply();
    
    const embed = new EmbedBuilder()
      .setTitle('❓ Ticket Kapatma Onayı')
      .setColor('#e74c3c')
      .setDescription('Bu ticket\'ı kapatmak istediğinize emin misiniz?')
      .setTimestamp();
      
    const message = await interaction.editReply({ embeds: [embed] });
    
    // Emojiler ekleyelim
    await message.react('✅'); // Evet
    await message.react('❌'); // Hayır
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
      
      if (ticketId) {
        await storage.createAttributeRequest({
          ticketId: ticketId.toString(),  // Açıkça string'e dönüştür
          attributeName,
          valueRequested: attributeValue,
          approved: false
        });
      } else {
        throw new Error('Channel ID is null or undefined.');
      }
      
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

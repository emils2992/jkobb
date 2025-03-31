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
  PermissionFlagsBits, 
  EmbedBuilder,
  ChannelType,
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
    try {
      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;
        const command = commands.get(commandName);
        
        if (!command) return;
        
        try {
          await command(interaction);
        } catch (error) {
          console.error(`Error executing command ${commandName}:`, error);
          
          // Hata mesajları tek bir yerden yönetiliyor
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: 'Komut çalıştırılırken bir hata oluştu.', 
              ephemeral: true 
            }).catch(err => {
              console.error('Error sending error message:', err);
            });
          } else if (interaction.deferred) {
            await interaction.editReply('Komut çalıştırılırken bir hata oluştu.').catch(err => {
              console.error('Error editing reply with error message:', err);
            });
          }
        }
      }
      
      // Handle button interactions
      else if (interaction.isButton()) {
        try {
          await handleButtonInteraction(interaction);
        } catch (error) {
          console.error('Error handling button interaction:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: 'İşlem sırasında bir hata oluştu.', 
              ephemeral: true 
            }).catch(err => console.error('Failed to reply with error message:', err));
          }
        }
      }
      
      // Handle modal submissions
      else if (interaction.isModalSubmit()) {
        try {
          await handleModalSubmit(interaction);
        } catch (error) {
          console.error('Error handling modal submission:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: 'İşlem sırasında bir hata oluştu.', 
              ephemeral: true 
            }).catch(err => console.error('Failed to reply with error message:', err));
          }
        }
      }
    } catch (error) {
      console.error('Error handling interaction:', error);
    }
  });

  // Handle messages for attribute requests in tickets and training
  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;
    
    try {
      // Önce mesaj içeriğinde "evet", "hayır" veya emoji olup olmadığını kontrol et
      const isReactionMessage = message.content.toLowerCase().includes('evet') || 
                             message.content.toLowerCase().includes('hayır') ||
                             message.content.includes('✅') || 
                             message.content.includes('❌');
      
      // Önce ticket channel kontrolü yap
      const ticketId = message.channelId;
      const ticket = await storage.getTicket(ticketId);
      
      if (ticket && ticket.status !== 'closed' && !isReactionMessage) {
        // Bu bir ticket kanalıdır ve reaksiyon mesajı değildir, nitelik taleplerini işle
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
            
            // Evet (✅) reaksiyonu varsa, ya da mesaj içeriğinde "evet" veya ✅ emojisi varsa
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
                
                // İlk olarak tüm nitelik taleplerini onaylayalım
                // Eğer yönetici tarafından onaylanmadıysa bile, ticket kapanırken onaylansın
                for (const request of attributeRequests) {
                  if (!request.approved) {
                    await storage.approveAttributeRequest(request.id);
                  }
                }
                
                // Onaylanan talepleri tekrar alalım
                const approvedRequests = await storage.getAttributeRequests(ticketId);
                
                // Process all attribute requests (auto-approved on close)
                for (const request of approvedRequests) {
                  await storage.updateAttribute(
                    user.userId,
                    request.attributeName,
                    request.valueRequested
                  );
                }
                
                // Close the ticket
                await storage.closeTicket(ticketId);
                
                // Güncel toplam nitelik değerini alalım
                const updatedTotalAttributes = await storage.getTotalAttributesForTicket(ticketId);
                
                // Create embed for the response
                const embed = createAttributeEmbed(user, approvedRequests, updatedTotalAttributes);
                await message.reply({ embeds: [embed] });
                
                // Post to fix log channel if configured
                if (message.guild?.id) {
                  const serverConfig = await storage.getServerConfig(message.guild.id);
                  if (serverConfig?.fixLogChannelId) {
                    try {
                      const logChannel = await client.channels.fetch(serverConfig.fixLogChannelId) as TextChannel;
                      if (logChannel) {
                        await logChannel.send({ 
                          content: `${user.username} için ticket kapatıldı:`,
                          embeds: [embed] 
                        });
                        console.log(`Fix log mesajı #${logChannel.name} kanalına gönderildi.`);
                      }
                    } catch (error) {
                      console.error('Fix log kanalına mesaj gönderilirken hata:', error);
                    }
                  }
                }
                
                // Kanalı 5 saniye sonra silelim
                setTimeout(async () => {
                  try {
                    const channel = message.channel;
                    
                    // TextChannel olduğundan emin olalım
                    if (channel.type === ChannelType.GuildText) {
                      const textChannel = channel as TextChannel;
                      if (textChannel.deletable) {
                        await textChannel.send('Bu kanal 5 saniye içinde silinecek...');
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        await textChannel.delete('Ticket kapatıldı');
                        console.log(`Ticket kanalı silindi: ${textChannel.name}`);
                      }
                    }
                  } catch (error) {
                    console.error('Kanal silinirken hata:', error);
                  }
                }, 1000);
                
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
      
      // Create ticket channel - visible to everyone but only user can send messages
      const channel = await guild.channels.create({
        name: `ticket-${interaction.user.username}-${Date.now().toString().slice(-4)}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.id, // @everyone role
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ReadMessageHistory
            ],
            deny: [
              PermissionFlagsBits.SendMessages
            ]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          // Yöneticilere her zaman yazma yetkisi ver
          {
            id: guild.roles.cache.find(r => r.permissions.has(PermissionFlagsBits.Administrator))?.id || guild.id,
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
    if (!ticketId) {
      return interaction.reply({
        content: 'Kanal bilgisi alınamadı.',
        ephemeral: true
      });
    }
    
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
    
    await interaction.deferReply();
    
    try {
      // Get attribute requests for this ticket
      const attributeRequests = await storage.getAttributeRequests(ticketId);
      const totalAttributes = await storage.getTotalAttributesForTicket(ticketId);
      
      // Get user
      const user = await storage.getUserById(ticket.userId);
      if (!user) {
        return interaction.editReply('Bu ticketin sahibi bulunamadı.');
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
      
      // Auto-approve remaining attribute requests
      for (const request of attributeRequests) {
        if (!request.approved) {
          await storage.approveAttributeRequest(request.id);
        }
      }
      
      // Get updated attribute requests
      const approvedRequests = await storage.getAttributeRequests(ticketId);
      
      // Update attributes again to ensure all are processed
      for (const request of approvedRequests) {
        await storage.updateAttribute(
          user.userId,
          request.attributeName,
          request.valueRequested
        );
      }
      
      // Close the ticket
      await storage.closeTicket(ticketId);
      
      // Get updated total attribute count
      const updatedTotalAttributes = await storage.getTotalAttributesForTicket(ticketId);
      
      // Create embed for response
      const embed = createAttributeEmbed(user, approvedRequests, updatedTotalAttributes);
      await interaction.editReply({ embeds: [embed] });
      
      // Post to fix log channel if configured
      if (interaction.guild?.id) {
        const serverConfig = await storage.getServerConfig(interaction.guild.id);
        if (serverConfig?.fixLogChannelId) {
          try {
            const logChannel = await client.channels.fetch(serverConfig.fixLogChannelId) as TextChannel;
            if (logChannel) {
              await logChannel.send({ 
                content: `${user.username} için ticket kapatıldı:`,
                embeds: [embed] 
              });
              console.log(`Fix log mesajı #${logChannel.name} kanalına gönderildi.`);
            }
          } catch (error) {
            console.error('Fix log kanalına mesaj gönderilirken hata:', error);
          }
        }
      }
      
      // Delete the channel after a delay
      setTimeout(async () => {
        try {
          if (interaction.channel?.type === ChannelType.GuildText) {
            const textChannel = interaction.channel as TextChannel;
            if (textChannel.deletable) {
              await textChannel.send('Bu kanal 5 saniye içinde silinecek...');
              await new Promise(resolve => setTimeout(resolve, 5000));
              await textChannel.delete('Ticket kapatıldı');
              console.log(`Ticket kanalı silindi: ${textChannel.name}`);
            }
          }
        } catch (error) {
          console.error('Kanal silinirken hata:', error);
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error closing ticket with button:', error);
      await interaction.editReply('Ticket kapatılırken bir hata oluştu.');
    }
  }
  
  // Handle add attribute button
  if (customId === 'add_attribute') {
    // Check if this is a ticket channel
    const ticketId = interaction.channelId;
    if (!ticketId) {
      return interaction.reply({
        content: 'Kanal bilgisi alınamadı.',
        ephemeral: true
      });
    }
    
    // Yalnızca yönetici yetkisine sahip kullanıcıların nitelik eklemesine izin ver
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: 'Bu işlemi yapmak için yönetici yetkisine sahip olmanız gerekiyor.',
        ephemeral: true
      });
    }
    
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
    try {
      const confirmation = interaction.fields.getTextInputValue('confirmation');
      
      if (confirmation !== 'KAPAT') {
        return await interaction.reply({
          content: 'Ticket kapatma işlemi iptal edildi.',
          ephemeral: true
        });
      }
      
      // Direkt işlemi burada yapıyoruz, command kullanmak yerine
      const ticketId = interaction.channelId;
      if (!ticketId) {
        return await interaction.reply({
          content: 'Kanal bilgisi alınamadı.',
          ephemeral: true
        });
      }
      
      const ticket = await storage.getTicket(ticketId);
      
      if (!ticket) {
        return await interaction.reply({
          content: 'Bu bir ticket kanalı değil.',
          ephemeral: true
        });
      }
      
      if (ticket.status === 'closed') {
        return await interaction.reply({
          content: 'Bu ticket zaten kapatılmış.',
          ephemeral: true
        });
      }
      
      await interaction.deferReply();
      
      // Ticket kapatma işlemleri
      const attributeRequests = await storage.getAttributeRequests(ticketId);
      const totalAttributes = await storage.getTotalAttributesForTicket(ticketId);
      
      // Update user's attributes
      const user = await storage.getUserById(ticket.userId);
      if (!user) {
        return await interaction.editReply('Bu ticketin sahibi bulunamadı.');
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
      await interaction.editReply({ embeds: [embed] });
      
      // Post to fix log channel if configured
      if (interaction.guildId) {
        const serverConfig = await storage.getServerConfig(interaction.guildId);
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
    } catch (error) {
      console.error('Error closing ticket:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Ticket kapatılırken bir hata oluştu.',
          ephemeral: true
        }).catch(console.error);
      } else if (interaction.deferred) {
        await interaction.editReply('Ticket kapatılırken bir hata oluştu.')
          .catch(console.error);
      }
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
      
      if (!ticketId) {
        return interaction.reply({
          content: 'Kanal bilgisi alınamadı.',
          ephemeral: true
        });
      }
      
      await storage.createAttributeRequest({
        ticketId: ticketId.toString(),  // Açıkça string'e dönüştür
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

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
  InteractionReplyOptions,
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
import { parseAttributeRequest, parseTrainingMessage, createAttributeEmbed, getValidAttributes } from './utils';
import { pool } from '../db';

// İşlenmiş mesaj ID'lerini global olarak saklayacak bir set
const processedMessageIds = new Set<string>();

// Rate limiting için basit bir Map
const commandCooldowns = new Map<string, number>();
const COOLDOWN_PERIOD = 5 * 1000; // 5 saniye (milisaniye cinsinden)

// Levenshtein mesafesi hesaplama - benzer nitelik adı önerirken kullanılır
function levenshteinDistance(a: string, b: string): number {
  const matrix = [];

  // Matrisi başlangıç değerleriyle oluştur
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Mesafeyi hesapla
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // değiştirme
          Math.min(
            matrix[i][j - 1] + 1, // ekleme
            matrix[i - 1][j] + 1  // silme
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function setupEventHandlers() {
  // Handle command interactions
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        // Rate limiting kontrolü
        const userId = interaction.user.id;
        const now = Date.now();
        const cooldownEnd = commandCooldowns.get(userId) || 0;

        if (now < cooldownEnd && interaction.commandName === 'antren') {
          const remainingTime = Math.ceil((cooldownEnd - now) / 1000);
          await interaction.reply({ 
            content: `Lütfen ${remainingTime} saniye bekleyin.`,
            ephemeral: true 
          } as InteractionReplyOptions);
          return;
        }

        // Cooldown süresini güncelle
        if (interaction.commandName === 'antren') {
          commandCooldowns.set(userId, now + COOLDOWN_PERIOD);
        }
        const { commandName } = interaction;
        const command = commands.get(commandName);

        if (!command) return;

        try {
          await command(interaction);
        } catch (error) {
          // Sadece konsola hata logu yaz, kullanıcıya hata mesajı gösterme
          console.error(`Error executing command ${commandName}:`, error);

          // Hata mesajlarını gösterme, sadece konsola log
          console.log(`Komut hatası (${commandName}), mesaj gösterilmiyor`);
        }
      }

      // Handle button interactions
      else if (interaction.isButton()) {
        try {
          await handleButtonInteraction(interaction);
        } catch (error) {
          console.error('Error handling button interaction:', error);
          // Interaction already replied durumunu kontrol et
          if ((error as any)?.code !== 'InteractionAlreadyReplied' && !interaction.replied && !interaction.deferred) {
            try {
              await interaction.reply({ 
                content: 'İşleminiz alındı, işleniyor...', 
                ephemeral: true 
              }).catch(err => console.error('Failed to reply with error message:', err));
            } catch (e) {
              console.error('Failed to reply with error message:', e);
            }
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

      try {
        // Önce ticket channel kontrolü yap
        const ticketId = message.channelId;
        const ticket = await storage.getTicket(ticketId);

        if (ticket && ticket.status !== 'closed' && !isReactionMessage) {
          // Ticket kanalında mesaj kontrolü - sadece "nitelik ekle" butonundan ekleme yapılabilir
          // Oyuncuların direkt mesajla nitelik eklemesini engelliyoruz
          if (message.content.toLowerCase().includes('nitelik:')) {
            await message.reply(
              '⚠️ Nitelik taleplerini direkt mesaj olarak gönderemezsiniz. Lütfen "Nitelik Ekle" butonunu kullanın.'
            );
            return;
          }
        }
      } catch (ticketError) {
        console.error('Error checking ticket:', ticketError);
      }

      // Emoji reaksiyonlarını işle - ticket kapatma
      try {
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
                  // TAMAMEN YENİDEN YAZDIM - TEMEL SORUN BURASIYDI

                  console.log(`[YENİ METOT - MESAJLA KAPATMA] Ticket kapatılıyor: ${ticketId}`);
                  console.log(`[YENİ METOT - MESAJLA KAPATMA] Toplam nitelik talepleri: ${approvedRequests.length}`);

                  // Tüm talepleri logla - hata ayıklama için
                  for (const req of approvedRequests) {
                    console.log(`[YENİ METOT - MESAJLA KAPATMA] Talep: ${req.attributeName} için ${req.valueRequested} puan`);
                  }

                  // Nitelik başına sadece en son talebi kullanacak şekilde harita oluşturalım
                  const attributeMap = new Map<string, number>();

                  // Önce talepleri zaman damgasına göre sıralayalım (en yenisi en sonda)
                  const sortedRequests = [...approvedRequests]
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                  // Her nitelik için sadece bir kez ekleme yapacağız - en son talep kazanır
                  for (const request of sortedRequests) {
                    // Nitelik adını ve tam olarak istenen değeri kullan
                    attributeMap.set(request.attributeName, request.valueRequested);
                    console.log(`[TAMAMEN YENİ METOT] Nitelik talebi: ${request.attributeName} için SADECE +${request.valueRequested}`);
                  }

                  // Her nitelik için sadece bir kez güncelleme yapacağız
                  for (const [attributeName, valueToAdd] of Array.from(attributeMap.entries())) {
                    console.log(`[TAMAMEN YENİ METOT] GÜNCELLEME BAŞLIYOR: User ${user.userId} için ${attributeName} niteliğine TAM OLARAK +${valueToAdd} ekleniyor`);

                    try {
                      // Önce mevcut değeri alıp loglayalım
                      const beforeAttr = await storage.getAttribute(user.userId, attributeName);
                      if (beforeAttr) {
                        console.log(`[TAMAMEN YENİ METOT] ÖNCEKİ DEĞER: ${attributeName} = ${beforeAttr.value}`);
                      } else {
                        console.log(`[TAMAMEN YENİ METOT] YENİ NİTELİK OLUŞTURULACAK: ${attributeName}`);
                      }

                      // Niteliği güncelle - değeri direkt olarak ekle (çarpma YOK!)
                      await storage.updateAttribute(
                        user.userId,
                        attributeName,
                        valueToAdd, // Kullanıcının talep ettiği değeri direkt kullan
                        undefined, // Haftalık değeri otomatik olarak güncellenir
                        false, // absoluteValue=false: değeri ekle, değiştirme
                        false, // onlyUpdateWeekly=false
                        'ticket' // source=ticket: bu değişiklik ticket kaynaklı
                      );

                      // Sonraki değeri alıp loglayalım
                      const afterAttr = await storage.getAttribute(user.userId, attributeName);
                      if (afterAttr) {
                        console.log(`[TAMAMEN YENİ METOT] YENİ DEĞER: ${attributeName} = ${afterAttr.value}`);
                        if (beforeAttr) {
                          const diff = afterAttr.value - beforeAttr.value;
                          console.log(`[TAMAMEN YENİ METOT] FARK: +${diff} (Beklenen: +${valueToAdd})`);
                          if (diff !== valueToAdd) {
                            console.log(`[TAMAMEN YENİ METOT] UYARI! Beklenen fark (${valueToAdd}) ile gerçek fark (${diff}) eşleşmiyor!`);
                          }
                        }
                      }
                    } catch (error) {
                      console.error(`[TAMAMEN YENİ METOT] HATA: ${attributeName} güncellenirken hata oluştu:`, error);
                    }
                  }

                  // Close the ticket
                  await storage.closeTicket(ticketId, message.author.id); // Added author ID

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

                  // Burada mesaj gönder yanıtla
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
      } catch (reactionError) {
        console.error('Error processing reaction:', reactionError);
      }

      // Antrenman mesajlarını kontrol et - tamamen yeniden yazıldı
      try {
        // Önce mesajın bir sunucudan geldiğinden emin olalım
        if (!message.guild || !message.channel) return;
        
        // Sunucu yapılandırmasını al
        const serverConfig = await storage.getServerConfig(message.guild.id);
        if (!serverConfig) return;

        // Mesajın hangi antrenman kanalında olduğunu kontrol et
        let trainingDuration = 1; // Varsayılan süre 1 saat
        let isTrainingChannel = false;

        // Kanal bilgilerini loglama (debug için)
        console.log('[DEBUG] Antrenman kanalları bilgisi:');
        console.log(`[DEBUG] Ana antrenman kanalı: ${serverConfig?.trainingChannelId}`);
        console.log(`[DEBUG] Kanal 1 (1 saat): ${serverConfig?.trainingChannelId1}`);
        console.log(`[DEBUG] Kanal 2 (2 saat): ${serverConfig?.trainingChannelId2}`);
        console.log(`[DEBUG] Kanal 3 (3 saat): ${serverConfig?.trainingChannelId3}`);
        console.log(`[DEBUG] Kanal 4 (4 saat): ${serverConfig?.trainingChannelId4}`);
        console.log(`[DEBUG] Kanal 5 (5 saat): ${serverConfig?.trainingChannelId5}`);
        console.log(`[DEBUG] Mevcut mesaj kanalı ID: ${message.channelId}`);

        // Ana antrenman kanalı kontrolü
        if (serverConfig?.trainingChannelId && message.channelId === serverConfig.trainingChannelId) {
          console.log('[DEBUG] Ana antrenman kanalında mesaj tespit edildi!');
          isTrainingChannel = true;
          trainingDuration = 1; // Ana kanal 1 saat
        } 
        // Kanal 1 - 1 saat
        else if (serverConfig?.trainingChannelId1 && message.channelId === serverConfig.trainingChannelId1) {
          console.log('[DEBUG] Kanal 1 (1 saat) antrenman kanalında mesaj tespit edildi!');
          isTrainingChannel = true;
          trainingDuration = 1;
        }
        // Kanal 2 - 2 saat
        else if (serverConfig?.trainingChannelId2 && message.channelId === serverConfig.trainingChannelId2) {
          console.log('[DEBUG] Kanal 2 (2 saat) antrenman kanalında mesaj tespit edildi!');
          isTrainingChannel = true;
          trainingDuration = 2;
        }
        // Kanal 3 - 3 saat
        else if (serverConfig?.trainingChannelId3 && message.channelId === serverConfig.trainingChannelId3) {
          console.log('[DEBUG] Kanal 3 (3 saat) antrenman kanalında mesaj tespit edildi!');
          isTrainingChannel = true;
          trainingDuration = 3;
        }
        // Kanal 4 - 4 saat
        else if (serverConfig?.trainingChannelId4 && message.channelId === serverConfig.trainingChannelId4) {
          console.log('[DEBUG] Kanal 4 (4 saat) antrenman kanalında mesaj tespit edildi!');
          isTrainingChannel = true;
          trainingDuration = 4;
        }
        // Kanal 5 - 5 saat
        else if (serverConfig?.trainingChannelId5 && message.channelId === serverConfig.trainingChannelId5) {
          console.log('[DEBUG] Kanal 5 (5 saat) antrenman kanalında mesaj tespit edildi!');
          isTrainingChannel = true;
          trainingDuration = 5;
        }

        console.log(`[DEBUG] İşlem sonucu: isTrainingChannel=${isTrainingChannel}, trainingDuration=${trainingDuration}`);
        
        // Eğer herhangi bir antrenman kanalıysa işlem yap
        if (isTrainingChannel) {
          console.log(`[ANTRENMAN] Antrenman kanalında mesaj alındı: ${message.content} (Süre: ${trainingDuration} saat)`);

          // İlk önce yeni formatta mesaj olup olmadığını kontrol et (1/1 kısa pas)
          const simpleTrainingPattern = /(\d+)\/(\d+)\s+(.+)/i;
          const matches = message.content.match(simpleTrainingPattern);

          if (matches && matches.length >= 4) {
            // Mesajın kimliğini kontrol et
            if (!message.id) {
              console.log('[ANTRENMAN] Mesaj ID bulunamadı, işlem yapılamıyor.');
              return;
            }

            // Bu mesaj zaten işlendi mi kontrol et
            if (processedMessageIds.has(message.id)) {
              console.log(`[ANTRENMAN] Bu mesaj zaten bellek içinde işaretli, tekrar işlenmeyecek: ${message.id}`);
              return;
            }

            // Mesajı işlenmiş olarak işaretle
            processedMessageIds.add(message.id);
            console.log(`[ANTRENMAN] Yeni mesaj işleniyor, bellekte işaretlendi: ${message.id} (toplam işlenen mesaj: ${processedMessageIds.size})`);

            // Format 1/1 şeklinde ancak gerçek süre kanaldan geliyor 
            // (trainingDuration değişkeni kanal ayarlarına göre belirlendi)
            const formatDuration = parseInt(matches[1], 10);
            const intensity = parseInt(matches[2], 10);
            const attributeName = matches[3].trim().toLowerCase();

            console.log(`[ANTRENMAN] Basit format algılandı: Format=${formatDuration}/${intensity}, Gerçek Süre=${trainingDuration}, Nitelik=${attributeName}`);
            
            // Değerler 1-5 aralığında mı kontrol et
            if (formatDuration < 1 || formatDuration > 5 || intensity < 1 || intensity > 5) {
              await message.reply('Antrenman formatı doğru ancak değerler 1-5 arasında olmalı.');
              return;
            }
            
            // Geçerli bir nitelik adı mı kontrol et
            const validAttributes = getValidAttributes();
            if (!validAttributes.includes(attributeName)) {
              // En yakın nitelik adını bul
              const closestAttribute = validAttributes.reduce((closest, current) => {
                const currentDistance = levenshteinDistance(attributeName, current);
                const closestDistance = levenshteinDistance(attributeName, closest);
                return currentDistance < closestDistance ? current : closest;
              }, validAttributes[0]);
              
              await message.reply(`"${attributeName}" geçerli bir nitelik değil. Belki "${closestAttribute}" demek istediniz? Geçerli nitelikler: ${validAttributes.join(', ')}`);
              return;
            }

            try {
              // Kullanıcıyı oluştur veya al
              // Eğer bir sunucu üyesiyse, sunucudaki görünen adını (nickname) al
              let displayName = message.author.username;
              if (message.member && message.member.displayName) {
                displayName = message.member.displayName;
              }
              
              const user = await storage.getOrCreateUser(
                message.author.id,
                message.author.username,
                message.author.displayAvatarURL(),
                displayName
              );

              // Sabit olarak +1 puan ekleyeceğiz, ancak kanal süresini hesaba katarak
              const attributeGain = Math.min(trainingDuration, 5); // Süre arttıkça, kazanılacak nitelik de artar (en fazla 5)

              console.log(`[ANTRENMAN] Kanal süresi: ${trainingDuration} saat, Kazanılacak puan: ${attributeGain}`);

              try {
                // Antrenman oturumu oluştur - yoğunluğu 1 olarak sabitledik
                // Burada duration yerine trainingDuration kullanarak kanal bazlı süreyi uyguluyoruz
                const session = await storage.createTrainingSession({
                  userId: user.userId,
                  attributeName: attributeName,
                  ticketId: "", // Boş string kullan, null yerine
                  duration: trainingDuration, // Kanaldan gelen süre değerini kullanıyoruz
                  intensity: intensity, // Girilen yoğunluk değerini kullanıyoruz
                  attributesGained: attributeGain, // Kanal süresine göre kazanılacak miktar
                  source: 'message',
                  messageId: message.id,
                  channelId: message.channelId
                });

                console.log(`[ANTRENMAN] Oturum başarıyla oluşturuldu: ${JSON.stringify(session)}`);

                // Kullanıcının niteliklerini güncelle - hem toplam hem haftalık değerini artır
                // source parametresi olarak 'message' ekleyerek bu değişikliğin antrenman kaynağını belirt
                await storage.updateAttribute(
                  user.userId, 
                  attributeName, 
                  attributeGain, // Toplam değere süreye bağlı puan ekle
                  attributeGain, // Haftalık değere aynı puanı ekle
                  false, // absoluteValue
                  false, // onlyUpdateWeekly
                  'message' // source - antrenman kaynaklı olduğunu belirt
                );

                // Yanıt olarak oturumu doğrula
                const embed = new EmbedBuilder()
                  .setTitle('🏋️ Antrenman Kaydı')
                  .setColor('#43B581')
                  .setDescription(`${message.author} adlı oyuncunun antrenman kaydı başarıyla oluşturuldu.`)
                  .addFields(
                    { name: 'Format', value: `${formatDuration}/${intensity}`, inline: true },
                    { name: 'Nitelik', value: attributeName, inline: true },
                    { name: 'Kazanılan Puan', value: `+${attributeGain}`, inline: true },
                    { name: 'Kanal Süresi', value: `${trainingDuration} saat`, inline: true }
                  )
                  .setTimestamp();

                // Onaylamak için emoji ekle
                await message.react('🏋️');
                await message.reply({ embeds: [embed] });

                // Log kanalına da gönder
                if (serverConfig?.fixLogChannelId) {
                  try {
                    const logChannel = await client.channels.fetch(serverConfig.fixLogChannelId) as TextChannel;
                    if (logChannel) {
                      await logChannel.send({ 
                        content: `${user.username} antrenman yaptı:`,
                        embeds: [embed] 
                      });
                    }
                  } catch (error) {
                    console.error('Antrenman log kanalına mesaj gönderilirken hata:', error);
                  }
                }
              } catch (error) {
                console.error('Error processing training session:', error);
                await message.reply('Antrenman oturumu oluşturulurken bir hata oluştu.');
              }
            } catch (error) {
              console.error('Error creating user for training:', error);
              await message.reply('Antrenman için kullanıcı bilgileri alınırken bir hata oluştu.');
            }
          } else {
            // Yeni format değilse, eski antrenman formatı kontrolü - artık kullanılmıyor
            console.log('[ANTRENMAN] Bu mesaj 1/1 formatında değil, işlenmeyecek.');
          }
        }
      } catch (trainingError) {
        console.error('Error processing training message:', trainingError);
      }
    } catch (messageError) {
      console.error('Error processing message:', messageError);
    }
  });
}

// Handle button interactions
async function handleButtonInteraction(interaction: ButtonInteraction) {
  const { customId } = interaction;

  // Handle create ticket button
  if (customId === 'create_ticket') {
    // Ticket oluşturma işlemi SADECE kullanıcıya görünecek şekilde hızlı yanıt
    await interaction.deferReply({ ephemeral: true });

    try {
      console.time('ticket_creation_total');
      // Hız optimizasyonu için asenkron işlemleri önden başlat
      const guild = interaction.guild;
      if (!guild) {
        return interaction.editReply('Bu komut sadece sunucularda kullanılabilir.');
      }

      // Kullanıcı ve config işlemlerini paralel olarak başlat (hızlandırma)
      console.time('parallel_operations');
      const [user, serverConfig] = await Promise.all([
        // Kullanıcı oluşturma/alma
        storage.getOrCreateUser(
          interaction.user.id,
          interaction.user.username,
          interaction.user.displayAvatarURL()
        ),
        
        // Sunucu konfigürasyonunu alma
        storage.getServerConfig(guild.id)
      ]);
      console.timeEnd('parallel_operations');

      // Staff rol ID'sini ayarla
      let staffRoleId = serverConfig?.staffRoleId || null;
      if (!staffRoleId && serverConfig) {
        try {
          // Neden veritabanında yok? Direkt SQL ile kontrol edelim
          console.time('staff_role_query');
          const query = 'SELECT staff_role_id FROM server_config WHERE guild_id = $1';
          const { rows } = await pool.query(query, [guild.id]);
          if (rows.length > 0 && rows[0].staff_role_id) {
            staffRoleId = rows[0].staff_role_id;
          }
          console.timeEnd('staff_role_query');
        } catch (error) {
          console.error('Error fetching staff role ID:', error);
        }
      }

      // Permission Overwrite'ları hızlı bir şekilde oluştur
      console.time('permission_setup');
      const permissionOverwrites = [
        {
          id: guild.id, // @everyone role
          deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        },
        {
          id: interaction.user.id, // Ticket oluşturan
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        }
      ];

      // Admin rolünü hızlı bir şekilde bul
      const adminRole = guild.roles.cache.find(r => r.permissions.has(PermissionFlagsBits.Administrator));
      if (adminRole) {
        permissionOverwrites.push({
          id: adminRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        });
      }

      // Yetkili rolünü ekle
      if (staffRoleId) {
        permissionOverwrites.push({
          id: staffRoleId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        });
      }
      console.timeEnd('permission_setup');

      // Kanal oluşturma ve ticket oluşturma işlemlerini paralel başlat
      console.time('channel_creation');
      const channelName = `ticket-${interaction.user.username}-${Date.now().toString().slice(-4)}`;
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites: permissionOverwrites
      });
      console.timeEnd('channel_creation');

      // Veritabanı işlemlerini ve UI hazırlığını paralel yap
      console.time('parallel_ui_db');
      
      // Ticket DB kayıt işlemi ve oyuncu istatistikleri işlemlerini paralel başlat
      const [ticket, playerStats] = await Promise.all([
        // Ticket oluştur
        storage.createTicket({
          ticketId: channel.id,
          userId: interaction.user.id,
          status: 'open',
          type: 'attribute'
        }),
        
        // Oyuncu istatistiklerini getir
        storage.getPlayerAttributeStats(interaction.user.id)
      ]);
      
      // UI bileşenlerini hızlı bir şekilde hazırla
      const playerStat = playerStats && playerStats.length > 0 ? playerStats[0] : null;
      
      // Oyuncu istatistik metni hazırla - limit ile kısa tut
      let statsText = '';
      if (playerStat) {
        statsText = `\n\n**Mevcut Nitelik Durumu:**\nToplam: **${playerStat.totalValue}** | Bu Hafta: **${playerStat.weeklyValue}**`;
        
        // En önemli 3 niteliği göster (çok uzun olmasın)
        if (playerStat.attributes && playerStat.attributes.length > 0) {
          const topAttributes = playerStat.attributes
            .sort((a: any, b: any) => b.value - a.value)
            .slice(0, 3);
            
          if (topAttributes.length > 0) {
            statsText += '\n\n**En Yüksek Nitelikler:**\n';
            topAttributes.forEach((attr: { name: string, value: number }) => {
              statsText += `${attr.name}: **${attr.value}** | `;
            });
            statsText = statsText.slice(0, -3); // Son separator'ı kaldır
          }
        }
      }
      
      // Embed ve butonları hazırla
      const embed = new EmbedBuilder()
        .setTitle('🎫 Yeni Nitelik Talebi')
        .setColor('#5865F2')
        .setDescription(`${interaction.user} tarafından açıldı.\n\nNitelik talebini "Nitelik Ekle" butonu ile ekleyebilirsin.${statsText}`)
        .setTimestamp()
        .setFooter({ text: `Ticket ID: ${channel.id}` });

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
      
      console.timeEnd('parallel_ui_db');
      
      // Son mesaj gönderme işlemleri
      console.time('final_messages');
      
      // Eğer varsa staff rol mention'ı
      let mentionText = staffRoleId ? `<@&${staffRoleId}> Yeni bir ticket açıldı!` : '';
      
      // Channel mesajını gönder
      await channel.send({ 
        content: mentionText, 
        embeds: [embed], 
        components: [row] 
      });
      
      // Son kullanıcı mesajını gönder
      await interaction.editReply(`✅ Ticket oluşturuldu: <#${channel.id}>`);
      
      console.timeEnd('final_messages');
      console.timeEnd('ticket_creation_total');
      
    } catch (error) {
      console.error('Error creating ticket:', error);
      await interaction.editReply('Ticket oluşturulurken bir hata oluştu.');
    }
  }

  // Handle close ticket button
  if (customId === 'close_ticket') {
    // Hemen tepki ver - etkileşim zaman aşımını önle
    await interaction.deferReply(); // En başta cevap ver

    // Check if this is a ticket channel
    const ticketId = interaction.channelId;
    if (!ticketId) {
      return interaction.editReply('Kanal bilgisi alınamadı.');
    }

    const ticket = await storage.getTicket(ticketId);

    if (!ticket) {
      return interaction.editReply('Bu bir ticket kanalı değil.');
    }

    if (ticket.status === 'closed') {
      return interaction.editReply('Bu ticket zaten kapatılmış.');
    }
    
    // Yetki kontrolü - sadece yöneticiler veya ticket sahibi kapatabilir
    const hasAdminPermission = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
    const isTicketOwner = interaction.user.id === ticket.userId;
    
    // Staff rol ID'sini kontrol et
    let hasStaffRole = false;
    if (interaction.guild) {
      const serverConfig = await storage.getServerConfig(interaction.guild.id);
      if (serverConfig?.staffRoleId) {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        hasStaffRole = member.roles.cache.has(serverConfig.staffRoleId);
      }
    }
    
    // Eğer yönetici veya staff rolüne sahip değilse ve ticket sahibi de değilse, erişimi engelle
    if (!hasAdminPermission && !hasStaffRole && !isTicketOwner) {
      return interaction.editReply('Bu ticketı kapatma yetkiniz yok. Sadece yetkililer veya ticket sahibi kapatabilir.');
    }

    // İlk mesajı gönder (hızlı yanıt için)
    await interaction.editReply('Ticket kapatılıyor...');

    try {
      // Get attribute requests for this ticket
      const attributeRequests = await storage.getAttributeRequests(ticketId);
      const totalAttributes = await storage.getTotalAttributesForTicket(ticketId);

      // Get user
      const user = await storage.getUserById(ticket.userId);
      if (!user) {
        return interaction.editReply('Bu ticketin sahibi bulunamadı.');
      }

      // Auto-approve remaining attribute requests
      for (const request of attributeRequests) {
        if (!request.approved) {
          await storage.approveAttributeRequest(request.id);
        }
      }

      // Get updated attribute requests
      const approvedRequests = await storage.getAttributeRequests(ticketId);

      // TAMAMEN YENİDEN YAZDIM - BUTON ILE KAPATMA KODUNU DÜZENLEDIM
      console.log(`[YENİ METOT - BUTON KAPATMA] Ticket kapatılıyor: ${ticketId}`);
      console.log(`[YENİ METOT - BUTON KAPATMA] Toplam nitelik talepleri: ${approvedRequests.length}`);

      // Tüm talepleri logla - hata ayıklama için
      for (const req of approvedRequests) {
        console.log(`[YENİ METOT - BUTON KAPATMA] Talep: ${req.attributeName} için ${req.valueRequested} puan`);
      }

      // Nitelik başına sadece en son talebi kullanacak şekilde harita oluşturalım
      const attributeMap = new Map<string, number>();

      // Önce tüm talepleri zaman damgasına göre sıralayalım (en yenisi en sonda)
      const sortedRequests = [...approvedRequests].sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // Her nitelik için sadece bir kez ekleme yapacağız - en son talep kazanır
      for (const request of sortedRequests) {
        // Nitelik adını ve tam olarak istenen değeri kullan - kesinlikle çarpma yok
        // Değerler yazılırken son güncellenen değeri yazıyoruz (nitelik başına tek güncelleme)
        attributeMap.set(request.attributeName, request.valueRequested);
        console.log(`[YENİ METOT - BUTON] Nitelik talebi: ${request.attributeName} için SADECE +${request.valueRequested}`);
      }

      // Her nitelik için sadece bir kez güncelleme yapacağız
      for (const [attributeName, valueToAdd] of Array.from(attributeMap.entries())) {
        console.log(`[YENİ METOT - BUTON] GÜNCELLEME BAŞLIYOR: User ${user.userId} için ${attributeName} niteliğine TAM OLARAK +${valueToAdd} ekleniyor`);

        try {
          // Önce mevcut değeri alıp loglayalım
          const beforeAttr = await storage.getAttribute(user.userId, attributeName);
          if (beforeAttr) {
            console.log(`[YENİ METOT - BUTON] ÖNCEKİ DEĞER: ${attributeName} = ${beforeAttr.value}`);
          } else {
            console.log(`[YENİ METOT - BUTON] YENİ NİTELİK OLUŞTURULACAK: ${attributeName}`);
          }

          // Niteliği güncelle - değeri direkt olarak ekleyerek
          // NOT: Bu yeni kodda ticket ile artan değer kullanıcıya doğrudan ekleniyor (çarpma işlemi yok)
          await storage.updateAttribute(
            user.userId,
            attributeName,
            valueToAdd, // Talep edilen değeri direkt kullan (çarpma işlemi yok)
            undefined, // Haftalık değeri otomatik olarak güncellenir
            false, // absoluteValue=false: değeri ekle, değiştirme
            false, // onlyUpdateWeekly=false: hem toplam hem haftalık değeri güncelle
            'ticket_button' // source=ticket_button: bu değişiklik ticket butonundan kapanmayla oldu
          );

          // Sonraki değeri alıp loglayalım
          const afterAttr = await storage.getAttribute(user.userId, attributeName);
          if (afterAttr) {
            console.log(`[YENİ METOT - BUTON] YENİ DEĞER: ${attributeName} = ${afterAttr.value}`);
            if (beforeAttr) {
              const diff = afterAttr.value - beforeAttr.value;
              console.log(`[YENİ METOT - BUTON] FARK: +${diff} (Beklenen: +${valueToAdd})`);
              if (diff !== valueToAdd) {
                console.log(`[YENİ METOT - BUTON] UYARI! Beklenen fark (${valueToAdd}) ile gerçek fark (${diff}) eşleşmiyor!`);
              }
            }
          }
        } catch (error) {
          console.error(`[YENİ METOT - BUTON] HATA: Nitelik ${attributeName} güncellenirken hata oluştu:`, error);
        }
      }

      // Now close the ticket
      await storage.closeTicket(ticketId, interaction.user.id);

      // Get final stats
      const updatedTotalAttributes = await storage.getTotalAttributesForTicket(ticketId);

      // Create embed for the response
      const embed = createAttributeEmbed(user, approvedRequests, updatedTotalAttributes);
      await interaction.channel?.send({ embeds: [embed] });

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
            }
          } catch (error) {
            console.error('Fix log kanalına mesaj gönderilirken hata:', error);
          }
        }
      }

      // Farewell message and close
      await interaction.editReply('✅ Ticket kapatıldı ve işlendi.');
      
      // Add confirmation message about deleting the channel
      if (interaction.channel?.type === ChannelType.GuildText) {
        await interaction.channel.send('Bu kanal 5 saniye içinde silinecek...');
      }

      // Wait and delete the channel
      setTimeout(async () => {
        try {
          const channel = interaction.channel;
          if (channel?.type === ChannelType.GuildText) {
            await channel.delete('Ticket kapatıldı');
          }
        } catch (error) {
          console.error('Error deleting channel:', error);
        }
      }, 5000);

    } catch (error) {
      console.error('Error handling close ticket:', error);
      await interaction.editReply('Ticket kapatılırken bir hata oluştu.');
    }
  }

  // Handle add attribute button
  if (customId === 'add_attribute') {
    try {
      // Kanal ID'sini ticketId olarak kullan
      const ticketId = interaction.channelId;
      
      // Ticket'ı kontrol et
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return interaction.reply({ 
          content: 'Bu kanal bir ticket değil.', 
          ephemeral: true 
        });
      }
      
      if (ticket.status === 'closed') {
        return interaction.reply({ 
          content: 'Bu ticket kapatılmış durumda, nitelik eklenemez.', 
          ephemeral: true 
        });
      }
      
      // Modal oluştur
      const modal = new ModalBuilder()
        .setCustomId('attribute_modal')
        .setTitle('Nitelik Talebi Ekle');
      
      // Modal ekranı için inputlar
      const attributeNameInput = new TextInputBuilder()
        .setCustomId('attributeName')
        .setLabel('Nitelik Adı')
        .setPlaceholder('Örnek: şut, pas, hız, dayanıklılık...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      
      const attributeValueInput = new TextInputBuilder()
        .setCustomId('attributeValue')
        .setLabel('Eklenecek Değer')
        .setPlaceholder('Sadece sayı girin: 1, 2, 3...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      
      const attributeReasonInput = new TextInputBuilder()
        .setCustomId('attributeReason')
        .setLabel('Gerekçe (Opsiyonel)')
        .setPlaceholder('Neden bu niteliği ekliyorsunuz?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);
      
      // Input alanlarını action row'a ekle
      const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(attributeNameInput);
      const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(attributeValueInput);
      const thirdActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(attributeReasonInput);
      
      // Modal'a action row'ları ekle
      modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);
      
      // Modal'ı göster
      await interaction.showModal(modal);
    } catch (error) {
      console.error('Error showing attribute modal:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'Nitelik ekleme işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.', 
          ephemeral: true 
        });
      }
    }
  }

  // Handle approve attribute request button
  if (customId.startsWith('approve_attribute_')) {
    await interaction.deferReply();
    
    try {
      // Get the request ID from the button's custom ID
      const requestId = parseInt(customId.replace('approve_attribute_', ''), 10);
      if (isNaN(requestId)) {
        return interaction.editReply('Geçersiz talep ID\'si.');
      }
      
      // Check if the user has permission to approve (admin or has staff role)
      const hasAdminPermission = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
      
      // Staff rol ID'sini kontrol et
      let hasStaffRole = false;
      if (interaction.guild) {
        const serverConfig = await storage.getServerConfig(interaction.guild.id);
        if (serverConfig?.staffRoleId) {
          const member = await interaction.guild.members.fetch(interaction.user.id);
          hasStaffRole = member.roles.cache.has(serverConfig.staffRoleId);
        }
      }
      
      if (!hasAdminPermission && !hasStaffRole) {
        return interaction.editReply('Bu talebi onaylamak için yetkiniz yok. Sadece yetkililer onaylayabilir.');
      }
      
      // Get the attribute request
      const requests = await storage.getAttributeRequests(interaction.channelId);
      const request = requests.find(r => r.id === requestId);
      
      if (!request) {
        return interaction.editReply('Talep bulunamadı.');
      }
      
      if (request.approved) {
        return interaction.editReply('Bu talep zaten onaylanmış.');
      }
      
      // Approve the request
      const approvedRequest = await storage.approveAttributeRequest(requestId);
      
      // Create embed for response
      const embed = new EmbedBuilder()
        .setTitle('✅ Nitelik Talebi Onaylandı')
        .setColor('#43B581')
        .setDescription(`${interaction.user} tarafından onaylandı.`)
        .addFields(
          { name: 'Nitelik', value: approvedRequest.attributeName, inline: true },
          { name: 'Eklenecek Değer', value: `+${approvedRequest.valueRequested}`, inline: true }
        )
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
      
      // Update the original message to disabled the button
      try {
        const message = await interaction.channel?.messages.fetch(request.messageId);
        if (message && message.editable) {
          // Create a new button with the same ID but disabled
          const disabledButton = new ButtonBuilder()
            .setCustomId(`approve_attribute_${requestId}`)
            .setLabel('Onaylandı ✅')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true);
          
          const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButton);
          
          // Update the original message with the disabled button
          await message.edit({ components: [disabledRow] });
        }
      } catch (error) {
        console.error('Error updating original message:', error);
      }
    } catch (error) {
      console.error('Error approving attribute request:', error);
      await interaction.editReply('Nitelik talebi onaylanırken bir hata oluştu.');
    }
  }
}

// Handle modal submissions
async function handleModalSubmit(interaction: ModalSubmitInteraction) {
  if (interaction.customId === 'attribute_modal') {
    await interaction.deferReply();
    
    try {
      // Girilen değerleri al
      const attributeName = interaction.fields.getTextInputValue('attributeName').toLowerCase().trim();
      const attributeValueRaw = interaction.fields.getTextInputValue('attributeValue').trim();
      let attributeReason = '';
      
      try {
        attributeReason = interaction.fields.getTextInputValue('attributeReason');
      } catch (e) {
        // Gerekçe opsiyonel, eksikse hata vermeden devam et
        attributeReason = '';
      }
      
      // Geçerli bir nitelik adı mı kontrol et
      const validAttributes = getValidAttributes();
      if (!validAttributes.includes(attributeName)) {
        // En yakın nitelik adını bul
        const closestAttribute = validAttributes.reduce((closest, current) => {
          const currentDistance = levenshteinDistance(attributeName, current);
          const closestDistance = levenshteinDistance(attributeName, closest);
          return currentDistance < closestDistance ? current : closest;
        }, validAttributes[0]);
        
        return interaction.editReply(`"${attributeName}" geçerli bir nitelik değil. Belki "${closestAttribute}" demek istediniz? Geçerli nitelikler: ${validAttributes.join(', ')}`);
      }
      
      // Değer bir sayı mı kontrol et
      const attributeValue = parseInt(attributeValueRaw, 10);
      if (isNaN(attributeValue) || attributeValue <= 0) {
        return interaction.editReply('Eklenecek değer pozitif bir sayı olmalıdır.');
      }
      
      if (attributeValue > 10) {
        return interaction.editReply('Eklenecek değer en fazla 10 olabilir.');
      }
      
      // Ticket ID'sini al (kanal ID'si)
      const ticketId = interaction.channelId;
      
      // Ticket'ı kontrol et
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return interaction.editReply('Bu kanal bir ticket değil.');
      }
      
      if (ticket.status === 'closed') {
        return interaction.editReply('Bu ticket kapatılmış durumda, nitelik eklenemez.');
      }
      
      // Kullanıcıyı kontrol et
      const user = await storage.getUserById(ticket.userId);
      if (!user) {
        return interaction.editReply('Ticket sahibi bulunamadı.');
      }
      
      // Toplam talep edilen nitelik miktarını kontrol et
      const currentTotal = await storage.getTotalAttributesForTicket(ticketId);
      if (currentTotal + attributeValue > 20) {
        return interaction.editReply(`Bu ticket için maksimum 20 nitelik puanı talep edilebilir. Şu anki toplam: ${currentTotal}, eklemek istediğiniz: ${attributeValue}`);
      }
      
      // Attribute request oluştur
      const attributeRequest = await storage.createAttributeRequest({
        ticketId,
        attributeName,
        valueRequested: attributeValue,
        reason: attributeReason,
        approved: false,
        messageId: '',
        requestedBy: interaction.user.id
      });
      
      // Yanıt için bir embed oluştur
      const embed = new EmbedBuilder()
        .setTitle('📝 Yeni Nitelik Talebi')
        .setColor('#5865F2')
        .setDescription(`${interaction.user} tarafından talep edildi.`)
        .addFields(
          { name: 'Nitelik', value: attributeName, inline: true },
          { name: 'Eklenecek Değer', value: `+${attributeValue}`, inline: true },
          { name: 'Oyuncu', value: `<@${user.userId}>`, inline: true }
        )
        .setTimestamp();
      
      if (attributeReason) {
        embed.addFields({ name: 'Gerekçe', value: attributeReason, inline: false });
      }
      
      // Onay butonu oluştur
      const approveButton = new ButtonBuilder()
        .setCustomId(`approve_attribute_${attributeRequest.id}`)
        .setLabel('Onayla')
        .setStyle(ButtonStyle.Success);
      
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(approveButton);
      
      // Embed ve buton ile yanıt gönder
      const reply = await interaction.editReply({ 
        embeds: [embed],
        components: [row]
      });
      
      // Mesaj ID'sini attribute request'e kaydet
      // Bu, onay butonuna basıldığında orijinal mesajı güncellemek için kullanılacak
      if (reply) {
        try {
          // messageId'yi güncelle
          const message = await interaction.channel?.messages.fetch(reply.id);
          if (message) {
            // messageId'yi veritabanında güncelle - SQL kullan
            const query = 'UPDATE attribute_request SET message_id = $1 WHERE id = $2';
            await pool.query(query, [message.id, attributeRequest.id]);
          }
        } catch (error) {
          console.error('Error updating message ID in attribute request:', error);
        }
      }
    } catch (error) {
      console.error('Error handling attribute modal submit:', error);
      await interaction.editReply('Nitelik talebi oluşturulurken bir hata oluştu.');
    }
  }
}
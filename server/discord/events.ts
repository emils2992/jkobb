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
import { parseAttributeRequest, parseTrainingMessage, createAttributeEmbed } from './utils';
import { pool } from '../db';

// İşlenmiş mesaj ID'lerini global olarak saklayacak bir set
const processedMessageIds = new Set<string>();

// Rate limiting için basit bir Map
const commandCooldowns = new Map<string, number>();
const COOLDOWN_PERIOD = 60 * 1000; // 1 dakika (milisaniye cinsinden)

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

        // Artık nitelik taleplerini mesajdan işlemiyoruz, sadece buton üzerinden yapılabilir
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

      // Antrenman mesajlarını kontrol et
      if (message.guild) {
        const serverConfig = await storage.getServerConfig(message.guild.id);

        // Mesajın hangi antrenman kanalında olduğunu kontrol et
        // Farklı kanallar için farklı süre değerlerini belirlemek için bu kontrolü yapıyoruz
        let trainingDuration = 1; // Varsayılan süre 1 saat
        let isTrainingChannel = false;

        // Ana antrenman kanalı
        if (serverConfig?.trainingChannelId && message.channelId === serverConfig.trainingChannelId) {
          isTrainingChannel = true;
          trainingDuration = 1; // Ana kanal 1 saat
        } 
        // Kanal 1 - 1 saat
        else if (serverConfig?.trainingChannelId1 && message.channelId === serverConfig.trainingChannelId1) {
          isTrainingChannel = true;
          trainingDuration = 1;
        }
        // Kanal 2 - 2 saat
        else if (serverConfig?.trainingChannelId2 && message.channelId === serverConfig.trainingChannelId2) {
          isTrainingChannel = true;
          trainingDuration = 2;
        }
        // Kanal 3 - 3 saat
        else if (serverConfig?.trainingChannelId3 && message.channelId === serverConfig.trainingChannelId3) {
          isTrainingChannel = true;
          trainingDuration = 3;
        }
        // Kanal 4 - 4 saat
        else if (serverConfig?.trainingChannelId4 && message.channelId === serverConfig.trainingChannelId4) {
          isTrainingChannel = true;
          trainingDuration = 4;
        }
        // Kanal 5 - 5 saat
        else if (serverConfig?.trainingChannelId5 && message.channelId === serverConfig.trainingChannelId5) {
          isTrainingChannel = true;
          trainingDuration = 5;
        }

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
            const attributeName = matches[3].trim();

            // Yoğunluk değerini kullanmıyoruz artık
            console.log(`[ANTRENMAN] Basit format algılandı: Format=${formatDuration}/1, Gerçek Süre=${trainingDuration}, Nitelik=${attributeName}`);

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

              // Sabit olarak +1 puan ekleyeceğiz
              const attributeValue = 1;

              // Veritabanında bu mesaj zaten var mı diye kontrol et
              // Bu kontrol artık sadece günlük bilgi içindir, gerçek kontrol daha yukarıda yapılıyor
              // Antrenman oturumu oluştur - yoğunluğu 1 olarak sabitledik
              // Burada duration yerine trainingDuration kullanarak kanal bazlı süreyi uyguluyoruz
              const session = await storage.createTrainingSession({
                userId: user.userId,
                attributeName: attributeName,
                ticketId: null,
                duration: trainingDuration, // Kanaldan gelen süre değerini kullanıyoruz
                intensity: 1, // Sabit değer kullanıyoruz
                attributesGained: attributeValue,
                source: 'message',
                messageId: message.id,
                channelId: message.channelId
              });

              // Kullanıcının niteliklerini güncelle - hem toplam hem haftalık değerini artır
              // source parametresi olarak 'message' ekleyerek bu değişikliğin antrenman kaynağını belirt
              // Sadece +1 puan eklemek için attributeValue direkt olarak kullanılıyor
              await storage.updateAttribute(
                user.userId, 
                attributeName, 
                1, // Toplam değeri sadece 1 artır
                1, // Haftalık değeri de 1 artır
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
                  { name: 'Format', value: `${formatDuration}/1`, inline: true },
                  { name: 'Nitelik', value: attributeName, inline: true },
                  { name: 'Kazanılan Puan', value: `+${attributeValue}`, inline: true },
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

              return; // Mesajı işledik, diğer işlemlere geçme
            } catch (error) {
              console.error('Error processing simple training message:', error);
              await message.reply('Antrenman kaydı oluşturulurken bir hata oluştu.');
              return;
            }
          }

          // Eski kompleks antrenman formatı 
          // Kullanıcıyı oluştur veya al
          // Sunucudaki görünen adını (nickname) kullan
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
              attributeName: trainingInfo.attributeName,
              duration: trainingInfo.duration,
              intensity: trainingInfo.intensity,
              attributesGained: trainingInfo.points,
              source: 'training',
              messageId: message.id,
              channelId: message.channelId
            });

            // Kullanıcının niteliklerini güncelle (sadece haftalık değeri artırıyoruz)
            // SADECE haftalık değeri artır, toplam değeri değiştirme
            await storage.updateAttribute(
              user.userId, 
              trainingInfo.attributeName, 
              0, // Toplam değeri artırmıyoruz
              trainingInfo.points, // Haftalık değeri artırıyoruz
              false, // absoluteValue parametresi artık önemsiz, bu değer dikkate alınmıyor
              true, // onlyUpdateWeekly - sadece haftalık değeri güncelle
              'training' // source - bu değişiklik antrenman kaynaklı olduğunu belirt
            );

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
                { name: 'Haftalık İlerleme', value: `+${trainingInfo.points}`, inline: true },
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
          console.error(`[YENİ METOT - BUTON] HATA: ${attributeName} güncellenirken hata oluştu:`, error);
        }
      }

      // Close the ticket and record who closed it
      await storage.closeTicket(ticketId, interaction.user.id);

      // Toplam nitelik sayısını hesapla - attributeMap'teki değerleri topla
      const updatedTotalAttributes = Array.from(attributeMap.values()).reduce((sum, value) => sum + value, 0);
      console.log(`[YENİ METOT - BUTON] Toplam nitelik puanı: ${updatedTotalAttributes}`);

      // Veritabanından toplam puanı kontrol etmek için - debug
      const dbTotalAttributes = await storage.getTotalAttributesForTicket(ticketId);
      console.log(`[YENİ METOT - BUTON] Veritabanına göre toplam: ${dbTotalAttributes}`);

      if (updatedTotalAttributes !== dbTotalAttributes) {
        console.log(`[YENİ METOT - BUTON] UYARI! Hesaplanan toplam (${updatedTotalAttributes}) ile veritabanı toplamı (${dbTotalAttributes}) eşleşmiyor!`);
      }

      // Create embed for response
      const embed = createAttributeEmbed(user, approvedRequests, updatedTotalAttributes);
      await interaction.editReply({ embeds: [embed] });

      // Post to fix log channel if configured
      if (interaction.guild?.id) {
        const serverConfig = await storage.getServerConfig(interaction.guild?.id);
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
              await textChannel.send('Ticket kanalı siliniyor...');
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

  // Tüm modaller için genel işlemler
  console.log(`[MODAL] "${customId}" ID'li modal işleniyor...`);

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

      // Hemen tepki ver - etkileşim zaman aşımını önle
      await interaction.deferReply(); // En başta cevap ver

      if (!ticket) {
        return await interaction.editReply('Bu bir ticket kanalı değil.');
      }

      if (ticket.status === 'closed') {
        return await interaction.editReply('Bu ticket zaten kapatılmış.');
      }

      // İlk mesajı gönder (hızlı yanıt için)
      await interaction.editReply('Ticket kapatılıyor...');

      // Ticket kapatma işlemleri
      const attributeRequests = await storage.getAttributeRequests(ticketId);
      const totalAttributes = await storage.getTotalAttributesForTicket(ticketId);

      // Update user's attributes
      const user = await storage.getUserById(ticket.userId);
      if (!user) {
        return await interaction.editReply('Bu ticketin sahibi bulunamadı.');
      }

      // Process approved attribute requests
      // Nitelik başına sadece en son talebi kullanacak şekilde harita oluşturalım
      const attributeMap = new Map<string, number>();

      // Önce onaylanmış talepleri zaman damgasına göre sıralayalım (en yenisi en sonda)
      const approvedSortedRequests = attributeRequests
        .filter(req => req.approved)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Her nitelik için sadece en son talebi haritaya ekleyelim
      for (const request of approvedSortedRequests) {
        // KESIN FIX: Değerleri direkt olarak kullanıyoruz, hiçbir çarpma işlemi yok
        // Kullanıcının talep ettiği değer (örn: +3) direkt olarak ekleniyor
        attributeMap.set(request.attributeName, request.valueRequested);
        console.log(`[YENİ METOT - MODAL] Nitelik talebi: ${request.attributeName} için SADECE +${request.valueRequested}`);
      }

      // Her nitelik için sadece bir kez güncelleme yapacağız
      for (const [attributeName, valueToAdd] of Array.from(attributeMap.entries())) {
        console.log(`[YENİ METOT - MODAL] GÜNCELLEME BAŞLIYOR: User ${user.userId} için ${attributeName} niteliğine TAM OLARAK +${valueToAdd} ekleniyor`);

        try {
          // Önce mevcut değeri alıp loglayalım
          const beforeAttr = await storage.getAttribute(user.userId, attributeName);
          if (beforeAttr) {
            console.log(`[YENİ METOT - MODAL] ÖNCEKİ DEĞER: ${attributeName} = ${beforeAttr.value}`);
          } else {
            console.log(`[YENİ METOT - MODAL] YENİ NİTELİK OLUŞTURULACAK: ${attributeName}`);
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
            console.log(`[YENİ METOT - MODAL] YENİ DEĞER: ${attributeName} = ${afterAttr.value}`);
            if (beforeAttr) {
              const diff = afterAttr.value - beforeAttr.value;
              console.log(`[YENİ METOT - MODAL] FARK: +${diff} (Beklenen: +${valueToAdd})`);
              if (diff !== valueToAdd) {
                console.log(`[YENİ METOT - MODAL] UYARI! Beklenen fark (${valueToAdd}) ile gerçek fark (${diff}) eşleşmiyor!`);
              }
            }
          }
        } catch (error) {
          console.error(`[YENİ METOT - MODAL] HATA: ${attributeName} güncellenirken hata oluştu:`, error);
        }
      }

      // Close the ticket and record who closed it
      await storage.closeTicket(ticketId, interaction.user.id);

      // Toplam nitelik sayısını hesapla - attributeMap'teki değerleri topla
      const updatedTotalAttributes = Array.from(attributeMap.values()).reduce((sum, value) => sum + value, 0);
      console.log(`[YENİ METOT - MODAL] Toplam nitelik puanı: ${updatedTotalAttributes}`);

      // Veritabanından toplam puanı kontrol etmek için - debug
      const dbTotalAttributes = await storage.getTotalAttributesForTicket(ticketId);
      console.log(`[YENİ METOT - MODAL] Veritabanına göre toplam: ${dbTotalAttributes}`);

      if (updatedTotalAttributes !== dbTotalAttributes) {
        console.log(`[YENİ METOT - MODAL] UYARI! Hesaplanan toplam (${updatedTotalAttributes}) ile veritabanı toplamı (${dbTotalAttributes}) eşleşmiyor!`);
      }

      // Create embed for the response - onay durumu değişebileceği için tüm talepleri kullan
      const embed = createAttributeEmbed(user, attributeRequests, updatedTotalAttributes);
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
    try {
      // Önce değişkenleri alalım - deferReply'dan önce almalıyız
      const attributeName = interaction.fields.getTextInputValue('attribute_name');
      const attributeValueStr = interaction.fields.getTextInputValue('attribute_value');
      const attributeValue = parseInt(attributeValueStr, 10);

      // Önce etkileşimi bekletin - "don't response" hatasını önlemek için
      await interaction.deferReply().catch(error => {
        console.error("Modal deferReply hatası:", error);
      });

      if (isNaN(attributeValue) || attributeValue < 1 || attributeValue > 10) {
        return interaction.editReply({
          content: 'Geçersiz nitelik değeri. 1 ile 10 arasında bir sayı girin.'
        }).catch(error => {
          console.error("Modal yanıt hatası:", error);
        });
      }

      // Save attribute request
      const ticketId = interaction.channelId;
      if (!ticketId) {
        return interaction.editReply({
          content: 'Kanal bilgisi alınamadı.'
        }).catch(error => {
          console.error("Modal yanıt hatası:", error);
        });
      }

      console.log(`Nitelik talebi oluşturuluyor: ${attributeName} +${attributeValue} (Ticket: ${ticketId})`);

      // Şimdi yeni talebi ekleyelim
      const request = await storage.createAttributeRequest({
        ticketId: ticketId.toString(),  // Açıkça string'e dönüştür
        attributeName,
        valueRequested: attributeValue,
        approved: false
      });

      console.log(`Nitelik talebi başarıyla oluşturuldu: ID=${request.id}`);

      // Create response embed
      const embed = new EmbedBuilder()
        .setTitle('📝 Nitelik Talebi Eklendi')
        .setColor('#5865F2')
        .addFields(
          { name: 'Nitelik', value: attributeName, inline: true },
          { name: 'Değer', value: `+${attributeValue}`, inline: true }
        )
        .setFooter({ text: `Talep ID: ${request.id}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] }).catch(error => {
        console.error("Modal yanıt gönderirken hata:", error);
      });
    } catch (error) {
      console.error('Error adding attribute request:', error);
      // Eğer etkileşim henüz yanıtlanmamışsa
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Nitelik talebi eklenirken bir hata oluştu.',
          ephemeral: true
        }).catch(err => console.error('Modal yanıtlanırken hata:', err));
      } else {
        // Eğer zaten bir yanıt bekleniyorsa
        await interaction.editReply({
          content: 'Nitelik talebi eklenirken bir hata oluştu.'
        }).catch(err => console.error('Modal yanıtı düzenlenirken hata:', err));
      }
    }
  }
}
}
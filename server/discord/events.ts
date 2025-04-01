
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
  TextChannel,
  ChatInputCommandInteraction,
  InteractionResponse
} from 'discord.js';
import { client } from './bot';
import { commands } from './commands';
import { storage } from '../storage';
import { parseAttributeRequest, parseTrainingMessage, createAttributeEmbed } from './utils';

// İşlenmiş mesaj ve etkileşim ID'lerini global olarak saklayacak setler
// Bu setler, bellek tüketimini azaltmak için periyodik olarak temizlenecek
const processedMessageIds = new Set<string>();
const processedInteractionIds = new Set<string>();
const MAX_CACHE_SIZE = 5000; // Maksimum önbellek boyutu

// Önbelleği periyodik olarak temizle (her 1 saatte bir)
setInterval(() => {
  const oldSize = processedMessageIds.size + processedInteractionIds.size;
  
  // Setleri temizle, en son 100 öğeyi tut
  if (processedMessageIds.size > 100) {
    const keepItems = Array.from(processedMessageIds).slice(-100);
    processedMessageIds.clear();
    keepItems.forEach(id => processedMessageIds.add(id));
  }
  
  if (processedInteractionIds.size > 100) {
    const keepItems = Array.from(processedInteractionIds).slice(-100);
    processedInteractionIds.clear();
    keepItems.forEach(id => processedInteractionIds.add(id));
  }
  
  const newSize = processedMessageIds.size + processedInteractionIds.size;
  console.log(`Önbellek temizlendi: ${oldSize} -> ${newSize} öğe`);
}, 60 * 60 * 1000); // 1 saat

export function setupEventHandlers() {
  // Handle command interactions
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      // Önce etkileşim ID'si var mı ve zaten işlendi mi kontrol et
      if (!interaction.id) {
        console.log('[ETKILEŞIM] Etkileşim ID\'si yok, işlem yapılmıyor');
        return; // ID olmayan etkileşimleri işleme 
      }
      
      // Her etkileşim için benzersiz bir anahtar oluştur
      // Tip ve ID birleşimi daha spesifik olur
      const interactionKey = `${interaction.type}_${interaction.id}`;
      
      // Bu etkileşim anahtarı zaten işlendi mi?
      if (processedInteractionIds.has(interactionKey)) {
        console.log(`[ETKILEŞIM] Bu etkileşim zaten işlendi, tekrar işlenmeyecek: ${interactionKey}`);
        return;
      }
      
      // Etkileşimi işlenmiş olarak işaretle
      processedInteractionIds.add(interactionKey);
      console.log(`[ETKILEŞIM] Yeni etkileşim işleniyor: ${interactionKey}`);
      
      // Önbellek boyutu kontrol
      if (processedInteractionIds.size >= MAX_CACHE_SIZE) {
        // İlk yarısını temizle - FIFO (İlk giren ilk çıkar)
        const keepItems = Array.from(processedInteractionIds).slice(MAX_CACHE_SIZE / 2);
        processedInteractionIds.clear();
        keepItems.forEach(key => processedInteractionIds.add(key));
        console.log(`Etkileşim önbelleği temizlendi: ${MAX_CACHE_SIZE} -> ${processedInteractionIds.size} öğe`);
      }
      
      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;
        const command = commands.get(commandName);

        if (!command) {
          console.log(`[KOMUT] Bilinmeyen komut istendi: ${commandName}`);
          return;
        }
        
        console.log(`[KOMUT] Çalıştırılıyor: /${commandName} (${interaction.id})`);
        
        try {
          // deferReply işlemini komut içinde ele alıyoruz, buradan kaldırıyoruz
          // Özellikle ticket komutu için bu gerekli, çünkü kendi defer işlemini yapıyor
          
          // Doğrudan komutu çalıştır
          await command(interaction).catch((error: any) => {
            console.error(`[KOMUT] ${commandName} çalıştırılırken hata:`, error);
            
            // Eğer hala yanıt vermediyse hata mesajı göster
            if (!interaction.replied && !interaction.deferred) {
              interaction.reply({ 
                content: 'Komut işlenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.', 
                ephemeral: true 
              }).catch((replyError) => {
                console.error(`[KOMUT] Hata mesajı gösterilemedi: ${replyError.message}`);
              });
            }
          });
        } catch (error) {
          // Genel hata durumu - konsola hata logu yaz
          console.error(`[KOMUT] ${commandName} etkileşiminde beklenmeyen hata:`, error);
        }
      }

      // Handle button interactions with better error handling
      else if (interaction.isButton()) {
        try {
          // Her buton etkileşimi için benzersiz anahtar oluştur
          const buttonKey = `button_${interaction.id}`;
      
          // Bu anahtar zaten işlendi mi kontrol et
          if (processedInteractionIds.has(buttonKey)) {
            console.log(`[BUTON] Bu etkileşim zaten işlendi, tekrar işlenmeyecek: ${buttonKey}`);
            return;
          }
      
          console.log(`[BUTON] Yeni buton etkileşimi: ${buttonKey} (${interaction.customId})`);
      
          // Etkileşimi işlenmiş olarak işaretle
          processedInteractionIds.add(buttonKey);
          
          // Doğrudan buton işleyicisini çağır - deferUpdate zaten handleButtonInteraction içinde
          await handleButtonInteraction(interaction);
        } catch (error) {
          console.error('[BUTON] Buton etkileşimi işlenirken hata:', error);
          
          // Etkileşim durumunu kontrol et ve hata mesajı göndermeye çalış
          if (!interaction.replied && !interaction.deferred) {
            try {
              await interaction.reply({ 
                content: 'İşleminiz alınamadı. Lütfen daha sonra tekrar deneyin.', 
                ephemeral: true 
              }).catch(() => {}); // Sessizce başarısız ol
            } catch (e) {
              // Bu hatayı sessizce yut
            }
          }
        }
      }

      // Handle modal submissions with improved error handling
      else if (interaction.isModalSubmit()) {
        try {
          // Etkileşimi askıya al
          await interaction.deferReply({ ephemeral: true }).catch(() => {
            // Eğer deferReply başarısız olursa sessizce devam et
            console.log(`[MODAL] Modal etkileşimi için deferReply başarısız, muhtemelen geçersiz etkileşim`);
          });
          
          // Daha sonra modal işleyicisini çağır
          await handleModalSubmit(interaction);
        } catch (error) {
          console.error('[MODAL] Modal etkileşimi işlenirken hata:', error);
          
          // Etkileşim durumunu kontrol et
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: 'İşleminiz alınamadı. Lütfen daha sonra tekrar deneyin.', 
              ephemeral: true 
            }).catch(() => {}); // Sessizce başarısız ol
          }
        }
      }
    } catch (error) {
      // Genel hata durumu - konsola hata logu yaz
      console.error('[ETKILEŞIM] Genel etkileşim işleme hatası:', error);
    }
  });

  // Handle messages for attribute requests in tickets and training
  client.on(Events.MessageCreate, async (message: Message) => {
    try {
      // Bot mesajlarını ve ID'siz mesajları yoksay
      if (message.author.bot || !message.id) return;
      
      // Bu mesaj zaten işlendi mi kontrol et
      if (processedMessageIds.has(message.id)) {
        console.log(`[MESAJ] Bu mesaj zaten işlendi, tekrar işlenmeyecek: ${message.id}`);
        return;
      }
      
      // Mesajı işlenmiş olarak işaretle
      processedMessageIds.add(message.id);
      
      // Önbellek boyutu kontrol
      if (processedMessageIds.size >= MAX_CACHE_SIZE) {
        // İlk yarısını temizle
        const keepItems = Array.from(processedMessageIds).slice(MAX_CACHE_SIZE / 2);
        processedMessageIds.clear();
        keepItems.forEach(id => processedMessageIds.add(id));
        console.log(`Mesaj önbelleği temizlendi: ${MAX_CACHE_SIZE} -> ${processedMessageIds.size} öğe`);
      }
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

        // Antrenman kanalındaysa kontrol et
        if (serverConfig?.trainingChannelId && message.channelId === serverConfig.trainingChannelId) {
          console.log(`[ANTRENMAN] Antrenman kanalında mesaj alındı: ${message.content}`);

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

            const duration = parseInt(matches[1], 10);
            const attributeName = matches[3].trim();

            // Yoğunluk değerini kullanmıyoruz artık
            console.log(`[ANTRENMAN] Basit format algılandı: Süre=${duration}, Nitelik=${attributeName}`);

            try {
              // Kullanıcıyı oluştur veya al
              const user = await storage.getOrCreateUser(
                message.author.id,
                message.author.username,
                message.author.displayAvatarURL()
              );

              // Sabit olarak +1 puan ekleyeceğiz
              const attributeValue = 1;

              // Veritabanında bu mesaj zaten var mı diye kontrol et
              // Bu kontrol artık sadece günlük bilgi içindir, gerçek kontrol daha yukarıda yapılıyor
              // Antrenman oturumu oluştur - yoğunluğu 1 olarak sabitledik
              console.log(`[ANTRENMAN] Antrenman oturumu oluşturuluyor: ${user.userId} için ${attributeName}`);
              try {
                const session = await storage.createTrainingSession({
                  userId: user.userId,
                  attributeName: attributeName,
                  ticketId: "", // null yerine boş string kullan
                  duration,
                  intensity: 1, // Sabit değer kullanıyoruz
                  attributesGained: attributeValue
                });
                console.log(`[ANTRENMAN] Antrenman oturumu başarıyla oluşturuldu: ${session.id}`);
              } catch (error) {
                console.error(`[ANTRENMAN] Antrenman oturumu oluşturulurken hata:`, error);
              }

              // Kullanıcının niteliklerini güncelle - hem toplam hem haftalık değerini artır
              // source parametresi olarak 'message' ekleyerek bu değişikliğin antrenman kaynağını belirt
              await storage.updateAttribute(
                user.userId, 
                attributeName, 
                attributeValue, // Toplam değeri artır
                attributeValue, // Haftalık değeri de artır
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
                  { name: 'Süre', value: `${duration} saat`, inline: true },
                  { name: 'Nitelik', value: attributeName, inline: true },
                  { name: 'Kazanılan Puan', value: `+${attributeValue}`, inline: true }
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
    // Etkileşim daha önce işlendi mi kontrol et
    if (interaction.replied || interaction.deferred) {
      console.log('[BUTON] Bu etkileşim zaten yanıtlandı veya ertelendi, işlem yapılmıyor');
      return;
    }
    
    // Güvenli şekilde deferUpdate kullan
    try {
      await interaction.deferUpdate().catch(err => {
        console.log(`[BUTON] deferUpdate başarısız oldu, deferReply denenecek: ${err.message}`);
      });
    } catch (error) {
      // Eğer deferUpdate başarısız olursa deferReply dene
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.deferReply({ ephemeral: true }).catch(err => {
            console.log(`[BUTON] Hem deferUpdate hem deferReply başarısız oldu: ${err.message}`);
          });
        }
      } catch (e) {
        console.error('[BUTON] Etkileşim erteleme hatası:', e);
      }
    }
    
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

      // Get server config to check for staff role
      const serverConfig = await storage.getServerConfig(guild.id);
      let staffRoleId = null;
      
      // Veritabanından staff_role_id'yi almak için
      if (serverConfig) {
        try {
          const query = `
            SELECT staff_role_id 
            FROM server_config 
            WHERE guild_id = $1
          `;
          
          const { rows } = await require('../db').pool.query(query, [guild.id]);
          if (rows.length > 0 && rows[0].staff_role_id) {
            staffRoleId = rows[0].staff_role_id;
            console.log(`Ticket oluşturuluyor, yetkili rol ID'si: ${staffRoleId}`);
          }
        } catch (error) {
          console.error('Error fetching staff role ID:', error);
        }
      }
      
      // Create ticket channel - SADECE ticket oluşturana ve yetkililere görünür
      const permissionOverwrites = [
        {
          id: guild.id, // @everyone role
          deny: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        },
        {
          id: interaction.user.id, // Ticket oluşturan
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
      ];
      
      // Eğer özel bir yetkili rolü ayarlanmışsa, ona da izin ver
      if (staffRoleId) {
        permissionOverwrites.push({
          id: staffRoleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        });
      }
      
      const channel = await guild.channels.create({
        name: `ticket-${interaction.user.username}-${Date.now().toString().slice(-4)}`,
        type: ChannelType.GuildText,
        permissionOverwrites: permissionOverwrites
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

      // Close the ticket
      await storage.closeTicket(ticketId);

      // Toplam nitelik sayısını hesapla - attributeMap'teki değerleri topla
      // Bu, veri tabanındaki değerle tutarlı olacaktır çünkü attributeMap'i nasıl oluşturduysak
      // veritabanı güncellemelerini de öyle yaptık
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

      // Close the ticket
      await storage.closeTicket(ticketId);

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

      // Burada aynı nitelik için birden fazla talep olması durumunu
      // ticket kapatılırken ele alacağız, şimdilik yeni talebi ekliyoruz

      // Şimdi yeni talebi ekleyelim
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

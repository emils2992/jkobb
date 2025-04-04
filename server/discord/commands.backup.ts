import { 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  TextChannel, 
  EmbedBuilder, 
  ChannelType, 
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ThreadChannel
} from 'discord.js';
import { client } from './bot';
import { storage } from '../storage';
import { formatDate, createAttributeEmbed } from './utils';
import { pool } from '../db';

// Map to store commands
export const commands = new Map();

// Command definitions
const commandData = [
  // Command to create a new ticket
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Yeni bir nitelik talebi oluştur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false) // DM'de görünmesini engelle
    .toJSON(),
    
  // YENİ KOMUT: Adminlerin oyunculara rating rolu verme komutu
  new SlashCommandBuilder()
    .setName('rolver')
    .setDescription('Oyuncuya rating rolü ata')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Sadece adminler
    .setDMPermission(false)
    .addUserOption(option => 
      option.setName('oyuncu')
        .setDescription('Rating rolü atanacak oyuncu')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('rating')
        .setDescription('Oyuncunun rating seviyesi')
        .setRequired(true)
        .addChoices(
          { name: '60-70 Rating - 2 saat bekleme', value: 'role6070' },
          { name: '70-80 Rating - 3 saat bekleme', value: 'role7080' },
          { name: '80-90 Rating - 4 saat bekleme', value: 'role8090' },
          { name: '90-99 Rating - 5 saat bekleme', value: 'role9099' }
        ))
    .toJSON(),

  // Command to show the total attributes for all players
  new SlashCommandBuilder()
    .setName('fixson')
    .setDescription('Oyuncuların toplam nitelik puanlarını gösterir')
    .addUserOption(option => 
      option.setName('oyuncu')
        .setDescription('Belirli bir oyuncunun istatistiklerini görmek için seçin')
        .setRequired(false))
    .setDMPermission(false) // DM'de görünmesini engelle
    .toJSON(),

  // Command to reset weekly attributes
  new SlashCommandBuilder()
    .setName('fixreset')
    .setDescription('Tüm oyuncuların haftalık nitelik sayaçlarını ve antrenmanlarını sıfırlar')
    .addStringOption(option => 
      option.setName('onay')
        .setDescription('Bu işlemi onaylamak için "ONAYLA" yazın')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Sadece yöneticiler görebilir
    .setDMPermission(false) // DM'de görünmesini engelle
    .toJSON(),

  // Command to set up the bot configuration
  new SlashCommandBuilder()
    .setName('ayarla')
    .setDescription('Bot ayarlarını yapılandır')
    .addSubcommand(subcommand =>
      subcommand
        .setName('fixlog')
        .setDescription('Fix log kanalını ayarla')
        .addChannelOption(option => 
          option.setName('kanal')
            .setDescription('Fix log kanalı')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('antrenman')
        .setDescription('Antrenman log kanalını ayarla')
        .addChannelOption(option => 
          option.setName('kanal')
            .setDescription('Antrenman log kanalı')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('yetkili')
        .setDescription('Ticket yetkili rolünü ayarla')
        .addRoleOption(option => 
          option.setName('rol')
            .setDescription('Yetkili rolü')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('role6070')
        .setDescription('60-70 rating arası oyuncuların rolünü ayarla')
        .addRoleOption(option => 
          option.setName('rol')
            .setDescription('60-70 Rating Rolü')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('role7080')
        .setDescription('70-80 rating arası oyuncuların rolünü ayarla')
        .addRoleOption(option => 
          option.setName('rol')
            .setDescription('70-80 Rating Rolü')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('role8090')
        .setDescription('80-90 rating arası oyuncuların rolünü ayarla')
        .addRoleOption(option => 
          option.setName('rol')
            .setDescription('80-90 Rating Rolü')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('role9099')
        .setDescription('90-99 rating arası oyuncuların rolünü ayarla')
        .addRoleOption(option => 
          option.setName('rol')
            .setDescription('90-99 Rating Rolü')
            .setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Sadece yöneticiler görebilir
    .setDMPermission(false) // DM'de görünmesini engelle
    .toJSON(),

  // Command for 1/1 training format support 
  new SlashCommandBuilder()
    .setName('antren')
    .setDescription('1/1 formatında antrenman kaydı oluştur')
    .addStringOption(option => 
      option.setName('nitelik')
        .setDescription('Geliştirilecek nitelik (örn: şut, kısa pas, hız)')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Sadece yöneticiler görebilir
    .setDMPermission(false) // DM'de görünmesini engelle
    .toJSON(),
    
  // Antrenman log komutu - antrenman kanalı ve rating rollerini ayarlama
  new SlashCommandBuilder()
    .setName('antrenmanlog')
    .setDescription('Antrenman sistemi ayarları ve rol bilgilerini gösterir')
    .addSubcommand(subcommand =>
      subcommand
        .setName('kanal')
        .setDescription('Antrenman mesajları için kanal ayarla')
        .addChannelOption(option => 
          option.setName('kanal')
            .setDescription('Antrenman mesajlarının gönderileceği kanal')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('role6070')
        .setDescription('60-70 rating arası oyuncular için rol ayarla')
        .addRoleOption(option => 
          option.setName('rol')
            .setDescription('60-70 Rating Rolü - 2 saat bekleme süresi için')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('role7080')
        .setDescription('70-80 rating arası oyuncular için rol ayarla')
        .addRoleOption(option => 
          option.setName('rol')
            .setDescription('70-80 Rating Rolü - 3 saat bekleme süresi için')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('role8090')
        .setDescription('80-90 rating arası oyuncular için rol ayarla')
        .addRoleOption(option => 
          option.setName('rol')
            .setDescription('80-90 Rating Rolü - 4 saat bekleme süresi için')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('role9099')
        .setDescription('90-99 rating arası oyuncular için rol ayarla')
        .addRoleOption(option => 
          option.setName('rol')
            .setDescription('90-99 Rating Rolü - 5 saat bekleme süresi için')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('bilgi')
        .setDescription('Oyuncunun antrenman durumunu kontrol et')
        .addUserOption(option => 
          option.setName('oyuncu')
            .setDescription('Antrenman bilgisini görmek istediğiniz oyuncu')
            .setRequired(false)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Sadece yöneticiler kullanabilir
    .setDMPermission(false) // DM'de görünmesini engelle
    .toJSON(),
];

// Register commands with Discord API
export async function registerCommands() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    throw new Error('Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID environment variable');
  }

  try {
    const rest = new REST({ version: '10' }).setToken(token);

    console.log('Registering slash commands...');

    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commandData }
    );

    console.log('Successfully registered slash commands');

    // Store command handlers
    setupCommandHandlers();
  } catch (error) {
    console.error('Error registering slash commands:', error);
    throw error;
  }
}

// Set up command handlers
function setupCommandHandlers() {
  // Fixson command - show player attributes
  commands.set('fixson', async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    try {
      const targetUser = interaction.options.getUser('oyuncu');
      let stats: any[];

      if (targetUser) {
        // Get stats for a specific player
        const discordUser = await client.users.fetch(targetUser.id);
        await storage.getOrCreateUser(discordUser.id, discordUser.username, discordUser.displayAvatarURL());
        stats = await storage.getPlayerAttributeStats(discordUser.id);
      } else {
        // Get stats for all players
        stats = await storage.getPlayerAttributeStats();
      }

      if (stats.length === 0) {
        return interaction.editReply('Hiç oyuncu verisi bulunamadı.');
      }

      // Create a detailed embed for player stats
      const embed = new EmbedBuilder()
        .setTitle('🏆 Nitelik İstatistikleri')
        .setColor('#5865F2')
        .setDescription(`Toplam ${stats.length} oyuncu için nitelik verileri:`)
        .setTimestamp();

      for (const playerStat of stats.slice(0, 10)) { // Limit to 10 players to avoid embed limits
        const lastFixText = playerStat.lastFixDate ? formatDate(playerStat.lastFixDate) : 'Hiç';

        // Create detailed attribute information
        let attributesText = '';
        if (playerStat.attributes && playerStat.attributes.length > 0) {
          attributesText = playerStat.attributes.map((attr: { value: number; name: string }) => `${attr.value} ${attr.name}`).join(', ');
        } else {
          attributesText = 'Nitelik yok';
        }

        embed.addFields({
          name: playerStat.user.username,
          value: `Toplam: **${playerStat.totalValue}** | Bu Hafta: **${playerStat.weeklyValue}** | Son Fix: ${lastFixText}\nNitelikler: ${attributesText}`,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error executing fixson command:', error);
      await interaction.editReply('İstatistikler alınırken bir hata oluştu.');
    }
  });

  // Fixreset command - completely reset all attributes
  commands.set('fixreset', async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    try {
      const confirmationCode = interaction.options.getString('onay');
      if (confirmationCode !== 'ONAYLA') {
        return interaction.editReply('Onay kodu doğru değil. İşlem iptal edildi.');
      }

      const guildId = interaction.guildId;
      if (!guildId) {
        return interaction.editReply('Bu komut sadece sunucularda kullanılabilir.');
      }

      // Tüm nitelikleri tamamen sıfırla
      await storage.resetAllAttributes(guildId);

      // Nitelik kayıtlarını veritabanından tamamen sil
      await storage.deleteAllAttributes();

      // Antrenman verilerini de sıfırla 
      try {
        // Tüm antrenman verilerini silen SQL sorgusu
        await pool.query(`
          DELETE FROM training_sessions;
        `);
        console.log('Tüm antrenman verileri silindi.');
      } catch (error) {
        console.error('Antrenman verileri silinirken hata:', error);
      }

      const embed = new EmbedBuilder()
        .setTitle('🔄 Tüm Nitelikler Sıfırlandı ve Silindi')
        .setColor('#43B581')
        .setDescription('Tüm oyuncuların nitelik kayıtları tamamen silindi ve sıfırlandı. Oyunculara ait nitelik verisi kalmadı.')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Fix log kanalına da gönder (eğer yapılandırılmışsa)
      const serverConfig = await storage.getServerConfig(guildId);
      if (serverConfig?.fixLogChannelId) {
        const logChannel = await client.channels.fetch(serverConfig.fixLogChannelId) as TextChannel;
        if (logChannel) {
          await logChannel.send({ embeds: [embed] });
        }
      }

      // Nükleer bomba GIF özelliği kaldırıldı
    } catch (error) {
      console.error('Error executing fixreset command:', error);
      await interaction.editReply('Nitelikler sıfırlanırken bir hata oluştu.');
    }
  });

  // Ticket command - create a ticket creation panel with button
  commands.set('ticket', async (interaction: ChatInputCommandInteraction) => {
    try {
      // En hızlı yanıt için defer yerine direkt reply kullanıyoruz
      await interaction.reply({ 
        content: 'Ticket paneli oluşturuluyor...', 
        ephemeral: false 
      });

      const guild = interaction.guild;
      if (!guild) {
        return await interaction.editReply('Bu komut sadece sunucularda kullanılabilir.');
      }

      // Kullanıcının yetkisini kontrol et - sadece yöneticiler ticket paneli oluşturabilir
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply('Bu komutu kullanmak için yönetici yetkisine sahip olmalısınız.');
      }

      // Oluşturulacak embed ve buton
      const embed = new EmbedBuilder()
        .setTitle('🎫 Nitelik Ticket Sistemi')
        .setColor('#5865F2')
        .setDescription('Nitelik talebi oluşturmak için aşağıdaki butona tıklayın.\n\nBu sistem otomatik olarak size özel bir ticket kanalı oluşturacaktır.')
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel('Ticket Oluştur')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎫')
        );

      // Panel mesajını hızlıca güncelle
      await interaction.editReply({ 
        content: '', 
        embeds: [embed], 
        components: [row] 
      });

      // Log mesajı
      console.log(`Ticket paneli ${interaction.user.tag} tarafından oluşturuldu.`);

      // Not: Butonun işlenmesi events.ts içindeki handleButtonInteraction'da yapılacak
    } catch (error) {
      console.error('Error creating ticket panel:', error);
      if (interaction.deferred) {
        await interaction.editReply('Ticket paneli oluşturulurken bir hata oluştu.');
      } else {
        await interaction.reply({ content: 'Ticket paneli oluşturulurken bir hata oluştu.', ephemeral: true });
      }
    }
  });

  // Training command - record a training session
  commands.set('antrenman', async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    try {
      const duration = interaction.options.getInteger('süre', true);
      const attributesGained = interaction.options.getInteger('nitelik', true);
      const guildId = interaction.guildId;

      if (!guildId) {
        return interaction.editReply('Bu komut sadece sunucularda kullanılabilir.');
      }

      // Create or get user
      const user = await storage.getOrCreateUser(
        interaction.user.id,
        interaction.user.username,
        interaction.user.displayAvatarURL()
      );

      // Create training session
      const session = await storage.createTrainingSession({
        userId: user.userId,
        attributeName: 'Antrenman',
        ticketId: "", // Boş string kullanıyoruz, null yerine
        duration,
        attributesGained
      });

      // Update user's attributes
      await storage.updateAttribute(user.userId, 'Antrenman', attributesGained);

      // Create response embed
      const embed = new EmbedBuilder()
        .setTitle('🏋️ Antrenman Kaydı')
        .setColor('#43B581')
        .setDescription(`${interaction.user} adlı oyuncunun antrenman kaydı başarıyla oluşturuldu.`)
        .addFields(
          { name: 'Süre', value: `${duration} dakika`, inline: true },
          { name: 'Kazanılan Nitelik', value: `+${attributesGained} puan`, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Post to training log channel if configured
      const serverConfig = await storage.getServerConfig(guildId);
      if (serverConfig?.trainingChannelId) {
        const logChannel = await client.channels.fetch(serverConfig.trainingChannelId) as TextChannel;
        if (logChannel) {
          await logChannel.send({ embeds: [embed] });
        }
      }
    } catch (error) {
      console.error('Error recording training session:', error);
      await interaction.editReply('Antrenman kaydı oluşturulurken bir hata oluştu.');
    }
  });

  // Komutları tamamen kapat /kapat ve /dogrula komutları için 
  commands.set('kapat', async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.reply({ 
        content: 'Bu komut devre dışı bırakılmıştır. Lütfen ticket kanalındaki "Ticket\'ı Kapat" butonunu kullanın.', 
        ephemeral: true 
      });
    } catch (error) {
      console.error('Error replying to kapat command:', error);
    }
  });

  commands.set('dogrula', async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.reply({ 
        content: 'Bu komut devre dışı bırakılmıştır.', 
        ephemeral: true 
      });
    } catch (error) {
      console.error('Error replying to dogrula command:', error);
    }
  });

  // Antrenman log komutu - antrenman ayarlarını yapılandırma 
  commands.set('antrenmanlog', async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply({ ephemeral: interaction.options.getSubcommand() !== 'bilgi' });

    try {
      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guildId;

      if (!guildId) {
        return interaction.editReply('Bu komut sadece sunucularda kullanılabilir.');
      }

      // Sunucu bilgisini al
      const guild = interaction.guild;
      if (!guild) {
        return interaction.editReply('Bu komut sadece sunucularda kullanılabilir.');
      }

      // Alt komuta göre işlem yap
      if (subcommand === 'kanal') {
        // Antrenman kanalını ayarla
        const channel = interaction.options.getChannel('kanal', true);
        await storage.updateTrainingChannel(guildId, channel.id);
        await interaction.editReply(`Antrenman kanalı başarıyla <#${channel.id}> olarak ayarlandı. Bu kanalda yapılan 1/1 formatındaki mesajlar antrenman olarak kaydedilecek.`);
        return;
      } 
      else if (subcommand === 'role6070' || subcommand === 'role7080' || 
               subcommand === 'role8090' || subcommand === 'role9099') {
        const role = interaction.options.getRole('rol', true);
        const columnName = `${subcommand}_id`;
        const ratingText = subcommand === 'role6070' ? '60-70' : 
                          subcommand === 'role7080' ? '70-80' : 
                          subcommand === 'role8090' ? '80-90' : '90-99';
        const waitingHours = subcommand === 'role6070' ? 2 : 
                            subcommand === 'role7080' ? 3 : 
                            subcommand === 'role8090' ? 4 : 5;
        
        try {
          // Alan adını kontrol et ve gerekirse ekle
          const query = `
            SELECT EXISTS (
              SELECT FROM information_schema.columns 
              WHERE table_name = 'server_config' AND column_name = $1
            );
          `;
          
          const { rows } = await pool.query(query, [columnName]);
          const columnExists = rows[0].exists;
          
          if (!columnExists) {
            await pool.query(`ALTER TABLE server_config ADD COLUMN ${columnName} TEXT;`);
          }
          
          // Rolü güncelle
          await pool.query(`
            UPDATE server_config 
            SET ${columnName} = $1 
            WHERE guild_id = $2
          `, [role.id, guildId]);
          
          await interaction.editReply(`${ratingText} rating rolü başarıyla ${role.name} olarak ayarlandı. Bu role sahip oyuncular ${waitingHours} saatte bir antrenman yapabilecek.`);
          return;
        } catch (error) {
          console.error(`Error updating ${ratingText} rating role:`, error);
          await interaction.editReply('Rating rolü güncellenirken bir hata oluştu.');
          return;
        }
      }
      else if (subcommand === 'bilgi') {
        // Oyuncu bilgisini kontrol et
        const targetUser = interaction.options.getUser('oyuncu') || interaction.user;
        
        // Kullanıcının rol durumunu kontrol et
        let member;
        try {
          member = await guild.members.fetch(targetUser.id);
        } catch (error) {
          console.error('Üye bilgisi alınamadı:', error);
          return interaction.editReply('Kullanıcı bilgileri alınamadı. Kullanıcı sunucuda olmayabilir.');
        }

      // Veritabanından sunucu konfigürasyonunu al
      const serverConfig = await storage.getServerConfig(guildId);
      if (!serverConfig) {
        return interaction.editReply('Sunucu ayarları bulunamadı. Lütfen önce `/ayarla` komutu ile sunucu ayarlarını yapılandırın.');
      }

      // Rating rollerini al
      const roles = {
        '60-70': serverConfig.role6070Id ? await guild.roles.fetch(serverConfig.role6070Id) : null,
        '70-80': serverConfig.role7080Id ? await guild.roles.fetch(serverConfig.role7080Id) : null,
        '80-90': serverConfig.role8090Id ? await guild.roles.fetch(serverConfig.role8090Id) : null,
        '90-99': serverConfig.role9099Id ? await guild.roles.fetch(serverConfig.role9099Id) : null
      };

      // Kullanıcının rolünü ve bekleme süresini tespit et
      let userRatingRole = 'Rolsüz';
      let waitingHours = 1; // Varsayılan bekleme süresi (rolsüz için)

      if (roles['60-70'] && member.roles.cache.has(roles['60-70'].id)) {
        userRatingRole = '60-70 Rating';
        waitingHours = 2;
      } else if (roles['70-80'] && member.roles.cache.has(roles['70-80'].id)) {
        userRatingRole = '70-80 Rating';
        waitingHours = 3;
      } else if (roles['80-90'] && member.roles.cache.has(roles['80-90'].id)) {
        userRatingRole = '80-90 Rating';
        waitingHours = 4;
      } else if (roles['90-99'] && member.roles.cache.has(roles['90-99'].id)) {
        userRatingRole = '90-99 Rating';
        waitingHours = 5;
      }

      // Kullanıcının son antrenman zamanını kontrol et
      const trainingSessions = await storage.getTrainingSessions(targetUser.id);
      const lastTraining = trainingSessions.length > 0 
        ? trainingSessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] 
        : null;

      // Son antrenmandan sonra geçen süreyi hesapla
      let timePassedText = 'Henüz antrenman yapmadı';
      let canTrainNow = true;
      let timeRemainingText = 'Hemen antrenman yapabilir';
      
      if (lastTraining) {
        const lastTrainingTime = new Date(lastTraining.createdAt);
        const now = new Date();
        const timePassed = (now.getTime() - lastTrainingTime.getTime()) / (1000 * 60 * 60); // Saat cinsinden geçen süre
        
        // Geçen süreyi formatla
        const hoursPassed = Math.floor(timePassed);
        const minutesPassed = Math.floor((timePassed - hoursPassed) * 60);
        timePassedText = `${hoursPassed} saat ${minutesPassed} dakika önce`;
        
        // Antrenman yapabilir mi?
        if (timePassed < waitingHours) {
          canTrainNow = false;
          const timeRemaining = waitingHours - timePassed;
          const hoursRemaining = Math.floor(timeRemaining);
          const minutesRemaining = Math.floor((timeRemaining - hoursRemaining) * 60);
          timeRemainingText = `${hoursRemaining} saat ${minutesRemaining} dakika sonra antrenman yapabilir`;
        }
      }

      // Antrenman istatistiklerini al
      const stats = await storage.getPlayerAttributeStats(targetUser.id);
      
      // Embed oluştur
      const embed = new EmbedBuilder()
        .setTitle(`📊 ${member.displayName || targetUser.username} Antrenman Bilgileri`)
        .setColor(canTrainNow ? '#43B581' : '#F04747')
        .setThumbnail(member.displayAvatarURL() || targetUser.displayAvatarURL())
        .addFields(
          { name: '📈 Rating Rolü', value: userRatingRole, inline: true },
          { name: '⏱️ Bekleme Süresi', value: `${waitingHours} saat`, inline: true },
          { name: '📝 Antrenman Durumu', value: canTrainNow ? '✅ Antrenman yapabilir' : '❌ Şu an antrenman yapamaz', inline: false },
          { name: '🕒 Son Antrenman', value: timePassedText, inline: true },
          { name: '⏳ Kalan Süre', value: timeRemainingText, inline: true }
        )
        .setFooter({ text: 'Epic Lig Antrenman Sistemi' })
        .setTimestamp();

      // Toplam antrenman ve nitelik bilgilerini ekle
      if (stats && stats.length > 0) {
        const playerStat = stats[0];
        embed.addFields(
          { name: '🏋️ Toplam Antrenman', value: trainingSessions.length.toString(), inline: true },
          { name: '💪 Toplam Nitelik', value: playerStat.totalValue.toString(), inline: true },
          { name: '📅 Bu Hafta', value: playerStat.weeklyValue.toString(), inline: true }
        );
      }

      // Yanıtı gönder
      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in antrenmanlog command:', error);
      await interaction.editReply('Antrenman bilgileri alınırken bir hata oluştu.');
    }
  });

  // Antren komutu - 1/1 formatında basitleştirilmiş antrenman kaydı
  commands.set('antren', async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    try {
      const attributeName = interaction.options.getString('nitelik', true);
      const guildId = interaction.guildId;

      if (!guildId) {
        return interaction.editReply('Bu komut sadece sunucularda kullanılabilir.');
      }

      // Kullanıcıyı oluştur veya al
      const user = await storage.getOrCreateUser(
        interaction.user.id,
        interaction.user.username,
        interaction.user.displayAvatarURL()
      );

      // 1 saat süre ve 1 nitelik puanı sabit değerler
      const duration = 1;
      const attributeValue = 1;

      // Antrenman oturumu oluştur
      const session = await storage.createTrainingSession({
        userId: user.userId,
        attributeName: attributeName,
        ticketId: "", // Boş string kullanıyoruz, null yerine
        duration: duration,
        intensity: 1, // Sabit yoğunluk
        attributesGained: attributeValue,
        source: "training" // Kaynak olarak 'training' ekliyoruz
      });

      // Kullanıcının niteliğini güncelle
      await storage.updateAttribute(
        user.userId, 
        attributeName, 
        attributeValue, 
        undefined, 
        false, 
        false, 
        'message'
      );

      // Yanıt embedini oluştur
      const embed = new EmbedBuilder()
        .setTitle('🏋️ Antrenman Kaydı')
        .setColor('#43B581')
        .setDescription(`${interaction.user} adlı oyuncunun antrenman kaydı başarıyla oluşturuldu.`)
        .addFields(
          { name: 'Nitelik', value: attributeName, inline: true },
          { name: 'Süre', value: `${duration} saat`, inline: true },
          { name: 'Kazanılan Puan', value: `+${attributeValue}`, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Antrenman log kanalına da gönder (eğer yapılandırılmışsa)
      const serverConfig = await storage.getServerConfig(guildId);
      if (serverConfig?.trainingChannelId) {
        try {
          const logChannel = await client.channels.fetch(serverConfig.trainingChannelId) as TextChannel;
          if (logChannel) {
            await logChannel.send({ embeds: [embed] });
          }
        } catch (error) {
          console.error('Antrenman log kanalına mesaj gönderilirken hata:', error);
        }
      }
    } catch (error) {
      console.error('Error recording training session:', error);
      await interaction.editReply('Antrenman kaydı oluşturulurken bir hata oluştu.');
    }
  });

  // Setup command - configure bot settings
  commands.set('ayarla', async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply({ ephemeral: true });

    try {
      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guildId;

      if (!guildId) {
        return interaction.editReply('Bu komut sadece sunucularda kullanılabilir.');
      }

      if (subcommand === 'fixlog') {
        const channel = interaction.options.getChannel('kanal', true);

        await storage.updateFixLogChannel(guildId, channel.id);

        await interaction.editReply(
          `Fix log kanalı başarıyla <#${channel.id}> olarak ayarlandı.`
        );
      } else if (subcommand === 'antrenman') {
        const channel = interaction.options.getChannel('kanal', true);

        // Ensure we properly update the training channel
        await storage.updateTrainingChannel(guildId, channel.id);
        
        console.log(`Training channel set to ${channel.id} for guild ${guildId}`);

        await interaction.editReply(
          `Antrenman log kanalı başarıyla <#${channel.id}> olarak ayarlandı.`
        );
      } else if (subcommand === 'yetkili') {
        const role = interaction.options.getRole('rol', true);

        // Rol ID'sini ServerConfig'e ekleyeceğiz
        // Önce bir yardımcı fonksiyon oluşturalım
        if (!interaction.guild) {
          return interaction.editReply('Bu komut sadece sunucularda kullanılabilir.');
        }

        // Veritabanında güncelleyelim
        // Burada mevcut sunucu konfigürasyonunu alıp güncelliyoruz
        const serverConfig = await storage.getServerConfig(guildId);
        if (serverConfig) {
          // serverConfig'e roleId ekleyelim
          // Burada biraz hack yapıyoruz çünkü schema'da olmayan bir alan ekliyoruz
          // Doğrudan SQL sorgusu çalıştırarak güncelleme yapacağız
          try {
            // Bu alanı yapıdan düzgün bir şekilde eklemek için önce veritabanını kontrol edelim
            const query = `
              SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'server_config' AND column_name = 'staff_role_id'
              );
            `;

            const { rows } = await pool.query(query);
            const columnExists = rows[0].exists;

            if (!columnExists) {
              // Eğer kolon yoksa ekle
              await pool.query(`
                ALTER TABLE server_config 
                ADD COLUMN staff_role_id TEXT;
              `);
            }

            // Şimdi güncelleyebiliriz
            await pool.query(`
              UPDATE server_config 
              SET staff_role_id = $1 
              WHERE guild_id = $2
            `, [role.id, guildId]);

            await interaction.editReply(
              `Ticket yetkili rolü başarıyla ${role.name} olarak ayarlandı. Artık bu role sahip kişiler tüm ticketları görebilecek.`
            );
          } catch (error) {
            console.error('Error updating staff role:', error);
            await interaction.editReply('Yetkili rolü güncellenirken bir hata oluştu.');
          }
        } else {
          await interaction.editReply('Sunucu konfigürasyonu bulunamadı. Lütfen önce diğer ayarları yapılandırın.');
        }
      } else if (subcommand === 'role6070') {
        const role = interaction.options.getRole('rol', true);

        if (!interaction.guild) {
          return interaction.editReply('Bu komut sadece sunucularda kullanılabilir.');
        }

        const serverConfig = await storage.getServerConfig(guildId);
        if (serverConfig) {
          try {
            // Role6070Id alanını kontrol et ve gerekirse ekle
            const query = `
              SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'server_config' AND column_name = 'role6070_id'
              );
            `;

            const { rows } = await pool.query(query);
            const columnExists = rows[0].exists;

            if (!columnExists) {
              await pool.query(`
                ALTER TABLE server_config 
                ADD COLUMN role6070_id TEXT;
              `);
            }

            // Güncelleme yap
            await pool.query(`
              UPDATE server_config 
              SET role6070_id = $1 
              WHERE guild_id = $2
            `, [role.id, guildId]);

            await interaction.editReply(
              `60-70 rating rolü başarıyla ${role.name} olarak ayarlandı. Bu role sahip oyuncular 2 saatte bir antrenman yapabilecek.`
            );
          } catch (error) {
            console.error('Error updating 60-70 rating role:', error);
            await interaction.editReply('Rating rolü güncellenirken bir hata oluştu.');
          }
        } else {
          await interaction.editReply('Sunucu konfigürasyonu bulunamadı. Lütfen önce diğer ayarları yapılandırın.');
        }
      } else if (subcommand === 'role7080') {
        const role = interaction.options.getRole('rol', true);

        if (!interaction.guild) {
          return interaction.editReply('Bu komut sadece sunucularda kullanılabilir.');
        }

        const serverConfig = await storage.getServerConfig(guildId);
        if (serverConfig) {
          try {
            // Role7080Id alanını kontrol et ve gerekirse ekle
            const query = `
              SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'server_config' AND column_name = 'role7080_id'
              );
            `;

            const { rows } = await pool.query(query);
            const columnExists = rows[0].exists;

            if (!columnExists) {
              await pool.query(`
                ALTER TABLE server_config 
                ADD COLUMN role7080_id TEXT;
              `);
            }

            // Güncelleme yap
            await pool.query(`
              UPDATE server_config 
              SET role7080_id = $1 
              WHERE guild_id = $2
            `, [role.id, guildId]);

            await interaction.editReply(
              `70-80 rating rolü başarıyla ${role.name} olarak ayarlandı. Bu role sahip oyuncular 3 saatte bir antrenman yapabilecek.`
            );
          } catch (error) {
            console.error('Error updating 70-80 rating role:', error);
            await interaction.editReply('Rating rolü güncellenirken bir hata oluştu.');
          }
        } else {
          await interaction.editReply('Sunucu konfigürasyonu bulunamadı. Lütfen önce diğer ayarları yapılandırın.');
        }
      } else if (subcommand === 'role8090') {
        const role = interaction.options.getRole('rol', true);

        if (!interaction.guild) {
          return interaction.editReply('Bu komut sadece sunucularda kullanılabilir.');
        }

        const serverConfig = await storage.getServerConfig(guildId);
        if (serverConfig) {
          try {
            // Role8090Id alanını kontrol et ve gerekirse ekle
            const query = `
              SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'server_config' AND column_name = 'role8090_id'
              );
            `;

            const { rows } = await pool.query(query);
            const columnExists = rows[0].exists;

            if (!columnExists) {
              await pool.query(`
                ALTER TABLE server_config 
                ADD COLUMN role8090_id TEXT;
              `);
            }

            // Güncelleme yap
            await pool.query(`
              UPDATE server_config 
              SET role8090_id = $1 
              WHERE guild_id = $2
            `, [role.id, guildId]);

            await interaction.editReply(
              `80-90 rating rolü başarıyla ${role.name} olarak ayarlandı. Bu role sahip oyuncular 4 saatte bir antrenman yapabilecek.`
            );
          } catch (error) {
            console.error('Error updating 80-90 rating role:', error);
            await interaction.editReply('Rating rolü güncellenirken bir hata oluştu.');
          }
        } else {
          await interaction.editReply('Sunucu konfigürasyonu bulunamadı. Lütfen önce diğer ayarları yapılandırın.');
        }
      } else if (subcommand === 'role9099') {
        const role = interaction.options.getRole('rol', true);

        if (!interaction.guild) {
          return interaction.editReply('Bu komut sadece sunucularda kullanılabilir.');
        }

        const serverConfig = await storage.getServerConfig(guildId);
        if (serverConfig) {
          try {
            // Role9099Id alanını kontrol et ve gerekirse ekle
            const query = `
              SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'server_config' AND column_name = 'role9099_id'
              );
            `;

            const { rows } = await pool.query(query);
            const columnExists = rows[0].exists;

            if (!columnExists) {
              await pool.query(`
                ALTER TABLE server_config 
                ADD COLUMN role9099_id TEXT;
              `);
            }

            // Güncelleme yap
            await pool.query(`
              UPDATE server_config 
              SET role9099_id = $1 
              WHERE guild_id = $2
            `, [role.id, guildId]);

            await interaction.editReply(
              `90-99 rating rolü başarıyla ${role.name} olarak ayarlandı. Bu role sahip oyuncular 5 saatte bir antrenman yapabilecek.`
            );
          } catch (error) {
            console.error('Error updating 90-99 rating role:', error);
            await interaction.editReply('Rating rolü güncellenirken bir hata oluştu.');
          }
        } else {
          await interaction.editReply('Sunucu konfigürasyonu bulunamadı. Lütfen önce diğer ayarları yapılandırın.');
        }
      }
    } catch (error) {
      console.error('Error configuring bot settings:', error);
      await interaction.editReply('Ayarlar yapılandırılırken bir hata oluştu.');
    }
  });
}
//Added unhandledRejection handler for improved error management.
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// Debug loglama setupEventHandlers içinde yapılacak
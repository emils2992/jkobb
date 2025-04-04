import pg from 'pg';
const { Pool } = pg;
import { IStorage } from './storage';
import { 
  User, InsertUser, 
  Attribute, InsertAttribute,
  Ticket, InsertTicket,
  AttributeRequest, InsertAttributeRequest,
  TrainingSession, InsertTrainingSession,
  ServerConfig, InsertServerConfig,
  Admin, InsertAdmin,
  ChatMessage, InsertChatMessage
} from '../shared/schema';
import { createHash } from 'crypto';

export class PgStorage implements IStorage {
  private pool: any;

  constructor(pool: any) {
    this.pool = pool;
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE id = $1',
      [parseInt(id)]
    );
    
    if (result.rows.length === 0) return undefined;
    
    return this.pgUserToUser(result.rows[0]);
  }

  async getUserById(userId: string): Promise<User | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) return undefined;
    
    return this.pgUserToUser(result.rows[0]);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.pool.query(
      'INSERT INTO users(user_id, username, avatar_url, display_name) VALUES($1, $2, $3, $4) RETURNING *',
      [insertUser.userId, insertUser.username, insertUser.avatarUrl || null, insertUser.displayName || null]
    );
    
    return this.pgUserToUser(result.rows[0]);
  }

  async getOrCreateUser(userId: string, username: string, avatarUrl?: string, displayName?: string): Promise<User> {
    const existingUser = await this.getUserById(userId);
    if (existingUser) return existingUser;
    
    return this.createUser({
      userId,
      username,
      avatarUrl,
      displayName
    });
  }

  // Attribute operations
  async getAttributes(userId: string): Promise<Attribute[]> {
    const result = await this.pool.query(
      'SELECT * FROM attributes WHERE user_id = $1',
      [userId]
    );
    
    return result.rows.map((row: any) => this.pgAttributeToAttribute(row));
  }

  async getAttribute(userId: string, attributeName: string): Promise<Attribute | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM attributes WHERE user_id = $1 AND name = $2',
      [userId, attributeName]
    );
    
    if (result.rows.length === 0) return undefined;
    
    return this.pgAttributeToAttribute(result.rows[0]);
  }

  async updateAttribute(userId: string, attributeName: string, value: number, weeklyValue?: number, absoluteValue: boolean = false, onlyUpdateWeekly: boolean = false, source: string = 'manual'): Promise<Attribute> {
    const existing = await this.getAttribute(userId, attributeName);
    
    if (existing) {
      // YENİ DETAYLI LOGLAMA SİSTEMİ
      console.log(`[SUPER-FIX] BAŞLADI: ${attributeName} niteliği ${userId} için güncelleniyor (Kaynak: ${source})`);
      console.log(`[SUPER-FIX] MEVCUT DEĞERLER: value=${existing.value}, weeklyValue=${existing.weeklyValue}`);
      console.log(`[SUPER-FIX] PARAMETRELER: value=${value}, weeklyValue=${weeklyValue}, absoluteValue=${absoluteValue}, onlyUpdateWeekly=${onlyUpdateWeekly}, source=${source}`);
      
      // onlyUpdateWeekly true ise ana değeri değiştirmiyoruz, false ise verilen değeri ekliyoruz
      let newValue;
      if (onlyUpdateWeekly) {
        // Sadece haftalık değer güncelleniyor, toplam değer aynı kalıyor
        newValue = existing.value;
        console.log(`[SUPER-FIX] TOPLAM DEĞER DEĞİŞMİYOR: ${existing.value}`);
      } else if (absoluteValue) {
        // Eğer absoluteValue=true ise değiştirme modundayız (toplam değeri değiştir)
        newValue = value;
        console.log(`[SUPER-FIX] TOPLAM DEĞER DEĞİŞTİRİLİYOR: ${existing.value} => ${value}`);
      } else {
        // Normal değer ekleme - EKLEME, ÇARPMA DEĞİL!
        newValue = existing.value + value;
        console.log(`[SUPER-FIX] TOPLAM DEĞERE EKLENİYOR: ${existing.value} + ${value} = ${newValue}`);
      }
      
      // Haftalık değer hesaplama - YENİ: Tüm değer artışları (ticket dahil) haftalık değerlere de eklenir
      let newWeeklyValue;
      if (weeklyValue !== undefined) {
        // Eğer weeklyValue açıkça belirtilmişse, o değeri kullan
        if (absoluteValue) {
          // Eğer absoluteValue=true ise değiştir
          newWeeklyValue = weeklyValue;
          console.log(`[SUPER-FIX] HAFTALIK DEĞER DEĞİŞTİRİLİYOR: ${existing.weeklyValue} => ${weeklyValue}`);
        } else {
          // Değilse, ekle
          newWeeklyValue = existing.weeklyValue + weeklyValue;
          console.log(`[SUPER-FIX] HAFTALIK DEĞERE EKLENİYOR (AÇIK): ${existing.weeklyValue} + ${weeklyValue} = ${newWeeklyValue}`);
        }
      } else if (!onlyUpdateWeekly) {
        // Tüm kaynaklardan (ticket dahil) değer artışlarını haftalık değere de ekle
        newWeeklyValue = existing.weeklyValue + value;
        console.log(`[SUPER-FIX] HAFTALIK DEĞERE ${source} KAYNAĞI İLE EKLENİYOR: ${existing.weeklyValue} + ${value} = ${newWeeklyValue}`);
      } else {
        // Haftalık değeri değiştirme
        newWeeklyValue = existing.weeklyValue;
        console.log(`[SUPER-FIX] HAFTALIK DEĞER DEĞİŞMİYOR: ${existing.weeklyValue}`);
      }
      
      console.log(`[SUPER-FIX] SONUÇ: ${attributeName} => value=${newValue}, weeklyValue=${newWeeklyValue}`);
      
      const result = await this.pool.query(
        'UPDATE attributes SET value = $1, weekly_value = $2, updated_at = NOW() WHERE user_id = $3 AND name = $4 RETURNING *',
        [newValue, newWeeklyValue, userId, attributeName]
      );
      
      return this.pgAttributeToAttribute(result.rows[0]);
    } else {
      // Yeni nitelik oluştur
      // Eğer yeni nitelik oluşturuyorsak, değerin tam olarak kullanıcı tarafından istenen değer olduğundan emin olalım
      console.log(`Creating new attribute ${attributeName} for user ${userId} with value=${value}`);
      
      const result = await this.pool.query(
        'INSERT INTO attributes(user_id, name, value, weekly_value) VALUES($1, $2, $3, $4) RETURNING *',
        [userId, attributeName, value, weeklyValue !== undefined ? weeklyValue : value]
      );
      
      return this.pgAttributeToAttribute(result.rows[0]);
    }
  }

  async resetWeeklyAttributes(guildId: string): Promise<void> {
    await this.pool.query('UPDATE attributes SET weekly_value = 0, updated_at = NOW()');
    await this.updateLastReset(guildId);
  }
  
  async resetAllAttributes(guildId: string): Promise<void> {
    // Tüm nitelikleri tamamen sıfırla (value ve weekly_value)
    await this.pool.query('UPDATE attributes SET value = 0, weekly_value = 0, updated_at = NOW()');
    
    // Ayrıca antrenman kayıtlarını da sıfırla
    // NOT: Antrenman kayıtlarını tamamen silmiyoruz, sadece istatistiksel amaçlar için tutuyoruz
    
    // Son sıfırlama zamanını güncelle
    await this.updateLastReset(guildId);
    
    console.log(`Tüm nitelikler ve haftalık değerler sıfırlandı - ${new Date().toISOString()}`);
  }
  
  async deleteAllAttributes(): Promise<void> {
    try {
      // Tüm nitelik kayıtlarını tamamen sil - kalıcı olarak veritabanından kaldır
      await this.pool.query('DELETE FROM attributes');
      
      console.log(`Tüm nitelik kayıtları veritabanından tamamen silindi - ${new Date().toISOString()}`);
    } catch (error) {
      console.error('Nitelik kayıtları silinirken hata oluştu:', error);
      throw error;
    }
  }

  async getPlayerAttributeStats(userId?: string): Promise<any[]> {
    try {
      let userQuery;
      let params: any[] = [];
      
      if (userId) {
        userQuery = 'WHERE u.user_id = $1';
        params.push(userId);
      } else {
        userQuery = '';
      }
      
      // Optimize edilmiş sorgu - display_name alanını da dahil ediyoruz
      const result = await this.pool.query(`
        SELECT 
          u.*,
          COALESCE(SUM(a.value), 0) as total_value,
          COALESCE(SUM(a.weekly_value), 0) as weekly_value,
          t.updated_at as last_fix_date
        FROM 
          users u
        LEFT JOIN 
          attributes a ON u.user_id = a.user_id
        LEFT JOIN (
          SELECT 
            user_id, 
            MAX(updated_at) as updated_at
          FROM 
            tickets
          WHERE 
            status = 'closed'
          GROUP BY 
            user_id
        ) t ON u.user_id = t.user_id
        ${userQuery}
        GROUP BY 
          u.id, t.updated_at
      `, params);
      
      // Paralel sorgular için Promise.all kullanarak verimlilik artışı
      const playerStats = await Promise.all(result.rows.map(async (row: any) => {
        // Her kullanıcı için nitelikleri al
        const attributes = await this.getAttributes(row.user_id);
        
        return {
          user: this.pgUserToUser(row),
          totalValue: parseInt(row.total_value) || 0,
          weeklyValue: parseInt(row.weekly_value) || 0,
          lastFixDate: row.last_fix_date ? new Date(row.last_fix_date) : null,
          attributes
        };
      }));
      
      return playerStats;
    } catch (error) {
      console.error('getPlayerAttributeStats hata:', error);
      // Hata durumunda boş dizi döndür ama uygulamanın çalışmaya devam etmesini sağla
      return [];
    }
  }
  
  async getPlayerTrainingStats(userId?: string): Promise<any[]> {
    let userQuery = '';
    let params: any[] = [];
    
    if (userId) {
      userQuery = 'AND u.user_id = $1';
      params.push(userId);
    }
    
    // Sadece GERÇEK antrenman kaynaklı nitelik puanlarını topla
    // display_name alanını da dahil ediyoruz
    const query = `
      SELECT 
        u.id, u.user_id, u.username, u.display_name, u.avatar_url, u.created_at,
        COALESCE(SUM(ts.attributes_gained), 0) AS total_training_value,
        COUNT(DISTINCT ts.id) AS training_count
      FROM 
        users u
      LEFT JOIN 
        training_sessions ts ON u.user_id = ts.user_id
      WHERE
        (ts.id IS NULL OR ts.id IS NOT NULL)
        ${userQuery}
      GROUP BY 
        u.id
      ORDER BY 
        total_training_value DESC
    `;
    
    // Sadece antrenman kaynaklı veriler sorgulanıyor (ticket dahil değil)
    const result = await this.pool.query(query, params);
    const trainingStats = [];
    
    for (const row of result.rows) {
      // Her kullanıcı için SADECE gerçek antrenman oturumlarını al (ticket olmayanları)
      const trainingSessions = await this.pool.query(
        `SELECT * FROM training_sessions 
         WHERE user_id = $1 AND source != 'ticket'
         ORDER BY created_at DESC`,
        [row.user_id]
      );
      
      // Nitelikler bazında gerçek antrenman puanlarını hesapla (ticket olmayanları)
      const attributeQuery = `
        SELECT 
          attribute_name,
          COALESCE(SUM(attributes_gained), 0) AS total_gained
        FROM 
          training_sessions
        WHERE 
          user_id = $1
          AND source != 'ticket'
        GROUP BY 
          attribute_name
      `;
      
      // Kullanıcı için ticket olmayan antrenman puanları hesaplanıyor
      const attributeResult = await this.pool.query(attributeQuery, [row.user_id]);
      const attributes = attributeResult.rows.map((attr: any) => ({
        name: attr.attribute_name,
        value: parseInt(attr.total_gained) || 0
      }));
      
      trainingStats.push({
        user: {
          id: row.id,
          userId: row.user_id,
          username: row.username,
          displayName: row.display_name || row.username,
          avatarUrl: row.avatar_url,
          createdAt: new Date(row.created_at)
        },
        totalTrainingValue: parseInt(row.total_training_value) || 0,
        trainingCount: parseInt(row.training_count) || 0,
        attributes: attributes,
        trainingSessions: trainingSessions.rows.map((session: any) => this.pgTrainingSessionToTrainingSession(session))
      });
    }
    
    return trainingStats;
  }
  
  async getTrainingAttributes(userId: string): Promise<Attribute[]> {
    // Sadece gerçek antrenman kaynaklı nitelikleri hesapla (ticket HARIÇ)
    const query = `
      SELECT 
        attribute_name AS name,
        COALESCE(SUM(attributes_gained), 0) AS training_value
      FROM 
        training_sessions
      WHERE 
        user_id = $1
        AND source != 'ticket'
      GROUP BY 
        attribute_name
    `;
    
    const result = await this.pool.query(query, [userId]);
    
    return result.rows.map((row: any) => ({
      id: 0, // Sadece görünüm olduğu için gerçek bir ID vermiyoruz
      userId,
      name: row.name,
      value: parseInt(row.training_value) || 0,
      weeklyValue: 0, // Bu görünümde haftalık değer dönmüyoruz
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  // Ticket operations
  async getTicket(ticketId: string): Promise<Ticket | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM tickets WHERE ticket_id = $1',
      [ticketId]
    );
    
    if (result.rows.length === 0) return undefined;
    
    return this.pgTicketToTicket(result.rows[0]);
  }

  async getOpenTickets(): Promise<Ticket[]> {
    const result = await this.pool.query(
      "SELECT * FROM tickets WHERE status = 'open' OR status = 'pending' ORDER BY created_at DESC"
    );
    
    return result.rows.map((row: any) => this.pgTicketToTicket(row));
  }
  
  async getAllTickets(): Promise<Ticket[]> {
    const result = await this.pool.query(
      "SELECT * FROM tickets ORDER BY created_at DESC"
    );
    
    return result.rows.map((row: any) => this.pgTicketToTicket(row));
  }

  async createTicket(insertTicket: InsertTicket): Promise<Ticket> {
    const result = await this.pool.query(
      'INSERT INTO tickets(ticket_id, user_id, status, type) VALUES($1, $2, $3, $4) RETURNING *',
      [
        insertTicket.ticketId, 
        insertTicket.userId, 
        insertTicket.status || 'open', 
        insertTicket.type || 'attribute'
      ]
    );
    
    return this.pgTicketToTicket(result.rows[0]);
  }

  async updateTicketStatus(ticketId: string, status: string): Promise<Ticket> {
    const closedAt = status === 'closed' ? 'NOW()' : 'closed_at';
    
    const result = await this.pool.query(
      `UPDATE tickets SET status = $1, updated_at = NOW(), closed_at = ${status === 'closed' ? 'NOW()' : 'closed_at'} WHERE ticket_id = $2 RETURNING *`,
      [status, ticketId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Ticket with ID ${ticketId} not found`);
    }
    
    return this.pgTicketToTicket(result.rows[0]);
  }

  async closeTicket(ticketId: string, closedBy?: string): Promise<Ticket> {
    const result = await this.pool.query(
      'UPDATE tickets SET status = $1, closed_by = $2, closed_at = CURRENT_TIMESTAMP WHERE ticket_id = $3 RETURNING *',
      ['closed', closedBy || null, ticketId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Ticket with ID ${ticketId} not found`);
    }
    
    return this.pgTicketToTicket(result.rows[0]);
  }

  // Attribute request operations
  async getAttributeRequests(ticketId: string): Promise<AttributeRequest[]> {
    const result = await this.pool.query(
      'SELECT * FROM attribute_requests WHERE ticket_id = $1',
      [ticketId]
    );
    
    return result.rows.map((row: any) => this.pgAttributeRequestToAttributeRequest(row));
  }

  async createAttributeRequest(insertRequest: InsertAttributeRequest): Promise<AttributeRequest> {
    // Değer kontrolü - 0'dan büyük olmalı
    if (insertRequest.valueRequested <= 0) {
      console.error(`[CREATE_ATTRIBUTE_REQUEST] ERROR: Geçersiz değer talebi: ${insertRequest.valueRequested}`);
      throw new Error(`Invalid value requested: ${insertRequest.valueRequested}. Value must be greater than 0.`);
    }
    
    console.log(`[CREATE_ATTRIBUTE_REQUEST] Yeni talep: Ticket ${insertRequest.ticketId} için ${insertRequest.attributeName} niteliğine +${insertRequest.valueRequested} ekleme`);
    
    const result = await this.pool.query(
      'INSERT INTO attribute_requests(ticket_id, attribute_name, value_requested, approved) VALUES($1, $2, $3, $4) RETURNING *',
      [
        insertRequest.ticketId, 
        insertRequest.attributeName, 
        insertRequest.valueRequested, 
        insertRequest.approved !== undefined ? insertRequest.approved : false
      ]
    );
    
    const createdRequest = this.pgAttributeRequestToAttributeRequest(result.rows[0]);
    console.log(`[CREATE_ATTRIBUTE_REQUEST] Talep oluşturuldu - ID: ${createdRequest.id}, Nitelik: ${createdRequest.attributeName}, Değer: +${createdRequest.valueRequested}`);
    
    return createdRequest;
  }

  async approveAttributeRequest(requestId: number): Promise<AttributeRequest> {
    const result = await this.pool.query(
      'UPDATE attribute_requests SET approved = true WHERE id = $1 RETURNING *',
      [requestId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Request with ID ${requestId} not found`);
    }
    
    return this.pgAttributeRequestToAttributeRequest(result.rows[0]);
  }

  async getTotalAttributesForTicket(ticketId: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT SUM(value_requested) as total FROM attribute_requests WHERE ticket_id = $1 AND approved = true',
      [ticketId]
    );
    
    return parseInt(result.rows[0]?.total) || 0;
  }

  // Training session operations
  async createTrainingSession(insertSession: InsertTrainingSession): Promise<TrainingSession> {
    // Önce aynı mesajla ilgili bir kayıt var mı kontrol et
    if (insertSession.messageId) {
      const checkResult = await this.pool.query(
        'SELECT * FROM training_sessions WHERE message_id = $1',
        [insertSession.messageId]
      );
      
      // Eğer mesaj daha önce kaydedilmişse, direkt o kaydı döndür
      if (checkResult.rows.length > 0) {
        console.log(`[ANTRENMAN] Bu mesaj daha önce kaydedilmiş, tekrar eklemiyorum: ${insertSession.messageId}`);
        return this.pgTrainingSessionToTrainingSession(checkResult.rows[0]);
      }
    }
  
    // Mesaj daha önce kaydedilmemişse yeni kayıt oluştur
    const result = await this.pool.query(
      `INSERT INTO training_sessions(
        user_id, 
        ticket_id, 
        attribute_name,
        duration, 
        intensity,
        attributes_gained,
        source,
        message_id,
        channel_id
      ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        insertSession.userId, 
        insertSession.ticketId || "", 
        insertSession.attributeName || "Genel Antrenman",
        insertSession.duration, 
        insertSession.intensity || 1,
        insertSession.attributesGained,
        insertSession.source || "training",
        insertSession.messageId || null,
        insertSession.channelId || null
      ]
    );
    
    console.log(`[ANTRENMAN] Yeni antrenman kaydı oluşturuldu: ${result.rows[0].id} (mesaj: ${insertSession.messageId})`);
    return this.pgTrainingSessionToTrainingSession(result.rows[0]);
  }

  async getTrainingSessions(userId: string): Promise<TrainingSession[]> {
    const result = await this.pool.query(
      'SELECT * FROM training_sessions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    return result.rows.map((row: any) => this.pgTrainingSessionToTrainingSession(row));
  }

  // Server config operations
  async getServerConfig(guildId: string): Promise<ServerConfig | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM server_config WHERE guild_id = $1',
      [guildId]
    );
    
    if (result.rows.length === 0) return undefined;
    
    return this.pgServerConfigToServerConfig(result.rows[0]);
  }

  async setServerConfig(insertConfig: InsertServerConfig): Promise<ServerConfig> {
    const existing = await this.getServerConfig(insertConfig.guildId);
    
    if (existing) {
      // Mevcut yapılandırmayı güncelle - tüm antrenman kanallarını dahil et
      const result = await this.pool.query(
        `UPDATE server_config SET 
         fix_log_channel_id = $1, 
         training_channel_id = $2,
         training_channel_id_1 = $3,
         training_channel_id_2 = $4,
         training_channel_id_3 = $5,
         training_channel_id_4 = $6,
         training_channel_id_5 = $7,
         staff_role_id = $8,
         updated_at = NOW() 
         WHERE guild_id = $9 RETURNING *`,
        [
          insertConfig.fixLogChannelId !== undefined ? insertConfig.fixLogChannelId : existing.fixLogChannelId, 
          insertConfig.trainingChannelId !== undefined ? insertConfig.trainingChannelId : existing.trainingChannelId,
          insertConfig.trainingChannelId1 !== undefined ? insertConfig.trainingChannelId1 : existing.trainingChannelId1,
          insertConfig.trainingChannelId2 !== undefined ? insertConfig.trainingChannelId2 : existing.trainingChannelId2,
          insertConfig.trainingChannelId3 !== undefined ? insertConfig.trainingChannelId3 : existing.trainingChannelId3,
          insertConfig.trainingChannelId4 !== undefined ? insertConfig.trainingChannelId4 : existing.trainingChannelId4,
          insertConfig.trainingChannelId5 !== undefined ? insertConfig.trainingChannelId5 : existing.trainingChannelId5,
          insertConfig.staffRoleId !== undefined ? insertConfig.staffRoleId : existing.staffRoleId,
          insertConfig.guildId
        ]
      );
      
      return this.pgServerConfigToServerConfig(result.rows[0]);
    } else {
      // Yeni yapılandırma oluştur - tüm alanları dahil et
      const result = await this.pool.query(
        `INSERT INTO server_config(
          guild_id, 
          fix_log_channel_id, 
          training_channel_id,
          training_channel_id_1,
          training_channel_id_2,
          training_channel_id_3,
          training_channel_id_4,
          training_channel_id_5,
          staff_role_id
        ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          insertConfig.guildId, 
          insertConfig.fixLogChannelId || null, 
          insertConfig.trainingChannelId || null,
          insertConfig.trainingChannelId1 || null,
          insertConfig.trainingChannelId2 || null,
          insertConfig.trainingChannelId3 || null,
          insertConfig.trainingChannelId4 || null,
          insertConfig.trainingChannelId5 || null,
          insertConfig.staffRoleId || null
        ]
      );
      
      return this.pgServerConfigToServerConfig(result.rows[0]);
    }
  }

  async updateFixLogChannel(guildId: string, channelId: string): Promise<ServerConfig> {
    const config = await this.getServerConfig(guildId);
    
    if (config) {
      return this.setServerConfig({
        ...config,
        guildId,
        fixLogChannelId: channelId
      });
    } else {
      return this.setServerConfig({
        guildId,
        fixLogChannelId: channelId,
        trainingChannelId: null
      });
    }
  }

  async updateTrainingChannel(guildId: string, channelId: string): Promise<ServerConfig> {
    const config = await this.getServerConfig(guildId);
    
    if (config) {
      return this.setServerConfig({
        ...config,
        guildId,
        trainingChannelId: channelId
      });
    } else {
      return this.setServerConfig({
        guildId,
        fixLogChannelId: null,
        trainingChannelId: channelId
      });
    }
  }
  
  // 5 farklı antrenman kanalını yapılandırmak için yeni metotlar
  async updateTrainingChannel1(guildId: string, channelId: string): Promise<ServerConfig> {
    const config = await this.getServerConfig(guildId);
    
    if (config) {
      return this.setServerConfig({
        ...config,
        guildId,
        trainingChannelId1: channelId
      });
    } else {
      return this.setServerConfig({
        guildId,
        trainingChannelId1: channelId
      });
    }
  }
  
  async updateTrainingChannel2(guildId: string, channelId: string): Promise<ServerConfig> {
    const config = await this.getServerConfig(guildId);
    
    if (config) {
      return this.setServerConfig({
        ...config,
        guildId,
        trainingChannelId2: channelId
      });
    } else {
      return this.setServerConfig({
        guildId,
        trainingChannelId2: channelId
      });
    }
  }
  
  async updateTrainingChannel3(guildId: string, channelId: string): Promise<ServerConfig> {
    const config = await this.getServerConfig(guildId);
    
    if (config) {
      return this.setServerConfig({
        ...config,
        guildId,
        trainingChannelId3: channelId
      });
    } else {
      return this.setServerConfig({
        guildId,
        trainingChannelId3: channelId
      });
    }
  }
  
  async updateTrainingChannel4(guildId: string, channelId: string): Promise<ServerConfig> {
    const config = await this.getServerConfig(guildId);
    
    if (config) {
      return this.setServerConfig({
        ...config,
        guildId,
        trainingChannelId4: channelId
      });
    } else {
      return this.setServerConfig({
        guildId,
        trainingChannelId4: channelId
      });
    }
  }
  
  async updateTrainingChannel5(guildId: string, channelId: string): Promise<ServerConfig> {
    const config = await this.getServerConfig(guildId);
    
    if (config) {
      return this.setServerConfig({
        ...config,
        guildId,
        trainingChannelId5: channelId
      });
    } else {
      return this.setServerConfig({
        guildId,
        trainingChannelId5: channelId
      });
    }
  }
  
  // Belirli bir kanal ID'sine göre kanal tipini ve süresini belirle
  async getTrainingChannelDuration(guildId: string, channelId: string): Promise<number> {
    console.log(`getTrainingChannelDuration çağrıldı: guildId=${guildId}, channelId=${channelId}`);
    
    // Parametreler null veya undefined ise varsayılan değer döndür
    if (!guildId || !channelId) {
      console.log(`getTrainingChannelDuration: Eksik parametreler! guildId=${guildId}, channelId=${channelId}`);
      return 1; // Varsayılan süre
    }
    
    try {
      const config = await this.getServerConfig(guildId);
      console.log(`Sunucu konfigürasyonu alındı:`, config);
      
      if (!config) {
        console.log(`${guildId} için sunucu konfigürasyonu bulunamadı.`);
        return 1; // Varsayılan süre
      }
      
      // Her bir kanal için süreyi kontrol et
      if (channelId === config.trainingChannelId1) {
        console.log(`Kanal ${channelId} kanal1 olarak eşleşti - 1 saat`);
        return 1; // 1 saat
      }
      if (channelId === config.trainingChannelId2) {
        console.log(`Kanal ${channelId} kanal2 olarak eşleşti - 2 saat`);
        return 2; // 2 saat
      }
      if (channelId === config.trainingChannelId3) {
        console.log(`Kanal ${channelId} kanal3 olarak eşleşti - 3 saat`);
        return 3; // 3 saat
      }
      if (channelId === config.trainingChannelId4) {
        console.log(`Kanal ${channelId} kanal4 olarak eşleşti - 4 saat`);
        return 4; // 4 saat
      }
      if (channelId === config.trainingChannelId5) {
        console.log(`Kanal ${channelId} kanal5 olarak eşleşti - 5 saat`);
        return 5; // 5 saat
      }
      
      // Ana kanal kontrolü
      if (channelId === config.trainingChannelId) {
        console.log(`Kanal ${channelId} ana kanal olarak eşleşti - 1 saat`);
        return 1; // Ana kanal - 1 saat
      }
      
      // Eşleşme yoksa varsayılan ana antrenman kanalı olarak kabul et
      console.log(`Kanal ${channelId} için eşleşme bulunamadı, varsayılan 1 saat kullanılıyor`);
      return 1; // Varsayılan süre
    } catch (error) {
      console.error(`getTrainingChannelDuration hata oluştu:`, error);
      return 1; // Hata durumunda varsayılan süre
    }
  }

  async updateLastReset(guildId: string): Promise<ServerConfig> {
    const config = await this.getServerConfig(guildId);
    
    if (!config) {
      // Eğer config yoksa, otomatik olarak oluştur
      console.log(`Config not found for guild ${guildId}, creating automatically`);
      return this.setServerConfig({
        guildId,
        fixLogChannelId: null,
        trainingChannelId: null
      });
    }
    
    const result = await this.pool.query(
      'UPDATE server_config SET last_reset_at = NOW(), updated_at = NOW() WHERE guild_id = $1 RETURNING *',
      [guildId]
    );
    
    return this.pgServerConfigToServerConfig(result.rows[0]);
  }

  // Yardımcı dönüştürme işlevleri
  private pgUserToUser(pgUser: any): User {
    return {
      id: pgUser.id,
      userId: pgUser.user_id,
      username: pgUser.username,
      displayName: pgUser.display_name || pgUser.username || null,
      avatarUrl: pgUser.avatar_url,
      createdAt: new Date(pgUser.created_at)
    };
  }

  private pgAttributeToAttribute(pgAttribute: any): Attribute {
    return {
      id: pgAttribute.id,
      userId: pgAttribute.user_id,
      name: pgAttribute.name,
      value: parseInt(pgAttribute.value) || 0,
      weeklyValue: parseInt(pgAttribute.weekly_value) || 0,
      createdAt: new Date(pgAttribute.created_at),
      updatedAt: new Date(pgAttribute.updated_at),
      source: pgAttribute.source || 'manual'
    };
  }

  private pgTicketToTicket(pgTicket: any): Ticket {
    return {
      id: pgTicket.id,
      ticketId: pgTicket.ticket_id,
      userId: pgTicket.user_id,
      status: pgTicket.status,
      type: pgTicket.type,
      createdAt: new Date(pgTicket.created_at),
      updatedAt: new Date(pgTicket.updated_at),
      closedAt: pgTicket.closed_at ? new Date(pgTicket.closed_at) : null,
      closedBy: pgTicket.closed_by || null
    };
  }

  private pgAttributeRequestToAttributeRequest(pgRequest: any): AttributeRequest {
    return {
      id: pgRequest.id,
      ticketId: pgRequest.ticket_id,
      attributeName: pgRequest.attribute_name,
      valueRequested: pgRequest.value_requested,
      approved: pgRequest.approved,
      createdAt: new Date(pgRequest.created_at)
    };
  }

  private pgTrainingSessionToTrainingSession(pgSession: any): TrainingSession {
    return {
      id: pgSession.id,
      userId: pgSession.user_id,
      ticketId: pgSession.ticket_id,
      attributeName: pgSession.attribute_name || "Genel Antrenman",
      duration: pgSession.duration,
      intensity: pgSession.intensity || 1,
      attributesGained: pgSession.attributes_gained,
      source: pgSession.source || "training",
      messageId: pgSession.message_id,
      channelId: pgSession.channel_id,
      createdAt: new Date(pgSession.created_at)
    };
  }

  private pgServerConfigToServerConfig(pgConfig: any): ServerConfig {
    return {
      id: pgConfig.id,
      guildId: pgConfig.guild_id,
      fixLogChannelId: pgConfig.fix_log_channel_id,
      trainingChannelId: pgConfig.training_channel_id,
      trainingChannelId1: pgConfig.training_channel_id_1,
      trainingChannelId2: pgConfig.training_channel_id_2,
      trainingChannelId3: pgConfig.training_channel_id_3,
      trainingChannelId4: pgConfig.training_channel_id_4,
      trainingChannelId5: pgConfig.training_channel_id_5,
      staffRoleId: pgConfig.staff_role_id,
      lastResetAt: new Date(pgConfig.last_reset_at),
      createdAt: new Date(pgConfig.created_at),
      updatedAt: new Date(pgConfig.updated_at)
    };
  }
  
  // Admin operations
  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM admins WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) return undefined;
    
    return this.pgAdminToAdmin(result.rows[0]);
  }

  async createAdmin(admin: InsertAdmin): Promise<Admin> {
    const result = await this.pool.query(
      'INSERT INTO admins(username, password_hash, display_name, role) VALUES($1, $2, $3, $4) RETURNING *',
      [admin.username, admin.passwordHash, admin.displayName, admin.role || 'admin']
    );
    
    return this.pgAdminToAdmin(result.rows[0]);
  }

  async updateAdminLastLogin(adminId: number): Promise<Admin> {
    const result = await this.pool.query(
      'UPDATE admins SET last_login = NOW() WHERE id = $1 RETURNING *',
      [adminId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Admin with ID ${adminId} not found`);
    }
    
    return this.pgAdminToAdmin(result.rows[0]);
  }
  
  async updateAdmin(admin: { id: number, displayName?: string }): Promise<Admin> {
    let query = 'UPDATE admins SET ';
    const params: any[] = [];
    let paramIndex = 1;
    const updates: string[] = [];
    
    if (admin.displayName) {
      updates.push(`display_name = $${paramIndex++}`);
      params.push(admin.displayName);
    }
    
    // Güncellenecek alan yoksa hata döndür
    if (updates.length === 0) {
      const existingAdmin = await this.pool.query(
        'SELECT * FROM admins WHERE id = $1',
        [admin.id]
      );
      
      if (existingAdmin.rows.length === 0) {
        throw new Error(`Admin with ID ${admin.id} not found`);
      }
      
      return this.pgAdminToAdmin(existingAdmin.rows[0]);
    }
    
    query += updates.join(', ');
    query += ` WHERE id = $${paramIndex} RETURNING *`;
    params.push(admin.id);
    
    const result = await this.pool.query(query, params);
    
    if (result.rows.length === 0) {
      throw new Error(`Admin with ID ${admin.id} not found`);
    }
    
    return this.pgAdminToAdmin(result.rows[0]);
  }
  
  // Chat operations
  async getChatMessages(limit?: number): Promise<(ChatMessage & { admin: Admin })[]> {
    const query = `
      SELECT 
        cm.*,
        a.*
      FROM 
        chat_messages cm
      JOIN 
        admins a ON cm.admin_id = a.id
      ORDER BY 
        cm.created_at DESC
      ${limit ? 'LIMIT $1' : ''}
    `;
    
    const params = limit ? [limit] : [];
    const result = await this.pool.query(query, params);
    
    return result.rows.map((row: any) => ({
      ...this.pgChatMessageToChatMessage(row),
      admin: this.pgAdminToAdmin(row)
    }));
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const result = await this.pool.query(
      'INSERT INTO chat_messages(admin_id, content) VALUES($1, $2) RETURNING *',
      [message.adminId, message.content]
    );
    
    return this.pgChatMessageToChatMessage(result.rows[0]);
  }
  
  // Helper methods for Admin and Chat
  private pgAdminToAdmin(pgAdmin: any): Admin {
    return {
      id: pgAdmin.id,
      username: pgAdmin.username,
      passwordHash: pgAdmin.password_hash,
      displayName: pgAdmin.display_name,
      role: pgAdmin.role,
      createdAt: pgAdmin.created_at ? new Date(pgAdmin.created_at) : new Date(),
      lastLogin: pgAdmin.last_login ? new Date(pgAdmin.last_login) : null
    };
  }
  
  private pgChatMessageToChatMessage(pgMessage: any): ChatMessage {
    return {
      id: pgMessage.id,
      adminId: pgMessage.admin_id,
      content: pgMessage.content,
      createdAt: pgMessage.created_at ? new Date(pgMessage.created_at) : new Date()
    };
  }
}
import pg from 'pg';
const { Pool } = pg;
import { IStorage } from './storage';
import { 
  User, InsertUser, 
  Attribute, InsertAttribute,
  Ticket, InsertTicket,
  AttributeRequest, InsertAttributeRequest,
  TrainingSession, InsertTrainingSession,
  ServerConfig, InsertServerConfig
} from '../shared/schema';

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
      'INSERT INTO users(user_id, username, avatar_url) VALUES($1, $2, $3) RETURNING *',
      [insertUser.userId, insertUser.username, insertUser.avatarUrl || null]
    );
    
    return this.pgUserToUser(result.rows[0]);
  }

  async getOrCreateUser(userId: string, username: string, avatarUrl?: string): Promise<User> {
    const existingUser = await this.getUserById(userId);
    if (existingUser) return existingUser;
    
    return this.createUser({
      userId,
      username,
      avatarUrl
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

  async updateAttribute(userId: string, attributeName: string, value: number, weeklyValue?: number, absoluteValue: boolean = false): Promise<Attribute> {
    const existing = await this.getAttribute(userId, attributeName);
    
    if (existing) {
      // Eğer absoluteValue true ise, mevcut değerin üzerine yaz, yoksa ekle
      const newValue = absoluteValue ? value : existing.value + value;
      const newWeeklyValue = weeklyValue !== undefined ? weeklyValue : 
                            absoluteValue ? value : existing.weeklyValue + value;
      
      console.log(`Updating attribute ${attributeName} for user ${userId}: Current value=${existing.value}, Adding=${value}, New value=${newValue}`);
      
      const result = await this.pool.query(
        'UPDATE attributes SET value = $1, weekly_value = $2, updated_at = NOW() WHERE user_id = $3 AND name = $4 RETURNING *',
        [newValue, newWeeklyValue, userId, attributeName]
      );
      
      return this.pgAttributeToAttribute(result.rows[0]);
    } else {
      // Yeni nitelik oluştur
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
    await this.updateLastReset(guildId);
  }

  async getPlayerAttributeStats(userId?: string): Promise<any[]> {
    let userQuery;
    let params: any[] = [];
    
    if (userId) {
      userQuery = 'WHERE u.user_id = $1';
      params.push(userId);
    } else {
      userQuery = '';
    }
    
    // Kullanıcı bilgileri ve toplam nitelik değerleri
    const result = await this.pool.query(`
      SELECT 
        u.*, 
        COALESCE(SUM(a.value), 0) as total_value,
        COALESCE(SUM(a.weekly_value), 0) as weekly_value,
        (
          SELECT updated_at 
          FROM tickets 
          WHERE user_id = u.user_id AND status = 'closed'
          ORDER BY updated_at DESC
          LIMIT 1
        ) as last_fix_date
      FROM 
        users u
      LEFT JOIN 
        attributes a ON u.user_id = a.user_id
      ${userQuery}
      GROUP BY 
        u.id
    `, params);
    
    const playerStats = [];
    
    for (const row of result.rows) {
      // Her kullanıcı için nitelikleri al
      const attributes = await this.getAttributes(row.user_id);
      
      playerStats.push({
        user: this.pgUserToUser(row),
        totalValue: parseInt(row.total_value) || 0,
        weeklyValue: parseInt(row.weekly_value) || 0,
        lastFixDate: row.last_fix_date ? new Date(row.last_fix_date) : null,
        attributes
      });
    }
    
    return playerStats;
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

  async closeTicket(ticketId: string): Promise<Ticket> {
    return this.updateTicketStatus(ticketId, 'closed');
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
    const result = await this.pool.query(
      'INSERT INTO attribute_requests(ticket_id, attribute_name, value_requested, approved) VALUES($1, $2, $3, $4) RETURNING *',
      [
        insertRequest.ticketId, 
        insertRequest.attributeName, 
        insertRequest.valueRequested, 
        insertRequest.approved !== undefined ? insertRequest.approved : false
      ]
    );
    
    return this.pgAttributeRequestToAttributeRequest(result.rows[0]);
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
    const result = await this.pool.query(
      'INSERT INTO training_sessions(user_id, ticket_id, duration, attributes_gained) VALUES($1, $2, $3, $4) RETURNING *',
      [
        insertSession.userId, 
        insertSession.ticketId || "", 
        insertSession.duration, 
        insertSession.attributesGained
      ]
    );
    
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
      // Mevcut yapılandırmayı güncelle
      const result = await this.pool.query(
        'UPDATE server_config SET fix_log_channel_id = $1, training_channel_id = $2, updated_at = NOW() WHERE guild_id = $3 RETURNING *',
        [
          insertConfig.fixLogChannelId !== undefined ? insertConfig.fixLogChannelId : existing.fixLogChannelId, 
          insertConfig.trainingChannelId !== undefined ? insertConfig.trainingChannelId : existing.trainingChannelId, 
          insertConfig.guildId
        ]
      );
      
      return this.pgServerConfigToServerConfig(result.rows[0]);
    } else {
      // Yeni yapılandırma oluştur
      const result = await this.pool.query(
        'INSERT INTO server_config(guild_id, fix_log_channel_id, training_channel_id) VALUES($1, $2, $3) RETURNING *',
        [
          insertConfig.guildId, 
          insertConfig.fixLogChannelId || null, 
          insertConfig.trainingChannelId || null
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
      updatedAt: new Date(pgAttribute.updated_at)
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
      closedAt: pgTicket.closed_at ? new Date(pgTicket.closed_at) : null
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
      duration: pgSession.duration,
      attributesGained: pgSession.attributes_gained,
      createdAt: new Date(pgSession.created_at)
    };
  }

  private pgServerConfigToServerConfig(pgConfig: any): ServerConfig {
    return {
      id: pgConfig.id,
      guildId: pgConfig.guild_id,
      fixLogChannelId: pgConfig.fix_log_channel_id,
      trainingChannelId: pgConfig.training_channel_id,
      lastResetAt: new Date(pgConfig.last_reset_at),
      createdAt: new Date(pgConfig.created_at),
      updatedAt: new Date(pgConfig.updated_at)
    };
  }
}
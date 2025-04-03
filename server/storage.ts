import {
  users, User, InsertUser,
  attributes, Attribute, InsertAttribute,
  tickets, Ticket, InsertTicket,
  attributeRequests, AttributeRequest, InsertAttributeRequest,
  trainingSessions, TrainingSession, InsertTrainingSession,
  serverConfig, ServerConfig, InsertServerConfig,
  admins, Admin, InsertAdmin,
  chatMessages, ChatMessage, InsertChatMessage
} from "@shared/schema";
import { createHash } from "crypto";
import pg from 'pg';
const { Pool } = pg;
import { PgStorage } from './pgStorage';

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserById(userId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getOrCreateUser(userId: string, username: string, avatarUrl?: string): Promise<User>;

  // Attribute operations
  getAttributes(userId: string): Promise<Attribute[]>;
  getTrainingAttributes(userId: string): Promise<Attribute[]>; // Yalnızca antrenman kaynaklı nitelikler
  getAttribute(userId: string, attributeName: string): Promise<Attribute | undefined>;
  updateAttribute(userId: string, attributeName: string, value: number, weeklyValue?: number, absoluteValue?: boolean, onlyUpdateWeekly?: boolean, source?: string): Promise<Attribute>;
  resetWeeklyAttributes(guildId: string): Promise<void>;
  resetAllAttributes(guildId: string): Promise<void>;
  deleteAllAttributes(): Promise<void>; // Tüm nitelik kayıtlarını veritabanından tamamen sil
  getPlayerAttributeStats(userId?: string): Promise<any[]>;
  getPlayerTrainingStats(userId?: string): Promise<any[]>; // Antrenman liderlik tablosu için

  // Ticket operations
  getTicket(ticketId: string): Promise<Ticket | undefined>;
  getOpenTickets(): Promise<Ticket[]>;
  getAllTickets(): Promise<Ticket[]>; // Hem açık hem kapalı tüm ticketları getir
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicketStatus(ticketId: string, status: string): Promise<Ticket>;
  closeTicket(ticketId: string, closedBy?: string): Promise<Ticket>;

  // Attribute request operations
  getAttributeRequests(ticketId: string): Promise<AttributeRequest[]>;
  createAttributeRequest(request: InsertAttributeRequest): Promise<AttributeRequest>;
  approveAttributeRequest(requestId: number): Promise<AttributeRequest>;
  getTotalAttributesForTicket(ticketId: string): Promise<number>;

  // Training session operations
  createTrainingSession(session: InsertTrainingSession): Promise<TrainingSession>;
  getTrainingSessions(userId: string): Promise<TrainingSession[]>;

  // Server config operations
  getServerConfig(guildId: string): Promise<ServerConfig | undefined>;
  setServerConfig(config: InsertServerConfig): Promise<ServerConfig>;
  updateFixLogChannel(guildId: string, channelId: string): Promise<ServerConfig>;
  updateTrainingChannel(guildId: string, channelId: string): Promise<ServerConfig>;
  updateLastReset(guildId: string): Promise<ServerConfig>;

  // Admin operations
  getAdminByUsername(username: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;
  updateAdminLastLogin(adminId: number): Promise<Admin>;
  updateAdmin(admin: { id: number, displayName?: string }): Promise<Admin>;

  // Chat operations
  getChatMessages(limit?: number): Promise<(ChatMessage & { admin: Admin })[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private usersByDiscordId: Map<string, User>;
  private attributes: Map<number, Attribute>;
  private tickets: Map<number, Ticket>;
  private attributeRequests: Map<number, AttributeRequest>;
  private trainingSessions: Map<number, TrainingSession>;
  private configs: Map<number, ServerConfig>;
  private admins: Map<number, Admin>;
  private chatMessages: Map<number, ChatMessage>;

  private currentUserId: number;
  private currentAttributeId: number;
  private currentTicketId: number;
  private currentRequestId: number;
  private currentSessionId: number;
  private currentConfigId: number;
  private currentAdminId: number;
  private currentChatMessageId: number;

  constructor() {
    this.users = new Map();
    this.usersByDiscordId = new Map();
    this.attributes = new Map();
    this.tickets = new Map();
    this.attributeRequests = new Map();
    this.trainingSessions = new Map();
    this.configs = new Map();
    this.admins = new Map();
    this.chatMessages = new Map();

    this.currentUserId = 1;
    this.currentAttributeId = 1;
    this.currentTicketId = 1;
    this.currentRequestId = 1;
    this.currentSessionId = 1;
    this.currentConfigId = 1;
    this.currentAdminId = 1;
    this.currentChatMessageId = 1;
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.id.toString() === id);
  }

  async getUserById(userId: string): Promise<User | undefined> {
    return this.usersByDiscordId.get(userId);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const now = new Date();
    // avatarUrl ve nickname null olarak ayarla, undefined olmasını engelle
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt: now,
      avatarUrl: insertUser.avatarUrl || null,
      nickname: insertUser.nickname || null
    };
    this.users.set(id, user);
    this.usersByDiscordId.set(user.userId, user);
    return user;
  }

  async getOrCreateUser(userId: string, username: string, avatarUrl?: string, nickname?: string): Promise<User> {
    const existingUser = await this.getUserById(userId);
    if (existingUser) {
      // Eğer kullanıcı varsa ve takma ad güncellenecekse
      if (nickname && existingUser.nickname !== nickname) {
        existingUser.nickname = nickname;
        // In-memory veritabanında kaydı güncelle
        this.users.set(existingUser.id, existingUser);
        this.usersByDiscordId.set(existingUser.userId, existingUser);
      }
      return existingUser;
    }

    return this.createUser({
      userId,
      username,
      nickname,
      avatarUrl
    });
  }

  // Attribute operations
  async getAttributes(userId: string): Promise<Attribute[]> {
    return Array.from(this.attributes.values()).filter(a => a.userId === userId);
  }

  async getAttribute(userId: string, attributeName: string): Promise<Attribute | undefined> {
    return Array.from(this.attributes.values()).find(
      a => a.userId === userId && a.name === attributeName
    );
  }

  async updateAttribute(
    userId: string, 
    attributeName: string, 
    value: number, 
    weeklyValue?: number,
    absoluteValue: boolean = false,
    onlyUpdateWeekly: boolean = false,
    source: string = 'manual'
  ): Promise<Attribute> {
    const existing = await this.getAttribute(userId, attributeName);
    const now = new Date();

    if (existing) {
      // YENİ: Tüm kaynaklardan (ticket dahil) değer artışları haftalık değere eklensin
      const updated: Attribute = {
        ...existing,
        // onlyUpdateWeekly true ise value değişmez, değilse normal güncelleme yapılır
        value: onlyUpdateWeekly ? existing.value : existing.value + value, // absoluteValue parametresini yok sayıyoruz
        weeklyValue: weeklyValue !== undefined 
          ? existing.weeklyValue + weeklyValue // Haftalık değeri her zaman toplayarak değiştir  
          : existing.weeklyValue + value, // Haftalık değeri HER ZAMAN ve HER KAYNAKTAN (ticket dahil) arttır
        updatedAt: now,
        source: source // Kaynağı belirle
      };
      this.attributes.set(existing.id, updated);
      return updated;
    } else {
      // Yeni nitelik oluşturulduğunda ilk değerleri ayarla
      const id = this.currentAttributeId++;
      const newAttribute: Attribute = {
        id,
        userId,
        name: attributeName,
        value,
        weeklyValue: weeklyValue !== undefined ? weeklyValue : value,
        createdAt: now,
        updatedAt: now,
        source: source
      };
      this.attributes.set(id, newAttribute);
      return newAttribute;
    }
  }

  async resetWeeklyAttributes(guildId: string): Promise<void> {
    // Yineleyicileri kullanmak yerine Array.from kullanıyoruz
    const allAttributes = Array.from(this.attributes.entries());
    const now = new Date();

    for (const [id, attribute] of allAttributes) {
      this.attributes.set(id, {
        ...attribute,
        weeklyValue: 0,
        updatedAt: now
      });
    }

    await this.updateLastReset(guildId);
  }

  async resetAllAttributes(guildId: string): Promise<void> {
    // Tüm nitelikleri sıfırla
    const allAttributes = Array.from(this.attributes.entries());
    const now = new Date();

    for (const [id, attribute] of allAttributes) {
      this.attributes.set(id, {
        ...attribute,
        value: 0,
        weeklyValue: 0,
        updatedAt: now
      });
    }

    await this.updateLastReset(guildId);
  }

  async deleteAllAttributes(): Promise<void> {
    // Tüm nitelik kayıtlarını sil
    this.attributes.clear();
    console.log(`Tüm nitelik kayıtları bellekten tamamen silindi - ${new Date().toISOString()}`);
  }

  async getPlayerAttributeStats(userId?: string): Promise<any[]> {
    const userList = userId 
      ? [await this.getUserById(userId)].filter(Boolean) as User[]
      : Array.from(this.users.values());

    return await Promise.all(userList.map(async (user) => {
      const attributes = await this.getAttributes(user.userId);

      // Calculate totals
      const totalValue = attributes.reduce((sum, attr) => sum + attr.value, 0);
      const weeklyValue = attributes.reduce((sum, attr) => sum + attr.weeklyValue, 0);

      // Get last training or attribute request
      const userTickets = Array.from(this.tickets.values())
        .filter(t => t.userId === user.userId)
        .sort((a, b) => {
          return (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0);
        });

      const lastFixDate = userTickets.length > 0 ? userTickets[0].updatedAt : null;

      return {
        user,
        totalValue,
        weeklyValue,
        lastFixDate,
        attributes
      };
    }));
  }

  async getPlayerTrainingStats(userId?: string): Promise<any[]> {
    const userList = userId 
      ? [await this.getUserById(userId)].filter(Boolean) as User[]
      : Array.from(this.users.values());

    return await Promise.all(userList.map(async (user) => {
      // Kullanıcının antrenman kayıtlarını al
      const trainingSessions = Array.from(this.trainingSessions.values())
        .filter(s => s.userId === user.userId && (s.source === 'message' || s.source === 'training'))
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

      // Antrenman nitelik puanlarını hesapla
      const attributeMap = new Map<string, number>();
      trainingSessions.forEach(session => {
        if (session.attributeName) {
          const attrName = session.attributeName;
          const attrValue = session.attributesGained || 0;

          attributeMap.set(attrName, (attributeMap.get(attrName) || 0) + attrValue);
        }
      });

      // Nitelikler listesini oluştur
      const attributes = Array.from(attributeMap.entries()).map(([name, value]) => ({
        name, 
        value
      }));

      // Toplam antrenman puanını hesapla
      const totalTrainingValue = trainingSessions.reduce((sum, s) => sum + (s.attributesGained || 0), 0);

      return {
        user,
        totalTrainingValue,
        trainingCount: trainingSessions.length,
        attributes,
        trainingSessions
      };
    }));
  }

  async getTrainingAttributes(userId: string): Promise<Attribute[]> {
    // Sadece antrenman kaynaklı kazanılmış nitelikleri hesapla
    const trainingSessions = Array.from(this.trainingSessions.values())
      .filter(s => s.userId === userId && (s.source === 'message' || s.source === 'training'));

    // Nitelik başına toplam puanları hesapla
    const attributeMap = new Map<string, number>();
    trainingSessions.forEach(session => {
      if (session.attributeName) {
        const attrName = session.attributeName;
        const attrValue = session.attributesGained || 0;

        attributeMap.set(attrName, (attributeMap.get(attrName) || 0) + attrValue);
      }
    });

    // Nitelikler listesini döndür
    const now = new Date();
    return Array.from(attributeMap.entries()).map(([name, value], index) => ({
      id: index, // Geçici bir ID
      userId,
      name,
      value,
      weeklyValue: 0, // Bu görünümde haftalık değeri hesaplamıyoruz
      createdAt: now,
      updatedAt: now,
      source: 'training'
    }));
  }

  // Ticket operations
  async getTicket(ticketId: string): Promise<Ticket | undefined> {
    return Array.from(this.tickets.values()).find(t => t.ticketId === ticketId);
  }

  async getOpenTickets(): Promise<Ticket[]> {
    return Array.from(this.tickets.values())
      .filter(t => t.status === 'open' || t.status === 'pending')
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getAllTickets(): Promise<Ticket[]> {
    return Array.from(this.tickets.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async createTicket(insertTicket: InsertTicket): Promise<Ticket> {
    const id = this.currentTicketId++;
    const now = new Date();

    // Ticket için gerekli tüm alanları açıkça belirt, undefined değerleri engelle
    const ticket: Ticket = { 
      id,
      type: insertTicket.type || 'attribute', // Default olarak 'attribute' kullan
      status: insertTicket.status || 'open',  // Default olarak 'open' kullan
      userId: insertTicket.userId,
      ticketId: insertTicket.ticketId,
      createdAt: now, 
      updatedAt: now,
      closedAt: null,
      closedBy: null
    };

    this.tickets.set(id, ticket);
    return ticket;
  }

  async updateTicketStatus(ticketId: string, status: string): Promise<Ticket> {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) throw new Error(`Ticket with ID ${ticketId} not found`);

    const updated: Ticket = {
      ...ticket,
      status,
      updatedAt: new Date(),
      closedAt: status === 'closed' ? new Date() : ticket.closedAt,
      closedBy: ticket.closedBy // Mevcut closedBy değerini koru
    };

    this.tickets.set(ticket.id, updated);
    return updated;
  }

  async closeTicket(ticketId: string, closedBy?: string): Promise<Ticket> {
    // Var olan ticket'ı bul
    const ticket = await this.getTicket(ticketId);
    if (!ticket) throw new Error(`Ticket with ID ${ticketId} not found`);

    // Güvenli bir şekilde closedBy değerini ayarla
    const finalClosedBy = closedBy || null;
    
    console.log(`Ticket kapatılıyor: ${ticketId}, kapatan: ${finalClosedBy || 'bilinmiyor'}`);

    // Ticket'ı kapat
    const updated: Ticket = {
      ...ticket,
      status: 'closed',
      updatedAt: new Date(),
      closedAt: new Date(),
      closedBy: finalClosedBy
    };

    this.tickets.set(ticket.id, updated);
    console.log(`Ticket başarıyla kapatıldı: ${ticketId}`);
    
    return updated;
  }

  // Attribute request operations
  async getAttributeRequests(ticketId: string): Promise<AttributeRequest[]> {
    return Array.from(this.attributeRequests.values())
      .filter(r => r.ticketId === ticketId);
  }

  async createAttributeRequest(insertRequest: InsertAttributeRequest): Promise<AttributeRequest> {
    const id = this.currentRequestId++;
    const now = new Date();

    // Tüm gerekli alanları açıkça belirt, undefined değerleri engelle
    const request: AttributeRequest = { 
      id, 
      createdAt: now,
      ticketId: insertRequest.ticketId,
      attributeName: insertRequest.attributeName,
      valueRequested: insertRequest.valueRequested,
      approved: insertRequest.approved !== undefined ? insertRequest.approved : false // Default değer
    };

    this.attributeRequests.set(id, request);
    return request;
  }

  async approveAttributeRequest(requestId: number): Promise<AttributeRequest> {
    const request = this.attributeRequests.get(requestId);
    if (!request) throw new Error(`Request with ID ${requestId} not found`);

    const updated: AttributeRequest = {
      ...request,
      approved: true
    };

    this.attributeRequests.set(requestId, updated);
    return updated;
  }

  async getTotalAttributesForTicket(ticketId: string): Promise<number> {
    const requests = await this.getAttributeRequests(ticketId);
    return requests.reduce((sum, req) => sum + (req.approved ? req.valueRequested : 0), 0);
  }

  // Training session operations
  async createTrainingSession(insertSession: InsertTrainingSession): Promise<TrainingSession> {
    const id = this.currentSessionId++;
    const now = new Date();

    // Tüm gerekli alanları açıkça belirt, undefined değerleri engelle
    const session: TrainingSession = {
      id, 
      createdAt: now,
      userId: insertSession.userId,
      ticketId: insertSession.ticketId || null, // null varsayılan değer
      attributeName: insertSession.attributeName || "Genel Antrenman",
      duration: insertSession.duration,
      intensity: insertSession.intensity || 1,
      attributesGained: insertSession.attributesGained,
      source: insertSession.source || "training",
      messageId: insertSession.messageId || null,
      channelId: insertSession.channelId || null
    };

    this.trainingSessions.set(id, session);
    return session;
  }

  async getTrainingSessions(userId: string): Promise<TrainingSession[]> {
    return Array.from(this.trainingSessions.values())
      .filter(s => s.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  // Server config operations
  async getServerConfig(guildId: string): Promise<ServerConfig | undefined> {
    return Array.from(this.configs.values()).find(c => c.guildId === guildId);
  }

  async setServerConfig(insertConfig: InsertServerConfig): Promise<ServerConfig> {
    const existing = await this.getServerConfig(insertConfig.guildId);
    const now = new Date();

    if (existing) {
      // Tüm gerekli alanları açıkça belirt
      const updated: ServerConfig = {
        id: existing.id,
        guildId: insertConfig.guildId,
        fixLogChannelId: insertConfig.fixLogChannelId !== undefined ? insertConfig.fixLogChannelId : existing.fixLogChannelId,
        trainingChannelId: insertConfig.trainingChannelId !== undefined ? insertConfig.trainingChannelId : existing.trainingChannelId,
        staffRoleId: insertConfig.staffRoleId !== undefined ? insertConfig.staffRoleId : existing.staffRoleId,
        // Rating bazlı roller
        role6070Id: insertConfig.role6070Id !== undefined ? insertConfig.role6070Id : existing.role6070Id,
        role7080Id: insertConfig.role7080Id !== undefined ? insertConfig.role7080Id : existing.role7080Id,
        role8090Id: insertConfig.role8090Id !== undefined ? insertConfig.role8090Id : existing.role8090Id,
        role9099Id: insertConfig.role9099Id !== undefined ? insertConfig.role9099Id : existing.role9099Id,
        lastResetAt: existing.lastResetAt,
        createdAt: existing.createdAt,
        updatedAt: now
      };
      this.configs.set(existing.id, updated);
      return updated;
    } else {
      const id = this.currentConfigId++;
      // Yeni yapılandırma için tüm alanları açıkça belirt
      const newConfig: ServerConfig = {
        id,
        guildId: insertConfig.guildId,
        fixLogChannelId: insertConfig.fixLogChannelId || null,
        trainingChannelId: insertConfig.trainingChannelId || null,
        staffRoleId: insertConfig.staffRoleId || null,
        // Rating bazlı roller varsayılan olarak null
        role6070Id: insertConfig.role6070Id || null,
        role7080Id: insertConfig.role7080Id || null,
        role8090Id: insertConfig.role8090Id || null,
        role9099Id: insertConfig.role9099Id || null,
        lastResetAt: now,
        createdAt: now,
        updatedAt: now
      };
      this.configs.set(id, newConfig);
      return newConfig;
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
        trainingChannelId: null,
        staffRoleId: null,
        role6070Id: null,
        role7080Id: null,
        role8090Id: null,
        role9099Id: null
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
        trainingChannelId: channelId,
        staffRoleId: null,
        role6070Id: null,
        role7080Id: null,
        role8090Id: null,
        role9099Id: null
      });
    }
  }

  async updateLastReset(guildId: string): Promise<ServerConfig> {
    const config = await this.getServerConfig(guildId);
    if (!config) {
      throw new Error(`No config found for guild ${guildId}`);
    }

    const now = new Date();

    // Tüm gerekli alanları açıkça belirt
    const updated: ServerConfig = {
      id: config.id,
      guildId: config.guildId,
      fixLogChannelId: config.fixLogChannelId,
      trainingChannelId: config.trainingChannelId,
      staffRoleId: config.staffRoleId,
      // Rating bazlı roller
      role6070Id: config.role6070Id,
      role7080Id: config.role7080Id,
      role8090Id: config.role8090Id,
      role9099Id: config.role9099Id,
      lastResetAt: now,
      createdAt: config.createdAt,
      updatedAt: now
    };

    this.configs.set(config.id, updated);
    return updated;
  }

  // Admin operations
  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    return Array.from(this.admins.values()).find(a => a.username === username);
  }

  async createAdmin(admin: InsertAdmin): Promise<Admin> {
    const id = this.currentAdminId++;
    const now = new Date();

    const newAdmin: Admin = {
      id,
      username: admin.username,
      passwordHash: admin.passwordHash,
      displayName: admin.displayName,
      role: admin.role || "admin",
      createdAt: now,
      lastLogin: null
    };

    this.admins.set(id, newAdmin);
    return newAdmin;
  }

  async updateAdminLastLogin(adminId: number): Promise<Admin> {
    const admin = this.admins.get(adminId);
    if (!admin) throw new Error(`Admin with ID ${adminId} not found`);

    const now = new Date();
    const updated: Admin = {
      ...admin,
      lastLogin: now
    };

    this.admins.set(adminId, updated);
    return updated;
  }

  async updateAdmin(admin: { id: number, displayName?: string }): Promise<Admin> {
    const existing = this.admins.get(admin.id);
    if (!existing) {
      throw new Error(`Admin with ID ${admin.id} not found`);
    }

    const updated: Admin = {
      ...existing
    };

    if (admin.displayName) {
      updated.displayName = admin.displayName;
    }

    this.admins.set(admin.id, updated);
    return updated;
  }

  // Chat operations
  async getChatMessages(limit?: number): Promise<(ChatMessage & { admin: Admin })[]> {
    const allMessages = Array.from(this.chatMessages.values())
      .sort((a, b) => (b.createdAt.getTime()) - (a.createdAt.getTime()));

    const messages = limit ? allMessages.slice(0, limit) : allMessages;

    return messages.map(msg => {
      const admin = this.admins.get(msg.adminId);
      if (!admin) throw new Error(`Admin with ID ${msg.adminId} not found for message ${msg.id}`);

      return {
        ...msg,
        admin
      };
    });
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const id = this.currentChatMessageId++;
    const now = new Date();

    const newMessage: ChatMessage = {
      id,
      adminId: message.adminId,
      content: message.content,
      createdAt: now
    };

    this.chatMessages.set(id, newMessage);
    return newMessage;
  }
}

// PostgreSQL veritabanı bağlantısını kur
console.log('PostgreSQL veritabanı depolaması kullanılıyor');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Geçici olarak MemStorage kullan, PgStorage düzeltilene kadar
let storage: IStorage = new MemStorage();

export { storage };
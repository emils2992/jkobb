import {
  users, User, InsertUser,
  attributes, Attribute, InsertAttribute,
  tickets, Ticket, InsertTicket,
  attributeRequests, AttributeRequest, InsertAttributeRequest,
  trainingSessions, TrainingSession, InsertTrainingSession,
  serverConfig, ServerConfig, InsertServerConfig
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserById(userId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getOrCreateUser(userId: string, username: string, avatarUrl?: string): Promise<User>;
  
  // Attribute operations
  getAttributes(userId: string): Promise<Attribute[]>;
  getAttribute(userId: string, attributeName: string): Promise<Attribute | undefined>;
  updateAttribute(userId: string, attributeName: string, value: number, weeklyValue?: number): Promise<Attribute>;
  resetWeeklyAttributes(guildId: string): Promise<void>;
  getPlayerAttributeStats(userId?: string): Promise<any[]>;
  
  // Ticket operations
  getTicket(ticketId: string): Promise<Ticket | undefined>;
  getOpenTickets(): Promise<Ticket[]>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicketStatus(ticketId: string, status: string): Promise<Ticket>;
  closeTicket(ticketId: string): Promise<Ticket>;
  
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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private usersByDiscordId: Map<string, User>;
  private attributes: Map<number, Attribute>;
  private tickets: Map<number, Ticket>;
  private attributeRequests: Map<number, AttributeRequest>;
  private trainingSessions: Map<number, TrainingSession>;
  private configs: Map<number, ServerConfig>;
  
  private currentUserId: number;
  private currentAttributeId: number;
  private currentTicketId: number;
  private currentRequestId: number;
  private currentSessionId: number;
  private currentConfigId: number;

  constructor() {
    this.users = new Map();
    this.usersByDiscordId = new Map();
    this.attributes = new Map();
    this.tickets = new Map();
    this.attributeRequests = new Map();
    this.trainingSessions = new Map();
    this.configs = new Map();
    
    this.currentUserId = 1;
    this.currentAttributeId = 1;
    this.currentTicketId = 1;
    this.currentRequestId = 1;
    this.currentSessionId = 1;
    this.currentConfigId = 1;
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
    const user: User = { ...insertUser, id, createdAt: now };
    this.users.set(id, user);
    this.usersByDiscordId.set(user.userId, user);
    return user;
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
    weeklyValue?: number
  ): Promise<Attribute> {
    const existing = await this.getAttribute(userId, attributeName);
    const now = new Date();
    
    if (existing) {
      const updated: Attribute = {
        ...existing,
        value: existing.value + value,
        weeklyValue: weeklyValue !== undefined 
          ? weeklyValue 
          : existing.weeklyValue + value,
        updatedAt: now
      };
      this.attributes.set(existing.id, updated);
      return updated;
    } else {
      const id = this.currentAttributeId++;
      const newAttribute: Attribute = {
        id,
        userId,
        name: attributeName,
        value,
        weeklyValue: weeklyValue !== undefined ? weeklyValue : value,
        createdAt: now,
        updatedAt: now
      };
      this.attributes.set(id, newAttribute);
      return newAttribute;
    }
  }

  async resetWeeklyAttributes(guildId: string): Promise<void> {
    for (const [id, attribute] of this.attributes.entries()) {
      this.attributes.set(id, {
        ...attribute,
        weeklyValue: 0,
        updatedAt: new Date()
      });
    }
    
    await this.updateLastReset(guildId);
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

  // Ticket operations
  async getTicket(ticketId: string): Promise<Ticket | undefined> {
    return Array.from(this.tickets.values()).find(t => t.ticketId === ticketId);
  }

  async getOpenTickets(): Promise<Ticket[]> {
    return Array.from(this.tickets.values())
      .filter(t => t.status === 'open' || t.status === 'pending')
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async createTicket(insertTicket: InsertTicket): Promise<Ticket> {
    const id = this.currentTicketId++;
    const now = new Date();
    const ticket: Ticket = { 
      ...insertTicket, 
      id, 
      createdAt: now, 
      updatedAt: now,
      closedAt: null
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
      closedAt: status === 'closed' ? new Date() : ticket.closedAt
    };
    
    this.tickets.set(ticket.id, updated);
    return updated;
  }

  async closeTicket(ticketId: string): Promise<Ticket> {
    return this.updateTicketStatus(ticketId, 'closed');
  }

  // Attribute request operations
  async getAttributeRequests(ticketId: string): Promise<AttributeRequest[]> {
    return Array.from(this.attributeRequests.values())
      .filter(r => r.ticketId === ticketId);
  }

  async createAttributeRequest(insertRequest: InsertAttributeRequest): Promise<AttributeRequest> {
    const id = this.currentRequestId++;
    const now = new Date();
    const request: AttributeRequest = { ...insertRequest, id, createdAt: now };
    
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
    const session: TrainingSession = { ...insertSession, id, createdAt: now };
    
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
      const updated: ServerConfig = {
        ...existing,
        ...insertConfig,
        updatedAt: now
      };
      this.configs.set(existing.id, updated);
      return updated;
    } else {
      const id = this.currentConfigId++;
      const newConfig: ServerConfig = {
        id,
        ...insertConfig,
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
      throw new Error(`No config found for guild ${guildId}`);
    }
    
    const updated: ServerConfig = {
      ...config,
      lastResetAt: new Date(),
      updatedAt: new Date()
    };
    
    this.configs.set(config.id, updated);
    return updated;
  }
}

export const storage = new MemStorage();

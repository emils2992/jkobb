import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { Session } from "express-session";
import { storage } from "./storage";
import { initDiscordBot } from "./discord";
import { startUptimeService } from "./uptime";
import { z } from "zod";
import { createHash } from "crypto";
import { Admin } from "../shared/schema";
import { pool } from "./db";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Ping endpoint for uptime
  app.get('/ping', (req, res) => {
    res.status(200).send('Pong!');
  });
  
  // Uptime check endpoint
  app.get('/uptime-check', (req, res) => {
    res.status(200).json({
      status: 'online',
      timestamp: new Date().toISOString(),
      server: 'Discord Halısaha Bot'
    });
  });
  
  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Initialize Discord bot (temporarily disabled for testing)
  // await initDiscordBot();
  
  // Start uptime service
  startUptimeService();
  
  // Add health check endpoint specifically for uptime monitoring
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  });

  // Get all tickets (including closed ones)
  app.get("/api/tickets", async (req, res) => {
    try {
      const tickets = await storage.getAllTickets();
      
      // Get additional info for each ticket
      const ticketsWithDetails = await Promise.all(
        tickets.map(async (ticket) => {
          const user = await storage.getUserById(ticket.userId);
          const attributeRequests = await storage.getAttributeRequests(ticket.ticketId);
          const totalAttributes = await storage.getTotalAttributesForTicket(ticket.ticketId);
          
          return {
            ...ticket,
            user,
            attributeRequests,
            totalAttributes
          };
        })
      );
      
      res.json(ticketsWithDetails);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });
  
  // Update ticket status
  app.patch("/api/tickets/:ticketId", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      
      const updatedTicket = await storage.updateTicketStatus(ticketId, status);
      res.json(updatedTicket);
    } catch (error) {
      console.error("Error updating ticket:", error);
      res.status(500).json({ message: "Failed to update ticket" });
    }
  });
  
  // Update attribute request
  app.patch("/api/attribute-requests/:requestId", async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      const { attributeName, valueRequested, approved } = req.body;
      
      // İstek onaylanıyorsa
      if (approved) {
        const updatedRequest = await storage.approveAttributeRequest(requestId);
        return res.json(updatedRequest);
      }
      
      // Burada normalde attributeName ve valueRequested güncelleme kodu olmalı
      // Ancak mevcut storage interface'inde bu metot yok, bu yüzden şimdilik sadece onay işlemi yapılabilir
      
      res.status(400).json({ message: "Unsupported operation" });
    } catch (error) {
      console.error("Error updating attribute request:", error);
      res.status(500).json({ message: "Failed to update attribute request" });
    }
  });
  
  // Create new attribute request
  app.post("/api/attribute-requests", async (req, res) => {
    try {
      const { ticketId, attributeName, valueRequested } = req.body;
      
      if (!ticketId || !attributeName || valueRequested == null) {
        return res.status(400).json({ message: "All fields are required" });
      }
      
      const newRequest = await storage.createAttributeRequest({
        ticketId,
        attributeName,
        valueRequested,
      });
      
      res.json(newRequest);
    } catch (error) {
      console.error("Error creating attribute request:", error);
      res.status(500).json({ message: "Failed to create attribute request" });
    }
  });

  // Get ticket by ID
  app.get("/api/tickets/:ticketId", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const ticket = await storage.getTicket(ticketId);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      const user = await storage.getUserById(ticket.userId);
      const attributeRequests = await storage.getAttributeRequests(ticketId);
      const totalAttributes = await storage.getTotalAttributesForTicket(ticketId);
      
      res.json({
        ...ticket,
        user,
        attributeRequests,
        totalAttributes
      });
    } catch (error) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({ message: "Failed to fetch ticket" });
    }
  });

  // Get player attribute stats
  app.get("/api/players/stats", async (req, res) => {
    try {
      const userId = req.query.userId as string | undefined;
      const stats = await storage.getPlayerAttributeStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching player stats:", error);
      res.status(500).json({ message: "Failed to fetch player stats" });
    }
  });
  
  // Get training sessions
  app.get("/api/training-sessions", async (req, res) => {
    try {
      // Tüm kullanıcıları al
      const stats = await storage.getPlayerAttributeStats();
      
      // Her kullanıcı için antrenman oturumlarını al
      const usersWithSessions = await Promise.all(
        stats.map(async (stat) => {
          const trainingSessions = await storage.getTrainingSessions(stat.user.userId);
          
          // Sadece gerçek antrenman türünde olan oturumları filtrele (ticket kaynaklı olanları tamamen hariç tut)
          const filteredSessions = trainingSessions.filter(session => 
            session.source === 'message' || session.source === 'training'
          );
          
          return {
            user: stat.user,
            sessions: filteredSessions
          };
        })
      );
      
      res.json(usersWithSessions);
    } catch (error) {
      console.error("Error fetching training sessions:", error);
      res.status(500).json({ message: "Failed to fetch training sessions" });
    }
  });
  
  // Get player training stats (sadece antrenman kaynaklı nitelikler)
  app.get("/api/players/training-stats", async (req, res) => {
    try {
      const userId = req.query.userId as string | undefined;
      const trainingStats = await storage.getPlayerTrainingStats(userId);
      res.json(trainingStats);
    } catch (error) {
      console.error("Error fetching player training stats:", error);
      res.status(500).json({ message: "Failed to fetch player training stats" });
    }
  });

  // Update attribute request approval status
  app.patch("/api/attribute-requests/:requestId", async (req, res) => {
    try {
      const { requestId } = req.params;
      const requestIdNum = parseInt(requestId, 10);
      
      if (isNaN(requestIdNum)) {
        return res.status(400).json({ message: "Invalid request ID" });
      }
      
      const updated = await storage.approveAttributeRequest(requestIdNum);
      res.json(updated);
    } catch (error) {
      console.error("Error updating attribute request:", error);
      res.status(500).json({ message: "Failed to update attribute request" });
    }
  });

  // Reset all attributes (fixreset)
  app.post("/api/fix/reset", async (req, res) => {
    try {
      // Burada "1" değerini guildId olarak kullanıyoruz, çünkü web uygulamasında sadece bir sunucu var
      await storage.resetAllAttributes("1");
      res.json({ success: true, message: "Tüm nitelikler sıfırlandı" });
    } catch (error) {
      console.error("Error resetting attributes:", error);
      res.status(500).json({ success: false, message: "Nitelikler sıfırlanırken bir hata oluştu" });
    }
  });

  // Update server config
  app.post("/api/config", async (req, res) => {
    try {
      const configSchema = z.object({
        guildId: z.string(),
        fixLogChannelId: z.string().optional(),
        trainingChannelId: z.string().optional()
      });
      
      const { guildId, fixLogChannelId, trainingChannelId } = configSchema.parse(req.body);
      
      let config;
      if (fixLogChannelId) {
        config = await storage.updateFixLogChannel(guildId, fixLogChannelId);
      }
      
      if (trainingChannelId) {
        config = await storage.updateTrainingChannel(guildId, trainingChannelId);
      }
      
      if (!config) {
        config = await storage.getServerConfig(guildId);
        if (!config) {
          config = await storage.setServerConfig({ guildId, fixLogChannelId: null, trainingChannelId: null });
        }
      }
      
      res.json(config);
    } catch (error) {
      console.error("Error updating server config:", error);
      res.status(500).json({ message: "Failed to update server config" });
    }
  });

  // Uptime için ping endpoint'i
  app.get("/ping", (req, res) => {
    res.status(200).send("Bot ve web panel çalışıyor!");
  });
  
  // UptimeRobot için ek endpoint
  app.get("/uptime-check", (req, res) => {
    res.status(200).send("UptimeRobot servisi tarafından kontrol edildi");
  });

  // Günlük ticket istatistikleri
  app.get("/api/tickets/stats/daily", async (req, res) => {
    try {
      const tickets = await storage.getAllTickets();
      
      // Son 24 saatteki ticketları filtrele
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // Ticket durumlarına göre sayıları hesapla
      const openCount = tickets.filter(t => t.status === 'open' && new Date(t.createdAt) > yesterday).length;
      const closedCount = tickets.filter(t => t.status === 'closed' && new Date(t.closedAt || t.createdAt) > yesterday).length;
      const pendingCount = tickets.filter(t => t.status === 'pending' && new Date(t.createdAt) > yesterday).length;
      const totalCount = tickets.filter(t => new Date(t.createdAt) > yesterday).length;
      
      // Grafik için uygun format
      const data = [
        { name: "Açık", label: "Açık Ticketlar", value: openCount },
        { name: "Kapalı", label: "Kapatılan Ticketlar", value: closedCount },
        { name: "Bekleyen", label: "Bekleyen Ticketlar", value: pendingCount },
        { name: "Toplam", label: "Toplam Aktivite", value: totalCount }
      ];
      
      res.json(data);
    } catch (error) {
      console.error("Günlük ticket istatistikleri alınırken hata:", error);
      res.status(500).json({ error: "İstatistikler yüklenirken bir hata oluştu" });
    }
  });

  // Haftalık nitelik istatistikleri
  app.get("/api/players/stats/weekly", async (req, res) => {
    try {
      const playerStats = await storage.getPlayerAttributeStats();
      
      if (!playerStats || playerStats.length === 0) {
        return res.json([
          { name: "Veri Yok", label: "Veri Bulunamadı", value: 0 }
        ]);
      }
      
      // Haftalık toplam nitelik puanları
      const totalWeekly = playerStats.reduce((sum, player) => sum + player.weeklyValue, 0);
      
      // En yüksek nitelik puanına sahip oyuncular (ilk 5)
      const topPlayers = [...playerStats]
        .sort((a, b) => b.weeklyValue - a.weeklyValue)
        .slice(0, 5);
      
      const data = topPlayers.map(player => ({
        name: player.user.username,
        label: player.user.username,
        value: player.weeklyValue
      }));
      
      res.json(data);
    } catch (error) {
      console.error("Haftalık nitelik istatistikleri alınırken hata:", error);
      res.status(500).json({ error: "İstatistikler yüklenirken bir hata oluştu" });
    }
  });

  // Yetkili Leaderboard - Ticket kapatma istatistikleri
  app.get("/api/staff/leaderboard", async (req, res) => {
    try {
      console.log("Yetkili sıralama isteği alındı");
      
      // Ticket kapatma istatistiklerini al (veritabanındaki hataları da logla)
      const checkQuery = await pool.query(`
        SELECT * FROM tickets 
        WHERE status = 'closed' 
        ORDER BY closed_at DESC 
        LIMIT 10
      `);
      
      console.log("Son 10 kapatılan ticket kontrol:", JSON.stringify(checkQuery.rows));
      
      // Ticket kapatma istatistiklerini al
      const { rows } = await pool.query(`
        SELECT 
          closed_by as staff_id,
          COUNT(*) as closed_count
        FROM 
          tickets
        WHERE 
          status = 'closed' 
          AND closed_by IS NOT NULL
          AND closed_by != ''
        GROUP BY 
          closed_by
        ORDER BY 
          closed_count DESC
      `);
      
      console.log("Veritabanından gelen sonuçlar:", JSON.stringify(rows));
      
      // Kullanıcı bilgilerini al
      const staffStats = await Promise.all(
        rows.map(async (row) => {
          const user = await storage.getUserById(row.staff_id);
          console.log(`Kullanıcı bilgisi alındı: ${row.staff_id}`, user);
          return {
            user: user || { userId: row.staff_id, username: "Bilinmeyen Yetkili" },
            closedCount: parseInt(row.closed_count)
          };
        })
      );
      
      console.log("İşlenmiş yetkili istatistikleri:", JSON.stringify(staffStats));
      res.json(staffStats);
    } catch (error) {
      console.error("Yetkili leaderboard alınırken hata:", error);
      res.status(500).json({ error: "Leaderboard yüklenirken bir hata oluştu" });
    }
  });

  // Admin authentication endpoint
  app.post("/api/admin/login", async (req, res) => {
    try {
      const loginSchema = z.object({
        username: z.string(),
        password: z.string().min(6)
      });
      
      const { username, password } = loginSchema.parse(req.body);
      
      // Username and password validation
      const admin = await storage.getAdminByUsername(username);
      
      if (!admin) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Hash the received password and compare
      const passwordHash = createHash('sha256').update(password).digest('hex');
      
      if (admin.passwordHash !== passwordHash) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Update last login
      await storage.updateAdminLastLogin(admin.id);
      
      // Send back admin info (except passwordHash)
      const { passwordHash: _ph, ...safeAdminData } = admin;
      
      // Store admin info in session
      const session = (req as any).session;
      if (session) {
        session.admin = safeAdminData;
      }
      
      res.json({
        success: true,
        admin: safeAdminData
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });
  
  // Admin logout
  app.post("/api/admin/logout", (req, res) => {
    const session = (req as any).session;
    if (session) {
      session.destroy((err: any) => {
        if (err) {
          console.error("Logout error:", err);
          return res.status(500).json({ message: "Logout failed" });
        }
        res.json({ message: "Logged out successfully" });
      });
    } else {
      res.json({ message: "Logged out successfully" });
    }
  });
  
  // Admin profile update endpoint
  app.put("/api/admin/profile", async (req, res) => {
    try {
      // Check if user is authenticated
      const session = (req as any).session;
      if (!session || !session.admin) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const admin = session.admin;
      
      const profileSchema = z.object({
        displayName: z.string().min(3)
      });
      
      const { displayName } = profileSchema.parse(req.body);
      
      // Admin bilgilerini güncelle
      const updatedAdmin = await storage.updateAdmin({
        id: admin.id,
        displayName
      });
      
      // Güncellenen admin bilgilerini sessiona kaydet
      const { passwordHash: _ph, ...safeAdminData } = updatedAdmin;
      session.admin = safeAdminData;
      
      res.json({ 
        success: true, 
        admin: safeAdminData 
      });
    } catch (error) {
      console.error("Error updating admin profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });
  
  // Chat messages endpoint
  app.get("/api/chat/messages", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const messages = await storage.getChatMessages(limit);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });
  
  // Post new chat message
  app.post("/api/chat/messages", async (req, res) => {
    try {
      // Check if user is authenticated
      const session = (req as any).session;
      if (!session || !session.admin) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const admin = session.admin;
      
      const messageSchema = z.object({
        content: z.string().min(1)
      });
      
      const { content } = messageSchema.parse(req.body);
      
      // İsimi çıkar - mesaj şablonu "(mesaj) [isim]" şeklinde
      let displayName = "Admin";
      let actualContent = content;
      
      const nameMatch = content.match(/^(.*?)\s*\[(.*?)\]$/);
      if (nameMatch && nameMatch.length >= 3) {
        actualContent = nameMatch[1].trim();
        displayName = nameMatch[2].trim();
        
        // Kullanıcı adı güncelleme isteği
        if (displayName && displayName.length >= 3) {
          await storage.updateAdmin({
            id: admin.id,
            displayName
          });
        }
      }
      
      const newMessage = await storage.createChatMessage({
        adminId: admin.id,
        content: actualContent
      });
      
      // Fetch complete message with admin info
      const messages = await storage.getChatMessages(1);
      const fullMessage = messages.find(m => m.id === newMessage.id);
      
      res.json(fullMessage);
    } catch (error) {
      console.error("Error creating chat message:", error);
      res.status(500).json({ message: "Failed to create chat message" });
    }
  });
  
  // Create initial admin user if none exists
  // This will run once at startup
  (async () => {
    try {
      // Check if there's already an admin
      const existingAdmin = await storage.getAdminByUsername('admin');
      
      if (!existingAdmin) {
        const DEFAULT_PASSWORD = 'horno1234';
        const passwordHash = createHash('sha256').update(DEFAULT_PASSWORD).digest('hex');
        
        // Create default admin
        await storage.createAdmin({
          username: 'admin',
          passwordHash,
          displayName: 'Admin',
          role: 'admin'
        });
        
        console.log('Default admin account created with username "admin" and password "horno1234"');
      }
    } catch (error) {
      console.error('Error creating initial admin account:', error);
    }
  })();

  return httpServer;
}

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { initDiscordBot } from "./discord";
import { startUptimeService } from "./uptime";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Ping endpoint for uptime
  app.get('/ping', (req, res) => {
    res.status(200).send('Pong!');
  });

  // Initialize Discord bot
  await initDiscordBot();
  
  // Start uptime service
  startUptimeService();

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
      const tickets = await storage.getTickets();
      
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
      const playerStats = await storage.getPlayerStats();
      
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

  return httpServer;
}

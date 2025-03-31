import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { initDiscordBot } from "./discord";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Initialize Discord bot
  await initDiscordBot();

  // Get active tickets
  app.get("/api/tickets", async (req, res) => {
    try {
      const tickets = await storage.getOpenTickets();
      
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

  return httpServer;
}

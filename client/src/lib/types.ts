export interface User {
  id: number;
  userId: string;
  username: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Attribute {
  id: number;
  userId: string;
  name: string;
  value: number;
  weeklyValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttributeRequest {
  id: number;
  ticketId: string;
  attributeName: string;
  valueRequested: number;
  approved: boolean;
  createdAt: string;
}

export interface Ticket {
  id: number;
  ticketId: string;
  userId: string;
  status: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  user?: User;
  attributeRequests?: AttributeRequest[];
  totalAttributes?: number;
}

export interface TrainingSession {
  id: number;
  userId: string;
  ticketId: string | null;
  duration: number;
  attributesGained: number;
  createdAt: string;
}

export interface PlayerStats {
  user: User;
  totalValue: number;
  weeklyValue: number;
  lastFixDate: Date | null;
  attributes: Attribute[];
}

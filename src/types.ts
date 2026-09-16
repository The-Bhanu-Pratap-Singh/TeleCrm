export type Role = 'Admin' | 'Telecaller' | 'Technician' | 'Social Media Manager';

export interface User {
  id: number;
  username: string;
  role: Role;
  assignedCount?: number;
  pendingCount?: number;
}

// Changing LeadStatus to string to allow dynamic stages
export type LeadStatus = string;

export interface PipelineStage {
  id: number;
  name: string;
  orderIndex: number;
}

export interface Note {
  text: string;
  timestamp: string;
  author: string;
}

export interface Lead {
  id: number;
  clientName: string;
  contact: string;
  address?: string;
  assignedUserId?: number;
  assignedUserName?: string;
  priority?: string;
  email?: string;
  tags?: string[];
  requiredProduct?: string;
  quantity?: string;
  price?: string;
  notes: Note[];
  nextFollowUp?: string;
  visitSchedule?: string;
  installationSchedule?: string;
  actualInstallDate?: string;
  status: LeadStatus;
  pendingTechId?: number;
  techAssignmentStatus?: 'Pending' | 'Accepted' | 'Declined';
  techAssignedAt?: string;
  createdAt: string;
}

export interface ActivityLog {
  id: number;
  action: string;
  details: string;
  createdAt: string;
  username: string;
  leadName: string;
}

export interface Attendance {
  id: number;
  userId: number;
  date: string;
  punchIn: string;
  punchOut?: string;
  notes?: string;
  username?: string; // joined
}

export interface Task {
  id: number;
  userId: number;
  date: string;
  text: string;
  completed: boolean;
}

export interface WhatsappMessage {
  id: number;
  leadId: number;
  sender: 'user' | 'lead';
  message: string;
  timestamp: string;
}

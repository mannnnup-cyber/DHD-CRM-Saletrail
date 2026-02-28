export type CallType = 'Incoming' | 'Outgoing' | 'Missed' | 'WhatsApp';
export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Dead';
export type DealStage = 'New Lead' | 'Consultation' | 'Quote Sent' | 'Design Review' | 'In Production' | 'Delivered' | 'Lost';
export type UserRole = 'manager' | 'rep';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  username?: string;
}

export interface Contact {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  address?: string;
  category?: string;
  description?: string;
  source?: string;
  assignedTo: string;
  createdAt: string;
}

export interface Lead extends Contact {
  status: LeadStatus;
}

export interface Call {
  id: string;
  contactId: string;
  type: CallType;
  duration: number;
  timestamp: string;
  repId: string;
  notes?: string;
  recordingUrl?: string;
}

export interface Deal {
  id: string;
  contactId: string;
  name: string;
  value: number;
  stage: DealStage;
  repId: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
}

export interface Task {
  id: string;
  contactId: string;
  title: string;
  dueDate: string;
  completed: boolean;
  repId: string;
  priority: 'low' | 'medium' | 'high';
}

export interface Activity {
  id: string;
  contactId: string;
  type: string;
  description: string;
  timestamp: string;
  userId: string;
}

export interface Quote {
  id: string;
  dealId: string;
  items: QuoteItem[];
  total: number;
  gct: number;
  grandTotal: number;
  status: 'Draft' | 'Sent' | 'Approved' | 'Declined';
  createdAt: string;
  repId: string;
}

export interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  price: number;
}

export interface Holiday {
  date: string;
  name: string;
}

export interface AppSettings {
  simAutoLogging: boolean;
  twoSidedRecording: boolean;
  whatsAppDetection: boolean;
  holidayBlocking: boolean;
  notifications: boolean;
  companyName: string;
  currency: string;
  gctRate: number;
  dailyCallTarget: number;
  googleSheetId?: string;
  googleScriptUrl?: string;
}

export interface AppState {
  user: User | null;
  leads: Lead[];
  calls: Call[];
  deals: Deal[];
  tasks: Task[];
  quotes: Quote[];
  activities: Activity[];
  settings: AppSettings;
  notifications: any[];
}

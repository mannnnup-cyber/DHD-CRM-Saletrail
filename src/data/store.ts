import { User, Lead, Call, Deal, Task, Quote, Activity, AppSettings } from './types';

export const TEAM_MEMBERS: User[] = [
  { id: '1', name: 'Andre Manager', email: 'andre@dirtyhanddesigns.com', role: 'manager', username: 'manager' },
  { id: '2', name: 'Keisha Green', email: 'keisha@dirtyhanddesigns.com', role: 'rep', username: 'keisha' },
  { id: '3', name: 'Marcia Brown', email: 'marcia@dirtyhanddesigns.com', role: 'rep', username: 'marcia' },
  { id: '4', name: 'Devon Smith', email: 'devon@dirtyhanddesigns.com', role: 'rep', username: 'devon' },
  { id: '5', name: 'Tanya White', email: 'tanya@dirtyhanddesigns.com', role: 'rep', username: 'tanya' },
  { id: '6', name: 'Ricardo James', email: 'ricardo@dirtyhanddesigns.com', role: 'rep', username: 'ricardo' },
];

export const INITIAL_SETTINGS: AppSettings = {
  simAutoLogging: true,
  twoSidedRecording: true,
  whatsAppDetection: true,
  holidayBlocking: true,
  notifications: true,
  companyName: 'Dirty Hand Designs',
  currency: 'JMD',
  gctRate: 15,
  dailyCallTarget: 40,
};

export const generateId = () => Math.random().toString(36).substring(2, 9);

export const generateMockData = () => {
  const leads: Lead[] = [
    {
      id: '1',
      name: 'Michael Chen',
      company: 'Blue Mountain Coffee Co',
      phone: '+1 876 555 1234',
      email: 'm.chen@bluemountain.jm',
      status: 'Qualified',
      category: 'Logo Design',
      assignedTo: '2',
      createdAt: new Date().toISOString(),
      source: 'WooCommerce'
    },
    // ... add more mock leads
  ];

  const calls: Call[] = [
    {
      id: '1',
      contactId: '1',
      type: 'Outgoing',
      duration: 145,
      timestamp: new Date().toISOString(),
      repId: '2'
    }
  ];

  const deals: Deal[] = [
    {
      id: '1',
      contactId: '1',
      name: 'Logo Redesign Project',
      value: 85000,
      stage: 'Quote Sent',
      repId: '2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const tasks: Task[] = [
    {
      id: '1',
      contactId: '1',
      title: 'Follow up on logo proposal',
      dueDate: new Date().toISOString(),
      completed: false,
      repId: '2',
      priority: 'high'
    }
  ];

  return { leads, calls, deals, tasks, quotes: [], activities: [] };
};

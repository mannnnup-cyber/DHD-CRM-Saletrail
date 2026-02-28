import { Holiday } from './types';

export const GCT_RATE = 0.15;

export const JAMAICA_HOLIDAYS: Holiday[] = [
  { date: '2025-01-01', name: "New Year's Day" },
  { date: '2025-03-05', name: 'Ash Wednesday' },
  { date: '2025-04-18', name: 'Good Friday' },
  { date: '2025-04-21', name: 'Easter Monday' },
  { date: '2025-05-23', name: 'Labour Day' },
  { date: '2025-08-01', name: 'Emancipation Day' },
  { date: '2025-08-06', name: 'Independence Day' },
  { date: '2025-10-20', name: 'National Heroes Day' },
  { date: '2025-12-25', name: 'Christmas Day' },
  { date: '2025-12-26', name: 'Boxing Day' },
];

export const isHoliday = (date: Date): Holiday | undefined => {
  const dateString = date.toISOString().split('T')[0];
  return JAMAICA_HOLIDAYS.find(h => h.date === dateString);
};

export const calculatePreTax = (total: number): number => {
  return total / (1 + GCT_RATE);
};

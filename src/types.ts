
export type TicketStatus = 'waiting' | 'calling' | 'serving' | 'completed' | 'no-show';
export type UserRole = 'kiosk' | 'display' | 'advisor' | 'admin';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  prefix: string;
  color: string;
  subCategories?: SubCategory[];
}

export interface SubCategory {
  id: string;
  name: string;
}

export interface Counter {
  id: number;
  name: string;
  currentTicketId?: string;
  status: 'idle' | 'busy' | 'away';
}

export interface Ticket {
  id: string;
  displayId: string;
  categoryId: string;
  subCategoryId?: string;
  customerDocument?: string;
  status: TicketStatus;
  createdAt: number;
  calledAt?: number;
  startedAt?: number;
  completedAt?: number;
  counterId?: number;
}

export interface AppState {
  categories: Category[];
  counters: Counter[];
  tickets: Ticket[];
  nextTicketNumber: Record<string, number>;
}

export interface Contact {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    companyId?: string;
    position?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}
export interface Company {
    id: string;
    name: string;
    industry?: string;
    website?: string;
    address?: string;
    phone?: string;
    size?: 'small' | 'medium' | 'large' | 'enterprise';
    createdAt: string;
    updatedAt: string;
}
export interface Deal {
    id: string;
    title: string;
    value: number;
    currency: string;
    stage: DealStage;
    contactId?: string;
    companyId?: string;
    probability?: number;
    expectedCloseDate?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}
export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
export interface Activity {
    id: string;
    type: 'call' | 'email' | 'meeting' | 'note' | 'task';
    subject: string;
    description?: string;
    contactId?: string;
    dealId?: string;
    companyId?: string;
    dueDate?: string;
    completed: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface PaginationQuery {
    page?: number;
    limit?: number;
    search?: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
//# sourceMappingURL=index.d.ts.map
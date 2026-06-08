import { api } from '@/lib/api';

export interface CampaignContact {
  phone: string;
  name?: string;
}

export interface CreateCampaignRequest {
  name: string;
  config: Record<string, any>;
  contacts: CampaignContact[];
  scheduledAt?: string;
}

export interface CampaignResponse {
  id: string;
  userId: string;
  name: string;
  status: string;
  totalContacts: number;
  sentCount: number;
  successCount: number;
  failedCount: number;
  repliedCount: number;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  config: any;
  createdAt: string;
  updatedAt: string;
  messages?: any[];
  _count?: { messages: number };
}

export const campaignService = {
  async list(): Promise<CampaignResponse[]> {
    const { data } = await api.get('/campaigns');
    return data;
  },

  async getById(id: string): Promise<CampaignResponse> {
    const { data } = await api.get(`/campaigns/${id}`);
    return data;
  },

  async create(req: CreateCampaignRequest): Promise<CampaignResponse> {
    const { data } = await api.post('/campaigns', req);
    return data;
  },

  async pause(id: string): Promise<CampaignResponse> {
    const { data } = await api.post(`/campaigns/${id}/pause`);
    return data;
  },

  async resume(id: string): Promise<CampaignResponse> {
    const { data } = await api.post(`/campaigns/${id}/resume`);
    return data;
  },

  async cancel(id: string): Promise<CampaignResponse> {
    const { data } = await api.post(`/campaigns/${id}/cancel`);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/campaigns/${id}`);
  },
};

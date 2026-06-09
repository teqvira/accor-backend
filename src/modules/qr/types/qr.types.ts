export interface CreateBatchInput {
  name: string;
  totalQrs: number;
  campaignId: string;
}

export interface AssignCampaignInput {
  campaignId: string;
}

const BASE_URL = process.env.REACT_APP_JAMIE_API_URL || 'http://localhost:4111';

export interface OnDemandRunRequest {
  message: string;
  parameters?: Record<string, any>;
  episodes: Array<{
    guid: string;
    feedGuid: string;
    feedId: number;
  }>;
}

export interface OnDemandRunResponse {
  success: boolean;
  jobId: string;
  totalEpisodes: number;
  totalFeeds: number;
  message: string;
  awsResponse?: any;
}

export interface OnDemandJobStatus {
  success: boolean;
  jobId: string;
  status: 'pending' | 'complete' | 'failed';
  stats: {
    totalEpisodes: number;
    totalFeeds: number;
    episodesProcessed: number;
    episodesSkipped: number;
    episodesFailed: number;
  };
  episodes: Array<{
    guid: string;
    feedGuid: string;
    feedId: number;
    status: string;
  }>;
  startedAt: string;
  completedAt: string | null;
}

class TryJamieService {
  static async submitOnDemandRun(request: OnDemandRunRequest): Promise<OnDemandRunResponse> {
    const res = await fetch(`${BASE_URL}/api/on-demand/submitOnDemandRun`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error('Failed to submit on-demand run');
    return res.json();
  }

  static async getOnDemandJobStatus(jobId: string): Promise<OnDemandJobStatus> {
    const res = await fetch(`${BASE_URL}/api/on-demand/getOnDemandJobStatus/${jobId}`);
    if (!res.ok) throw new Error('Failed to get job status');
    return res.json();
  }
}

export default TryJamieService; 
import axios from 'axios';

import { ADMIN_API_PASSWORD, ADMIN_API_USER, buildAdminApiBaseUrl } from '@/src/config/admin';

export interface AdminConfigStatus {
  dry_run: boolean;
  live_ready: boolean;
  live_blockers: string[];
  container_status: string;
  last_restart_at?: string | null;
  message?: string;
}

export interface ToggleDryRunResponse {
  dry_run: boolean;
  reloaded: boolean;
  container_status: string;
  last_restart_at?: string | null;
  message: string;
}

const createClient = (serverUrl: string) =>
  axios.create({
    baseURL: buildAdminApiBaseUrl(serverUrl),
    timeout: 20000,
    auth: {
      username: ADMIN_API_USER,
      password: ADMIN_API_PASSWORD,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });

export const getAdminConfigStatus = async (serverUrl: string): Promise<AdminConfigStatus> => {
  const client = createClient(serverUrl);
  const { data } = await client.get<AdminConfigStatus>('/config');
  return data;
};

export const toggleAdminDryRun = async (
  serverUrl: string,
  dryRun: boolean,
): Promise<ToggleDryRunResponse> => {
  const client = createClient(serverUrl);
  const { data } = await client.post<ToggleDryRunResponse>('/dry-run', {
    dry_run: dryRun,
  });
  return data;
};

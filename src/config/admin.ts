import Constants from 'expo-constants';

type ExpoExtra = {
  adminApiUser?: string;
  adminApiPassword?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;

export const ADMIN_API_USER = extra.adminApiUser ?? 'freqtrade-admin';
export const ADMIN_API_PASSWORD = extra.adminApiPassword ?? 'FtAdmin_2026_N!shiki';

export const buildAdminApiBaseUrl = (serverUrl: string) => {
  try {
    const url = new URL(serverUrl);
    return `${url.origin}/admin/freqtrade`;
  } catch {
    return `${serverUrl.replace(/\/+$/, '')}/admin/freqtrade`;
  }
};

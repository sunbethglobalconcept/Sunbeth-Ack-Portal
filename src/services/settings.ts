import { apiGet } from './api';

export type UiSettings = Record<string, any>;

export const getUiSettings = async (): Promise<UiSettings> => {
  try {
    return await apiGet('/api/ui/settings');
  } catch {
    return {};
  }
};

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CaseStorageAdapter } from '@/lib/case-persistence';

/**
 * AsyncStorage-backed case adapter. Mirrors the local preference pattern used by
 * hint persistence — storage failures must never interrupt surveying.
 */
export function createAsyncStorageCaseAdapter(): CaseStorageAdapter {
  return {
    async get(key) {
      try {
        return await AsyncStorage.getItem(key);
      } catch {
        return null;
      }
    },
    async set(key, value) {
      try {
        await AsyncStorage.setItem(key, value);
      } catch {
        // Preference write failures must never interrupt surveying.
      }
    },
    async remove(key) {
      try {
        await AsyncStorage.removeItem(key);
      } catch {
        // Preference write failures must never interrupt surveying.
      }
    },
  };
}

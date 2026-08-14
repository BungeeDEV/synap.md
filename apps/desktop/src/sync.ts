export interface SyncPayload {
  file: string;
  content: string;
  senderId: string;
}

export const syncChannel = new BroadcastChannel('note-sync');

export const myWindowId = crypto.randomUUID();

/** 
 * Debounce utility to prevent flooding the channel when typing fast.
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

// types/expo-file-system-augment.d.ts
declare module 'expo-file-system' {
  export const documentDirectory: string | null;
  export const cacheDirectory: string | null;

  export type FileInfo = {
    exists: boolean;
    isDirectory: boolean;
    uri: string;
    size?: number;
    modificationTime?: number;
    md5?: string;
  };

  export function getInfoAsync(
    uri: string,
    options?: { md5?: boolean; size?: boolean }
  ): Promise<FileInfo>;

  export function readDirectoryAsync(uri: string): Promise<string[]>;

  export function deleteAsync(
    uri: string,
    options?: { idempotent?: boolean }
  ): Promise<void>;
}
import { Platform, PermissionsAndroid } from 'react-native';

/**
 * Ask for storage/media permission when needed (Android < 13).
 * Android 13+ and iOS use the system document picker / share sheet (no extra grant).
 */
export async function ensureReadPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const version =
    typeof Platform.Version === 'number'
      ? Platform.Version
      : parseInt(String(Platform.Version), 10);

  // API 33+ uses the system picker / app-specific storage — no broad storage permission.
  if (version >= 33) return true;

  try {
    const existing = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
    );
    if (existing) return true;

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        title: 'Allow file access',
        message:
          'BookReader needs permission to import and open PDF books from your device.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    // If the permission API fails, still attempt the system picker.
    return true;
  }
}

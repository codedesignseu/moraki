import { File } from 'expo-file-system';

/**
 * Deletes a file the app wrote for the share sheet (an export, a PDF report),
 * so no copy of health data is left in the cache once it has been handed on.
 *
 * Deleting is cleanup: a failure here must not hide the share's outcome.
 */
export function removeQuietly(file: File | string): void {
  try {
    const target = typeof file === 'string' ? new File(file) : file;
    if (target.exists) target.delete();
  } catch {
    // Nothing to report: the OS clears the cache directory in time anyway.
  }
}

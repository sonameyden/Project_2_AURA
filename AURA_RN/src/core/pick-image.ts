import * as ImagePicker from 'expo-image-picker';

import { appendUploadFile, type SelectedUpload } from './native-upload';

/**
 * Opens the photo library and returns the chosen image as multipart form data
 * under `field`, or null if the user cancelled.
 */
export async function pickImageForm(
  field: string,
  { aspect = [1, 1], fallbackName = 'image.jpg' }: { aspect?: [number, number]; fallbackName?: string } = {},
): Promise<FormData | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.85,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  const file: SelectedUpload = {
    uri: asset.uri,
    name: asset.fileName ?? fallbackName,
    mimeType: asset.mimeType ?? 'image/jpeg',
    size: asset.fileSize,
  };
  const form = new FormData();
  appendUploadFile(form, field, file);
  return form;
}

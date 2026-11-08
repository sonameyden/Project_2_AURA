import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { appendUploadFile, type SelectedUpload } from './native-upload';

/**
 * Longest side, in pixels, that each kind of image is shrunk to before upload.
 * Phone cameras take 12–200 MP photos; even cropped, those are often over the
 * backend's 5 MB (profile photos) or 10 MB (artwork) limits, and much larger
 * than anything the app displays.
 */
export const IMAGE_MAX_SIZE = { avatar: 1024, artwork: 1600 } as const;

const JPEG_QUALITY = 0.82;

type PickOptions = {
  /** Crop aspect ratio; square by default. */
  aspect?: [number, number];
  /** Filename to use when the picker doesn't give one. */
  fallbackName?: string;
  /** Longest side after resizing (see IMAGE_MAX_SIZE). */
  maxSize?: number;
};

/** Replaces any extension with .jpg, since images are re-encoded as JPEG. */
const asJpegName = (name: string) => `${name.replace(/\.[^./]+$/, '') || 'image'}.jpg`;

/**
 * Shrinks a picked image to fit `maxSize` and re-encodes it as JPEG. The image
 * is downsampled while decoding, so huge photos never load into memory in full.
 * Falls back to the original file if resizing isn't possible.
 */
export async function prepareImageForUpload(
  asset: Pick<ImagePicker.ImagePickerAsset, 'uri' | 'fileName' | 'mimeType' | 'fileSize'>,
  fallbackName: string,
  maxSize: number,
): Promise<SelectedUpload> {
  const name = asset.fileName ?? fallbackName;
  try {
    const context = ImageManipulator.manipulate(asset.uri, { maxWidth: maxSize, maxHeight: maxSize });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
    context.release();
    rendered.release();
    return { uri: saved.uri, name: asJpegName(name), mimeType: 'image/jpeg' };
  } catch (error) {
    console.warn('Could not resize the image; uploading the original.', error);
    return { uri: asset.uri, name, mimeType: asset.mimeType ?? 'image/jpeg', size: asset.fileSize };
  }
}

/** Opens the photo library, crops, and returns the chosen image ready to upload (null if cancelled). */
export async function pickImageUpload({
  aspect = [1, 1],
  fallbackName = 'image.jpg',
  maxSize = IMAGE_MAX_SIZE.artwork,
}: PickOptions = {}): Promise<SelectedUpload | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    // Full quality here: the image is compressed once, after resizing.
    quality: 1,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  return prepareImageForUpload(asset, fallbackName, maxSize);
}

/**
 * Opens the photo library and returns the chosen image as multipart form data
 * under `field`, or null if the user cancelled.
 */
export async function pickImageForm(field: string, options: PickOptions = {}): Promise<FormData | null> {
  const file = await pickImageUpload(options);
  if (!file) return null;
  const form = new FormData();
  appendUploadFile(form, field, file);
  return form;
}

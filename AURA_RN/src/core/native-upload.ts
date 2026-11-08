export type SelectedUpload = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

/** React Native's multipart file part: the native networking layer reads the file from `uri`. */
type NativeUploadPart = {
  uri: string;
  name: string;
  type: string;
};

/**
 * Adds a picked file to a multipart upload. The form must be sent with
 * `request(..., { formData })`, which uses React Native's XMLHttpRequest:
 * Expo's `fetch` can't send `uri` parts (see `core/api/client.ts`).
 */
export function appendUploadFile(form: FormData, field: string, file: SelectedUpload) {
  const part: NativeUploadPart = { uri: file.uri, name: file.name, type: file.mimeType };
  (form as FormData & { append(name: string, value: NativeUploadPart): void }).append(field, part);
}

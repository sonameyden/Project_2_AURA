export type SelectedUpload = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

type NativeUploadBody = {
  uri: string;
  name: string;
  type: string;
};

export function appendUploadFile(form: FormData, field: string, file: SelectedUpload) {
  const nativeForm = form as FormData & {
    append(name: string, value: NativeUploadBody): void;
  };
  nativeForm.append(field, { uri: file.uri, name: file.name, type: file.mimeType });
}

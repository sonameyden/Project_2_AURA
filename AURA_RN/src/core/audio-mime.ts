/** Audio MIME type from the file extension, for when the picker doesn't give a usable one. */
export function audioMime(name: string) {
  const extension = name.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'wav':
      return 'audio/wav';
    case 'flac':
      return 'audio/flac';
    case 'm4a':
    case 'mp4':
      return 'audio/mp4';
    case 'aac':
      return 'audio/aac';
    case 'ogg':
    case 'oga':
      return 'audio/ogg';
    case 'opus':
      return 'audio/opus';
    case 'webm':
      return 'audio/webm';
    default:
      return 'audio/mpeg';
  }
}

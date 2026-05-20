export async function urlToBase64(
  url: string,
  mimeType?: string
): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentType = mimeType || response.headers.get('content-type') || 'application/octet-stream';
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('[mediaHandler] Error converting URL to base64:', error);
    throw error;
  }
}

export async function urlToBase64WithRetry(
  url: string,
  mimeType?: string,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<string> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await urlToBase64(url, mimeType);
    } catch (error) {
      lastError = error as Error;
      console.warn(`[mediaHandler] Attempt ${i + 1} failed:`, error);
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (i + 1)));
      }
    }
  }
  
  throw lastError || new Error('Failed to convert URL to base64 after retries');
}

export function getMimeTypeFromUrl(url: string): string {
  const extension = url.split('.').pop()?.split('?')[0]?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
    'opus': 'audio/opus',
    'wav': 'audio/wav',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'zip': 'application/zip',
  };
  
  return extension ? mimeTypes[extension] || 'application/octet-stream' : 'application/octet-stream';
}

export async function downloadMediaAsBase64(url: string): Promise<string> {
  const detectedMime = getMimeTypeFromUrl(url);
  return urlToBase64WithRetry(url, detectedMime);
}
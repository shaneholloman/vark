// Universal compression utilities for URL-based content storage
// Supports both browser CompressionStream and Node.js zlib

export type PreviewMode = 'edit' | 'live' | 'view'

export interface ContentData {
  content: string
  mode: PreviewMode
}

const isTerminal = typeof window === 'undefined'

// Unicode-safe base64 encoding with compression for URL
export const encodeContent = async (text: string, mode: PreviewMode = 'edit'): Promise<string> => {
  if (!text && mode === 'edit') return ''
  
  try {
    // Create an object with both content and mode
    const data: ContentData = { content: text, mode }
    const jsonString = JSON.stringify(data)
    
    if (isTerminal) {
      // Node.js environment - use zlib
      const zlib = await import('zlib')
      const compressed = zlib.gzipSync(Buffer.from(jsonString, 'utf-8'))
      return compressed.toString('base64')
    } else {
      // Browser environment - use CompressionStream
      // First encode to UTF-8 bytes
      const utf8Bytes = new TextEncoder().encode(jsonString)
      
      // Compress using gzip
      const compressionStream = new CompressionStream('gzip')
      const compressedStream = new Response(utf8Bytes).body?.pipeThrough(compressionStream)
      const compressedBytes = new Uint8Array(await new Response(compressedStream).arrayBuffer())
      
      // Convert to base64
      const binaryString = Array.from(compressedBytes, byte => String.fromCharCode(byte)).join('')
      return btoa(binaryString)
    }
  } catch (error) {
    console.error('Content encoding failed:', error)
    return '' // Return empty if encoding fails
  }
}

// Unicode-safe base64 decoding with decompression from URL
export const decodeContent = async (encoded: string): Promise<ContentData> => {
  if (!encoded) return { content: '', mode: 'edit' }
  
  try {
    if (isTerminal) {
      // Node.js environment - use zlib
      const zlib = await import('zlib')
      const compressed = Buffer.from(encoded, 'base64')
      const decompressed = zlib.gunzipSync(compressed)
      const jsonString = decompressed.toString('utf-8')
      
      return parseContentData(jsonString)
    } else {
      // Browser environment - use DecompressionStream
      // First decode from base64
      const binaryString = atob(encoded)
      const compressedBytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        compressedBytes[i] = binaryString.charCodeAt(i)
      }
      
      // Decompress using gzip
      const decompressionStream = new DecompressionStream('gzip')
      const decompressedStream = new Response(compressedBytes).body?.pipeThrough(decompressionStream)
      const decompressedBytes = new Uint8Array(await new Response(decompressedStream).arrayBuffer())
      
      // Decode from UTF-8
      const jsonString = new TextDecoder().decode(decompressedBytes)
      
      return parseContentData(jsonString)
    }
  } catch (error) {
    console.error('Content decoding failed:', error)
    return { content: '', mode: 'edit' } // Return empty if decoding fails
  }
}

// Parse content data with fallback for legacy formats
function parseContentData(jsonString: string): ContentData {
  try {
    // Try to parse as JSON (new format with mode)
    const data = JSON.parse(jsonString)
    if (typeof data === 'object' && data !== null && 'content' in data) {
      return {
        content: data.content || '',
        mode: data.mode || 'edit'
      }
    }
  } catch {
    // If JSON parsing fails, treat as legacy format (plain text)
    return { content: jsonString, mode: 'edit' }
  }
  
  // Fallback for legacy format
  return { content: jsonString, mode: 'edit' }
}
// OpenAI Whisper provider implementation

import OpenAI from 'openai'
import type { TranscriptionProvider, AudioData, ProviderConfig } from './types'

export class OpenAIProvider implements TranscriptionProvider {
  name = 'openai'
  displayName = 'OpenAI Whisper'

  async transcribe(audio: AudioData, config: ProviderConfig): Promise<string> {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required')
    }

    const openai = new OpenAI({ 
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: typeof window !== 'undefined'
    })
    
    const audioFile = this.createAudioFile(audio.blob, audio.format)
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "text",
    })

    return transcription
  }

  async validateConfig(config: ProviderConfig): Promise<boolean | 'restricted'> {
    if (!config.apiKey || config.apiKey.length < 51) {
      return false
    }

    try {
      const openai = new OpenAI({ 
        apiKey: config.apiKey,
        dangerouslyAllowBrowser: typeof window !== 'undefined'
      })
      
      // Test the API key with a minimal request
      await openai.models.list()
      return true
    } catch {
      return false
    }
  }

  getSupportedFormats(): string[] {
    return [
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg'
    ]
  }

  private createAudioFile(audioBlob: Blob | Buffer, format: string): File {
    const extension = this.getFileExtension(format)
    const filename = `recording.${extension}`
    
    if (audioBlob instanceof Blob) {
      return new File([audioBlob], filename, { type: format })
    } else {
      // Handle Buffer for Node.js environment
      const blob = new Blob([audioBlob], { type: format })
      return new File([blob], filename, { type: format })
    }
  }

  private getFileExtension(mimeType: string): string {
    const typeMap: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/mp4': 'mp4',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg'
    }
    
    // Check for exact match first
    if (typeMap[mimeType]) {
      return typeMap[mimeType]
    }
    
    // Check for partial matches (e.g., "audio/webm;codecs=opus")
    for (const [type, ext] of Object.entries(typeMap)) {
      if (mimeType.includes(type)) {
        return ext
      }
    }
    
    // Default fallback
    return 'webm'
  }
}
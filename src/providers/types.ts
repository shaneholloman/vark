// Provider-specific types for transcription services

export interface ProviderConfig {
  apiKey: string
  [key: string]: any // Provider-specific options
}

export interface AudioData {
  blob: Blob | Buffer
  format: string
}

export interface TranscriptionProvider {
  name: string
  displayName: string
  transcribe(audio: AudioData, config: ProviderConfig): Promise<string>
  validateConfig(config: ProviderConfig): Promise<boolean | 'restricted'>
  getSupportedFormats(): string[]
}

export type ProviderType = 'openai' | 'google'

export interface ProviderInfo {
  type: ProviderType
  displayName: string
  description: string
  configFields: ConfigField[]
}

export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'password' | 'select'
  required: boolean
  placeholder?: string
  options?: { value: string; label: string }[]
}
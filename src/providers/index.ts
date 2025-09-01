// Provider factory and registry

import type { TranscriptionProvider, ProviderType, ProviderInfo } from './types'

// Dynamic imports to avoid loading providers that aren't used
export const createProvider = async (type: ProviderType): Promise<TranscriptionProvider> => {
  switch (type) {
    case 'openai': {
      const { OpenAIProvider } = await import('./openai')
      return new OpenAIProvider()
    }
    case 'google': {
      const { GoogleProvider } = await import('./google')
      return new GoogleProvider()
    }
    default:
      throw new Error(`Unknown provider: ${type}`)
  }
}

// Registry of available providers
export const availableProviders: Record<ProviderType, ProviderInfo> = {
  openai: {
    type: 'openai',
    displayName: 'OpenAI',
    description: 'High-accuracy speech recognition using OpenAI\'s Whisper model',
    configFields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'sk-...'
      }
    ]
  },
  google: {
    type: 'google',
    displayName: 'Google',
    description: 'Fast and accurate speech recognition from Google Cloud',
    configFields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'Your Google Cloud API Key'
      }
    ]
  }
}

// Export types
export type { TranscriptionProvider, ProviderType, ProviderInfo, ProviderConfig, AudioData } from './types'
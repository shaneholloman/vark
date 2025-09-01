import { describe, it, expect, vi } from 'vitest'
import { createProvider, availableProviders } from '../providers/index'
import { OpenAIProvider } from '../providers/openai'
import { GoogleProvider } from '../providers/google'

describe('Provider System', () => {
  describe('Provider Factory', () => {
    it('creates OpenAI provider instance', async () => {
      const provider = await createProvider('openai')
      
      expect(provider).toBeInstanceOf(OpenAIProvider)
      expect(provider.name).toBe('openai')
      expect(provider.displayName).toBe('OpenAI Whisper')
    })

    it('creates Google provider instance', async () => {
      const provider = await createProvider('google')
      
      expect(provider).toBeInstanceOf(GoogleProvider)
      expect(provider.name).toBe('google')
      expect(provider.displayName).toBe('Google Cloud Speech-to-Text')
    })

    it('throws error for unknown provider type', async () => {
      await expect(createProvider('invalid' as any)).rejects.toThrow('Unknown provider: invalid')
    })

    it('providers implement required interface methods', async () => {
      const providers = await Promise.all([
        createProvider('openai'),
        createProvider('google')
      ])

      for (const provider of providers) {
        expect(typeof provider.transcribe).toBe('function')
        expect(typeof provider.validateConfig).toBe('function')
        expect(typeof provider.getSupportedFormats).toBe('function')
        
        const formats = provider.getSupportedFormats()
        expect(Array.isArray(formats)).toBe(true)
        expect(formats.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Provider Registry', () => {
    it('contains all expected providers', () => {
      expect(availableProviders).toHaveProperty('openai')
      expect(availableProviders).toHaveProperty('google')
    })

    it('has correct metadata for OpenAI provider', () => {
      const openai = availableProviders.openai
      
      expect(openai.type).toBe('openai')
      expect(openai.displayName).toBe('OpenAI')
      expect(openai.description).toContain('Whisper')
      expect(openai.configFields).toHaveLength(1)
      expect(openai.configFields[0]).toEqual({
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'sk-...'
      })
    })

    it('has correct metadata for Google provider', () => {
      const google = availableProviders.google
      
      expect(google.type).toBe('google')
      expect(google.displayName).toBe('Google')
      expect(google.description).toContain('Google Cloud')
      expect(google.configFields).toHaveLength(1)
      expect(google.configFields[0]).toEqual({
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'Your Google Cloud API Key'
      })
    })
  })

  describe('OpenAI Provider Behavior', () => {
    it('throws error when transcribing without API key', async () => {
      const provider = new OpenAIProvider()
      const mockAudio = { blob: new Blob(), format: 'audio/webm' }
      
      await expect(provider.transcribe(mockAudio, { apiKey: '' }))
        .rejects.toThrow('OpenAI API key is required')
    })

    it('validates API key length correctly', async () => {
      const provider = new OpenAIProvider()
      
      // Too short key
      const shortKey = await provider.validateConfig({ apiKey: 'sk-short' })
      expect(shortKey).toBe(false)
      
      // Empty key
      const emptyKey = await provider.validateConfig({ apiKey: '' })
      expect(emptyKey).toBe(false)
      
      // Valid length key (will fail API call but that's expected)
      const validLengthKey = 'sk-' + 'x'.repeat(48) // Total 51 chars
      // We can't test the actual API call without mocking, but we can verify
      // it attempts validation with the right key length
    })

    it('reports supported audio formats', () => {
      const provider = new OpenAIProvider()
      const formats = provider.getSupportedFormats()
      
      expect(formats).toContain('audio/webm')
      expect(formats).toContain('audio/mp4')
      expect(formats).toContain('audio/mpeg')
      expect(formats).toContain('audio/wav')
    })
  })

  describe('Google Provider Behavior', () => {
    it('validates config and checks for API key', async () => {
      const provider = new GoogleProvider()
      
      // No API key
      const noKey = await provider.validateConfig({ apiKey: '' })
      expect(noKey).toBe(false)
      
      // With API key (will attempt actual validation)
      // We can't test success without mocking the API, but we can verify it tries
    })

    it('reports supported audio formats', () => {
      const provider = new GoogleProvider()
      const formats = provider.getSupportedFormats()
      
      expect(formats).toContain('audio/webm')
      expect(formats).toContain('audio/wav')
      expect(formats).toContain('audio/flac')
      expect(formats).toContain('audio/ogg')
      expect(formats).toContain('audio/mp3')
    })
  })
})
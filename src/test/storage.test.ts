import { describe, it, expect, beforeEach } from 'vitest'
import { UniversalStorage } from '../shared/storage'
import type { ProviderConfig } from '../providers/types'

describe('UniversalStorage (with localStorage mock)', () => {
  let storage: UniversalStorage
  
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    storage = new UniversalStorage()
  })

  describe('Basic operations', () => {
    it('stores and retrieves provider config', () => {
      const config: ProviderConfig = { apiKey: 'test-key-123', extra: 'data' }
      
      storage.setProviderConfig('openai', config)
      const retrieved = storage.getProviderConfig('openai')
      
      expect(retrieved).toEqual(config)
    })

    it('returns null for non-existent config', () => {
      const result = storage.getProviderConfig('google')
      expect(result).toBeNull()
    })

    it('removes provider config', () => {
      const config: ProviderConfig = { apiKey: 'test-key' }
      
      storage.setProviderConfig('openai', config)
      expect(storage.getProviderConfig('openai')).toEqual(config)
      
      storage.removeProviderConfig('openai')
      expect(storage.getProviderConfig('openai')).toBeNull()
    })

    it('handles multiple providers independently', () => {
      const openaiConfig: ProviderConfig = { apiKey: 'openai-key' }
      const googleConfig: ProviderConfig = { apiKey: 'google-key' }
      
      storage.setProviderConfig('openai', openaiConfig)
      storage.setProviderConfig('google', googleConfig)
      
      expect(storage.getProviderConfig('openai')).toEqual(openaiConfig)
      expect(storage.getProviderConfig('google')).toEqual(googleConfig)
      
      storage.removeProviderConfig('openai')
      expect(storage.getProviderConfig('openai')).toBeNull()
      expect(storage.getProviderConfig('google')).toEqual(googleConfig)
    })
  })

  describe('Error handling', () => {
    it('handles corrupted JSON in localStorage gracefully', () => {
      // Directly set invalid JSON in localStorage
      localStorage.setItem('vark-provider-openai', 'not-json{')
      
      const result = storage.getProviderConfig('openai')
      expect(result).toBeNull()
    })

    it('handles localStorage.getItem returning null', () => {
      const result = storage.getProviderConfig('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('getConfiguredProviders', () => {
    it('returns empty array when no providers configured', () => {
      const providers = storage.getConfiguredProviders()
      expect(providers).toEqual([])
    })

    it('returns list of configured provider types', () => {
      storage.setProviderConfig('openai', { apiKey: 'key1' })
      storage.setProviderConfig('google', { apiKey: 'key2' })
      
      const providers = storage.getConfiguredProviders()
      expect(providers).toContain('openai')
      expect(providers).toContain('google')
      expect(providers).toHaveLength(2)
    })

    it('only returns vark-provider prefixed keys', () => {
      // Set some non-provider keys
      localStorage.setItem('other-key', 'value')
      localStorage.setItem('vark-other', 'value')
      
      storage.setProviderConfig('openai', { apiKey: 'key1' })
      
      const providers = storage.getConfiguredProviders()
      expect(providers).toEqual(['openai'])
    })
  })

  describe('Storage key format', () => {
    it('uses correct key prefix', () => {
      storage.setProviderConfig('openai', { apiKey: 'test' })
      
      // Check localStorage directly
      const storedValue = localStorage.getItem('vark-provider-openai')
      expect(storedValue).toBeTruthy()
      
      const parsed = JSON.parse(storedValue!)
      expect(parsed.apiKey).toBe('test')
    })

    it('maintains backward compatibility with existing keys', () => {
      // Simulate old data in localStorage
      const oldConfig = { apiKey: 'old-key', someOldField: 'value' }
      localStorage.setItem('vark-provider-openai', JSON.stringify(oldConfig))
      
      const retrieved = storage.getProviderConfig('openai')
      expect(retrieved).toEqual(oldConfig)
    })
  })

  describe('Data persistence', () => {
    it('persists data across multiple storage instances', () => {
      const storage1 = new UniversalStorage()
      storage1.setProviderConfig('openai', { apiKey: 'persistent-key' })
      
      const storage2 = new UniversalStorage()
      const retrieved = storage2.getProviderConfig('openai')
      
      expect(retrieved).toEqual({ apiKey: 'persistent-key' })
    })

    it('updates overwrite previous values', () => {
      storage.setProviderConfig('openai', { apiKey: 'first-key' })
      storage.setProviderConfig('openai', { apiKey: 'second-key', newField: 'new' })
      
      const retrieved = storage.getProviderConfig('openai')
      expect(retrieved).toEqual({ apiKey: 'second-key', newField: 'new' })
      expect(retrieved?.apiKey).not.toBe('first-key')
    })
  })

  // Note: CLI/file-based storage methods are not tested here
  // as they are placeholders that just log warnings
})
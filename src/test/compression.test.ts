import { describe, it, expect } from 'vitest'
import { encodeContent, decodeContent } from '../shared/compression'
import type { PreviewMode } from '../shared/types'

describe('Compression (Real Node.js Implementation)', () => {
  describe('encodeContent', () => {
    it('returns empty string for empty content in edit mode', async () => {
      const result = await encodeContent('', 'edit')
      expect(result).toBe('')
    })

    it('encodes content with mode for non-empty strings', async () => {
      const result = await encodeContent('test', 'edit')
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
      // It should be base64
      expect(() => Buffer.from(result, 'base64')).not.toThrow()
    })

    it('always encodes when mode is not edit, even for empty content', async () => {
      const result = await encodeContent('', 'live')
      expect(result).toBeTruthy()
      expect(result).not.toBe('')
    })
  })

  describe('decodeContent', () => {
    it('returns default empty state for empty input', async () => {
      const result = await decodeContent('')
      expect(result).toEqual({ content: '', mode: 'edit' })
    })

    it('handles malformed base64 gracefully', async () => {
      const result = await decodeContent('not-valid-base64!')
      expect(result).toEqual({ content: '', mode: 'edit' })
    })

    it('handles corrupted gzip data gracefully', async () => {
      // Valid base64 but not valid gzip
      const result = await decodeContent('dGVzdA==') // just "test" in base64, not gzipped
      expect(result).toEqual({ content: '', mode: 'edit' })
    })
  })

  describe('Round-trip encoding/decoding', () => {
    it('preserves content and mode through encode/decode cycle', async () => {
      const testCases: Array<{ content: string; mode: PreviewMode }> = [
        { content: 'Hello, world!', mode: 'edit' },
        { content: 'Multi\nline\ntext', mode: 'live' },
        { content: '# Markdown Title\n\nWith **bold** text', mode: 'view' },
        { content: 'Unicode: 你好世界 🌍', mode: 'edit' },
        { content: 'Special chars: <>&"\'', mode: 'live' }
      ]

      for (const { content, mode } of testCases) {
        const encoded = await encodeContent(content, mode)
        const decoded = await decodeContent(encoded)
        
        expect(decoded.content).toBe(content)
        expect(decoded.mode).toBe(mode)
      }
    })

    it('handles large content', async () => {
      const largeContent = 'x'.repeat(10000)
      const encoded = await encodeContent(largeContent, 'edit')
      const decoded = await decodeContent(encoded)
      
      expect(decoded.content).toBe(largeContent)
      expect(decoded.mode).toBe('edit')
      
      // Compression should actually compress repetitive content
      expect(encoded.length).toBeLessThan(largeContent.length)
    })

    it('preserves empty content with non-edit modes', async () => {
      const encoded = await encodeContent('', 'view')
      const decoded = await decodeContent(encoded)
      
      expect(decoded.content).toBe('')
      expect(decoded.mode).toBe('view')
    })
  })

  describe('Compression effectiveness', () => {
    it('actually compresses repetitive content', async () => {
      const repetitive = 'abc'.repeat(1000)
      const encoded = await encodeContent(repetitive, 'edit')
      
      // Base64 expands by ~33%, but gzip should compress way more than that
      expect(encoded.length).toBeLessThan(repetitive.length / 2)
    })

    it('handles incompressible random-like content', async () => {
      // Create pseudo-random content
      let random = ''
      for (let i = 0; i < 1000; i++) {
        random += String.fromCharCode(33 + (i * 7) % 94)
      }
      
      const encoded = await encodeContent(random, 'edit')
      const decoded = await decodeContent(encoded)
      
      expect(decoded.content).toBe(random)
    })
  })

  describe('parseContentData fallback behavior', () => {
    // We can't directly test parseContentData, but we can test the fallback behavior
    // by manually creating base64-encoded gzipped data in different formats
    
    it('handles legacy plain text format', async () => {
      const zlib = await import('zlib')
      // Create gzipped plain text (not JSON)
      const plainText = 'Legacy content without JSON wrapper'
      const compressed = zlib.gzipSync(Buffer.from(plainText, 'utf-8'))
      const encoded = compressed.toString('base64')
      
      const decoded = await decodeContent(encoded)
      expect(decoded.content).toBe(plainText)
      expect(decoded.mode).toBe('edit') // Should default to edit
    })

    it('handles new JSON format', async () => {
      const zlib = await import('zlib')
      const data = { content: 'Modern format', mode: 'live' }
      const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(data), 'utf-8'))
      const encoded = compressed.toString('base64')
      
      const decoded = await decodeContent(encoded)
      expect(decoded.content).toBe('Modern format')
      expect(decoded.mode).toBe('live')
    })
  })
})
import { describe, it, expect } from 'vitest'
import { cn } from '../lib/utils'

describe('cn utility function', () => {
  it('combines multiple class names', () => {
    expect(cn('class1', 'class2', 'class3')).toBe('class1 class2 class3')
  })

  it('handles conditional classes', () => {
    const isActive = true
    const isDisabled = false
    
    expect(cn(
      'base',
      isActive && 'active',
      isDisabled && 'disabled'
    )).toBe('base active')
  })

  it('handles empty inputs gracefully', () => {
    expect(cn()).toBe('')
    expect(cn('')).toBe('')
    expect(cn(undefined)).toBe('')
    expect(cn(null)).toBe('')
    expect(cn(false)).toBe('')
  })

  it('merges Tailwind conflicts correctly', () => {
    // twMerge should handle conflicting Tailwind classes
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
    expect(cn('p-2', 'px-4')).toBe('p-2 px-4') // These don't conflict
  })

  it('handles arrays and objects', () => {
    expect(cn(['class1', 'class2'])).toBe('class1 class2')
    expect(cn({ active: true, disabled: false })).toBe('active')
  })

  it('preserves non-conflicting classes', () => {
    expect(cn('text-lg font-bold', 'text-red-500')).toBe('text-lg font-bold text-red-500')
  })

  it('handles complex real-world scenarios', () => {
    const baseClasses = 'rounded-md border px-3 py-2'
    const stateClasses = {
      'bg-blue-500 text-white': true,
      'opacity-50 cursor-not-allowed': false
    }
    const additionalClasses = ['hover:bg-blue-600', 'transition-colors']
    
    const result = cn(baseClasses, stateClasses, additionalClasses)
    expect(result).toContain('rounded-md')
    expect(result).toContain('bg-blue-500')
    expect(result).toContain('hover:bg-blue-600')
    expect(result).not.toContain('opacity-50')
  })
})
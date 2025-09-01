import '@testing-library/jest-dom'
import { beforeEach } from 'vitest'

// Minimal setup - only mock what absolutely doesn't exist in Node.js

// localStorage mock for storage tests - but we'll be explicit about it being a mock
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] || null
  }
})()

global.localStorage = localStorageMock as Storage

beforeEach(() => {
  localStorageMock.clear()
})
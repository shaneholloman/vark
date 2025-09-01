// Shared types for the application

export type PreviewMode = 'edit' | 'live' | 'view'

export interface ContentData {
  content: string
  mode: PreviewMode
}

export interface RecorderProps {
  onTranscription?: (text: string) => void
  onRecordingStart?: () => void
}

// Environment detection
export const isTerminal = typeof window === 'undefined'
export const isBrowser = !isTerminal
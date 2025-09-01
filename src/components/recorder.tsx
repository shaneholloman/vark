import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import OpenAI from 'openai'

interface RecorderProps {
  onTranscription?: (text: string) => void
  onRecordingStart?: () => void
}

// OpenAI API keys can be different lengths:
// - Legacy keys: 51 characters (sk-...)
// - Project keys: ~164 characters (sk-proj-...)
const MIN_OPENAI_API_KEY_LENGTH = 51
const MAX_OPENAI_API_KEY_LENGTH = 200 // Generous upper bound
const STORAGE_KEY = 'vark-openai-api-key'

export default function Recorder({ onTranscription, onRecordingStart }: RecorderProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [keyStatus, setKeyStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle')
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [recordingToastId, setRecordingToastId] = useState<string | number | null>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Validate API key when it reaches a valid length
  const validateApiKey = useCallback(async (key: string) => {
    if (key.length < MIN_OPENAI_API_KEY_LENGTH || key.length > MAX_OPENAI_API_KEY_LENGTH) return

    setKeyStatus('validating')
    try {
      const openai = new OpenAI({ 
        apiKey: key,
        dangerouslyAllowBrowser: true // For client-side usage
      })
      
      // Test the API key with a minimal request
      await openai.models.list()
      setKeyStatus('valid')
      // Save the valid key to localStorage
      localStorage.setItem(STORAGE_KEY, key)
    } catch (error) {
      console.error('API key validation failed:', error)
      setKeyStatus('invalid')
      // Remove invalid key from localStorage
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem(STORAGE_KEY)
    if (savedKey) {
      setApiKey(savedKey)
      // Validate the saved key
      if (savedKey.length >= MIN_OPENAI_API_KEY_LENGTH && savedKey.length <= MAX_OPENAI_API_KEY_LENGTH) {
        // Set status to validating immediately to prevent premature "enter key" message
        setKeyStatus('validating')
        validateApiKey(savedKey)
      }
    }
  }, [validateApiKey])

  // Handle API key input change
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setApiKey(value)
    
    if (value.length === 0) {
      setKeyStatus('idle')
      // Clear key from localStorage when empty
      localStorage.removeItem(STORAGE_KEY)
    } else if (value.length >= MIN_OPENAI_API_KEY_LENGTH && value.startsWith('sk-')) {
      validateApiKey(value)
    } else {
      setKeyStatus('idle')
    }
  }

  // Handle click outside to collapse
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false)
      }
    }

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isExpanded])

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsExpanded(false)
    }
  }

  // Handle global keyboard shortcut for Cmd+Enter
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        
        // Store the currently focused element before handling microphone
        const activeElement = document.activeElement
        
        handleMicrophoneClick()
        
        // If the focus was in the editor, restore it after a brief delay
        if (activeElement && (
          activeElement.classList.contains('w-md-editor-text') ||
          activeElement.closest('.w-md-editor')
        )) {
          setTimeout(() => {
            const textarea = document.querySelector('.w-md-editor-text') as HTMLTextAreaElement
            if (textarea) {
              textarea.focus()
            }
          }, 100)
        }
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [keyStatus, isTranscribing, isRecording, mediaRecorder])

  // Get supported audio format for the platform
  const getSupportedMimeType = () => {
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg'
    ]
    
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType
      }
    }
    
    // Fallback - let the browser choose
    return undefined
  }

  // Start recording
  const startRecording = async () => {
    try {
      // Call the parent callback to trigger save before recording
      if (onRecordingStart) {
        onRecordingStart()
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Get the best supported audio format
      const mimeType = getSupportedMimeType()
      const options = mimeType ? { mimeType } : undefined
      
      console.log('Using audio format:', mimeType || 'browser default')
      
      const recorder = new MediaRecorder(stream, options)
      const chunks: BlobPart[] = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      recorder.onstop = async () => {
        // Create blob with the actual type used by the recorder
        const actualMimeType = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunks, { type: actualMimeType })
        
        console.log('Recording blob type:', actualMimeType, 'size:', blob.size)
        
        // Transcribe audio using OpenAI
        await transcribeAudio(blob)

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      recorder.start()
      setMediaRecorder(recorder)
      setIsRecording(true)
      
      // Show persistent toast notification
      const toastId = toast('Recording audio...', {
        description: 'Click the microphone again to stop and transcribe',
        duration: Infinity, // Keep it visible until manually dismissed
      })
      setRecordingToastId(toastId)
    } catch (error) {
      console.error('Error starting recording:', error)
      toast.error('Microphone access denied', {
        description: 'Could not access microphone. Please check permissions.',
        duration: 4000,
      })
    }
  }

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
      setIsRecording(false)
      setMediaRecorder(null)
      
      // Dismiss the recording toast
      if (recordingToastId) {
        toast.dismiss(recordingToastId)
        setRecordingToastId(null)
      }
      
      // Show transcription toast
      toast('Processing audio...', {
        description: 'Converting speech to text using OpenAI Whisper',
        duration: 2000,
      })
    }
  }

  // Handle microphone button click
  const handleMicrophoneClick = () => {
    if (keyStatus === 'idle' || keyStatus === 'invalid') {
      toast.error('API key required', {
        description: 'Please enter a valid OpenAI API key first.',
        duration: 3000,
      })
      return
    }

    if (keyStatus === 'validating') {
      toast.warning('Key validating', {
        description: 'API key is being validated, please try again in a second...',
        duration: 2000,
      })
      return
    }

    if (keyStatus !== 'valid') {
      toast.error('API key required', {
        description: 'Please enter a valid OpenAI API key first.',
        duration: 3000,
      })
      return
    }

    // Prevent clicking during transcription
    if (isTranscribing) {
      return
    }

    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  // Toggle expansion
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
    if (!isExpanded) {
      // Focus the input when expanding
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const getInputBorderColor = () => {
    switch (keyStatus) {
      case 'valid':
        return '#10B981' // green
      case 'invalid':
        return '#EF4444' // red
      case 'validating':
        return '#F59E0B' // yellow
      default:
        return '#D1D5DB' // gray
    }
  }

  // Handle combined button click
  const handleCombinedButtonClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const buttonWidth = rect.width
    const caretZoneWidth = 32 // Adjusted for the new caret section width

    // If clicked in the caret zone (right area), toggle expansion
    if (clickX > buttonWidth - caretZoneWidth) {
      toggleExpanded()
    } else {
      // Otherwise, handle microphone click
      handleMicrophoneClick()
    }
  }

  // Transcribe audio using OpenAI
  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    if (keyStatus !== 'valid' || !apiKey) {
      console.error('No valid API key available for transcription')
      return
    }

    setIsTranscribing(true)

    try {
      const openai = new OpenAI({ 
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      })

      // Get the file extension based on the blob type
      const getFileExtension = (mimeType: string): string => {
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

      const extension = getFileExtension(audioBlob.type)
      const filename = `recording.${extension}`
      
      console.log('Creating audio file:', filename, 'with type:', audioBlob.type)
      
      const audioFile = new File([audioBlob], filename, { type: audioBlob.type })

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        response_format: "text",
      })

      console.log('Transcription response:', transcription, 'Type:', typeof transcription)

      if (onTranscription && transcription && typeof transcription === 'string' && transcription.trim()) {
        const trimmedTranscription = transcription.trim()
        
        // Use a timeout to ensure the transcription happens after any UI updates
        setTimeout(() => {
          onTranscription(trimmedTranscription)
          
          // Ensure focus is back on the editor after transcription
          const textarea = document.querySelector('.w-md-editor-text') as HTMLTextAreaElement
          if (textarea) {
            textarea.focus()
          }
        }, 50)
      } else {
        console.warn('No valid transcription received:', transcription)
      }

      console.log('Transcription completed:', transcription)
    } catch (error) {
      console.error('Transcription error:', error)
      toast.error('Transcription failed', {
        description: `Error during transcription: ${error}`,
        duration: 4000,
      })
    } finally {
      setIsTranscribing(false)
    }
  }, [apiKey, keyStatus, onTranscription])

  return (
    <div ref={containerRef} className="voice-recorder">
      {isExpanded && (
        <div className="api-key-input-container">
          <input
            ref={inputRef}
            type="text"
            value={apiKey}
            onChange={handleApiKeyChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter OpenAI API Key"
            className="api-key-input"
            style={{
              borderColor: getInputBorderColor(),
              borderWidth: '2px'
            }}
          />
          {keyStatus === 'validating' && (
            <div className="validation-status">Validating...</div>
          )}
        </div>
      )}
      
      <div className="voice-recorder-controls">
        <button
          className={`combined-button ${isRecording ? 'recording' : ''} ${isTranscribing ? 'transcribing' : ''}`}
          onClick={handleCombinedButtonClick}
          disabled={isTranscribing}
          title={
            isTranscribing 
              ? 'Transcribing audio...' 
              : keyStatus !== 'valid' 
                ? 'Please enter a valid API key first' 
                : 'Click microphone to record (or press Ctrl+Enter/Cmd+Enter), click arrow to expand'
          }
        >
          <div className="microphone-section">
            {isTranscribing ? (
              // Transcribing indicator with different spinner
              <div className="transcribing-indicator">
                <div className="transcribing-spinner" />
              </div>
            ) : isRecording ? (
              // Recording indicator with spinner
              <div className="recording-indicator">
                <div className="spinner" />
              </div>
            ) : (
              // Microphone icon
              <Mic size={16} />
            )}
          </div>
          <div className="caret-section">
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </div>
        </button>
      </div>
    </div>
  )
}

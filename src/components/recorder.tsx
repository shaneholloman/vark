import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { createProvider, availableProviders, type ProviderType, type TranscriptionProvider } from '../providers/index'
import { UniversalStorage } from '../shared/storage'
import type { AudioData, ProviderConfig } from '../providers/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RecorderProps {
  onTranscription?: (text: string) => void
  onRecordingStart?: () => void
  theme?: 'light' | 'dark'
}

const storage = new UniversalStorage()

export default function Recorder({ onTranscription, onRecordingStart, theme = 'light' }: RecorderProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>('openai')
  const [providerConfig, setProviderConfig] = useState<ProviderConfig | null>(null)
  const [configStatus, setConfigStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid' | 'restricted'>('idle')
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [recordingToastId, setRecordingToastId] = useState<string | number | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [provider, setProvider] = useState<TranscriptionProvider | null>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Initialize provider on mount or when selection changes
  useEffect(() => {
    const initializeProvider = async () => {
      try {
        const newProvider = await createProvider(selectedProvider)
        setProvider(newProvider)
        
        // Load existing config
        const config = storage.getProviderConfig(selectedProvider)
        if (config) {
          setProviderConfig(config)
          validateProviderConfig(config, newProvider)
        } else {
          setProviderConfig(null)
          setConfigStatus('idle')
        }
      } catch (error) {
        console.error('Failed to initialize provider:', error)
        setProvider(null)
      }
    }
    
    initializeProvider()
  }, [selectedProvider])

  // Validate provider configuration
  const validateProviderConfig = useCallback(async (config: ProviderConfig, providerInstance?: TranscriptionProvider) => {
    if (!config.apiKey) {
      setConfigStatus('idle')
      return
    }

    setConfigStatus('validating')
    try {
      const currentProvider = providerInstance || provider
      if (currentProvider) {
        const validationResult = await currentProvider.validateConfig(config)
        
        if (validationResult === true) {
          setConfigStatus('valid')
          storage.setProviderConfig(selectedProvider, config)
        } else if (validationResult === 'restricted') {
          setConfigStatus('restricted')
          storage.setProviderConfig(selectedProvider, config) // Save the key since it's valid
        } else {
          setConfigStatus('invalid')
          storage.removeProviderConfig(selectedProvider)
        }
      }
    } catch (error) {
      console.error('Config validation failed:', error)
      setConfigStatus('invalid')
      storage.removeProviderConfig(selectedProvider)
    }
  }, [provider, selectedProvider])

  // Load provider config on mount
  useEffect(() => {
    const savedConfig = storage.getProviderConfig(selectedProvider)
    if (savedConfig) {
      setProviderConfig(savedConfig)
    }
  }, [selectedProvider])

  // Handle config input changes
  const handleConfigChange = (key: string, value: string) => {
    if (!showConfig) {
      return
    }
    
    const newConfig: ProviderConfig = { ...providerConfig, [key]: value, apiKey: key === 'apiKey' ? value : (providerConfig?.apiKey || '') }
    setProviderConfig(newConfig)
    
    if (value.length === 0) {
      setConfigStatus('idle')
      storage.removeProviderConfig(selectedProvider)
    } else if (newConfig.apiKey) {
      validateProviderConfig(newConfig)
    }
  }

  // Handle click outside to collapse
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      
      // Check if click is outside container
      if (containerRef.current && !containerRef.current.contains(target)) {
        // Don't close if clicking on Select dropdown content (portaled outside container)
        const isSelectContent = (target as Element)?.closest('[data-radix-select-content]')
        const isSelectViewport = (target as Element)?.closest('[data-radix-select-viewport]')
        const isSelectItem = (target as Element)?.closest('[data-radix-select-item]')
        
        if (!isSelectContent && !isSelectViewport && !isSelectItem) {
          setIsExpanded(false)
        }
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
  }, [configStatus, isTranscribing, isRecording, mediaRecorder])

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
        description: `Converting speech to text using ${provider?.displayName || selectedProvider}`,
        duration: 2000,
      })
    }
  }

  // Handle microphone button click
  const handleMicrophoneClick = () => {
    if (configStatus === 'idle' || configStatus === 'invalid') {
      toast.error('Provider configuration required', {
        description: `Please configure ${availableProviders[selectedProvider].displayName} first.`,
        duration: 3000,
      })
      return
    }

    if (configStatus === 'validating') {
      toast.warning('Validating configuration', {
        description: 'Configuration is being validated, please try again in a moment...',
        duration: 2000,
      })
      return
    }

    if (configStatus !== 'valid' && configStatus !== 'restricted') {
      toast.error('Configuration required', {
        description: `Please configure ${availableProviders[selectedProvider].displayName} first.`,
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

  // Handle provider selection
  const handleProviderChange = (newProvider: ProviderType) => {
    setSelectedProvider(newProvider)
  }

  // Mask sensitive values with dots
  const getMaskedValue = (value: string) => {
    if (!value) return ''
    return '•'.repeat(value.length)
  }

  // Handle input focus - show real values
  const handleInputFocus = () => {
    setShowConfig(true)
  }

  // Handle input blur - hide real values
  const handleInputBlur = () => {
    setShowConfig(false)
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

  // Transcribe audio using selected provider
  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    if ((configStatus !== 'valid' && configStatus !== 'restricted') || !providerConfig || !provider) {
      console.error('No valid provider configuration available for transcription')
      return
    }

    setIsTranscribing(true)

    try {
      const audioData: AudioData = {
        blob: audioBlob,
        format: audioBlob.type
      }

      console.log(`Transcribing with ${provider.displayName}:`, audioData.format, audioBlob.size, 'bytes')
      
      const transcription = await provider.transcribe(audioData, providerConfig)

      console.log('Transcription response:', transcription)

      if (onTranscription && transcription && transcription.trim()) {
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
        description: `Error with ${provider.displayName}: ${error}`,
        duration: 4000,
      })
    } finally {
      setIsTranscribing(false)
    }
  }, [providerConfig, configStatus, provider, onTranscription])

  return (
    <div ref={containerRef} className="relative flex flex-col items-end">
      {isExpanded && (
        <div className={`absolute bottom-full right-4 mb-2 z-50 transform translate-x-1/2 rounded-lg p-3 min-w-72 shadow-lg ${
          theme === 'dark' 
            ? 'bg-zinc-900 border border-zinc-700' 
            : 'bg-white border border-gray-200'
        }`}>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="provider-select">Provider</Label>
              <Select value={selectedProvider} onValueChange={handleProviderChange}>
                <SelectTrigger id="provider-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(availableProviders).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      {info.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {availableProviders[selectedProvider].configFields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  ref={field.key === 'apiKey' ? inputRef : undefined}
                  type={field.type === 'password' ? 'text' : field.type}
                  value={showConfig ? (providerConfig?.[field.key] || '') : getMaskedValue(providerConfig?.[field.key] || '')}
                  onChange={(e) => handleConfigChange(field.key, e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  readOnly={!showConfig}
                  placeholder={field.placeholder}
                  className={`cursor-${showConfig ? 'text' : 'pointer'} ${
                    configStatus === 'valid' ? 'border-green-500 focus-visible:ring-green-500' :
                    configStatus === 'invalid' ? 'border-red-500 focus-visible:ring-red-500' :
                    configStatus === 'validating' ? 'border-orange-500 focus-visible:ring-orange-500' :
                    configStatus === 'restricted' ? 'border-orange-500 focus-visible:ring-orange-500' :
                    'border-blue-500 focus-visible:ring-blue-500'
                  }`}
                />
              </div>
            ))}
            
            {configStatus === 'validating' && (
              <div className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}`}>Validating...</div>
            )}
            {configStatus === 'restricted' && (
              <div className={`text-sm text-orange-400`}>
                API key is valid but restricted. <a 
                  href="https://console.cloud.google.com/apis/credentials" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:text-orange-300"
                >
                  Remove restrictions
                </a> or allow Speech-to-Text API.
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="flex items-center">
        <button
          className={`flex items-center h-8 rounded-md border px-3 overflow-hidden text-xs font-mono font-medium leading-6 box-border transition-all duration-200 outline-none ${
            isTranscribing 
              ? (theme === 'dark' ? 'bg-yellow-900/20 border-yellow-600 text-yellow-300 cursor-not-allowed' : 'bg-yellow-50 border-yellow-400 text-yellow-700 cursor-not-allowed')
              : (theme === 'dark' 
                  ? 'bg-zinc-900 border-zinc-700 text-white hover:bg-blue-900/20 hover:border-blue-600'
                  : 'bg-white border-gray-200 text-gray-800 hover:bg-blue-50 hover:border-blue-500')
          } ${isTranscribing ? 'opacity-70' : ''}`}
          onClick={handleCombinedButtonClick}
          disabled={isTranscribing}
          title={
            isTranscribing 
              ? 'Transcribing audio...' 
              : (configStatus !== 'valid' && configStatus !== 'restricted')
                ? `Please configure ${availableProviders[selectedProvider].displayName} first` 
                : configStatus === 'restricted'
                  ? 'Click microphone to record (API key is valid but restricted)'
                  : 'Click microphone to record (or press Ctrl+Enter/Cmd+Enter), click arrow to expand'
          }
        >
          <div className="flex items-center justify-center pr-1.5 min-w-5">
            {isTranscribing ? (
              <div className="flex items-center justify-center">
                <div className={`w-4 h-4 border-2 border-transparent rounded-full animate-spin ${
                  theme === 'dark' ? 'border-t-yellow-400' : 'border-t-yellow-500'
                }`} />
              </div>
            ) : isRecording ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-transparent border-t-current rounded-full animate-spin" />
              </div>
            ) : (
              <Mic size={16} />
            )}
          </div>
          <div className={`flex items-center justify-center pl-1.5 border-l opacity-60 hover:opacity-100 transition-opacity duration-200 min-w-4 ${
            theme === 'dark' ? 'border-zinc-700' : 'border-gray-200'
          }`}>
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </div>
        </button>
      </div>
    </div>
  )
}

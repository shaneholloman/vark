import { useState, useEffect, useCallback, useRef } from 'react'
import MDEditor from '@uiw/react-md-editor'
import '@uiw/react-md-editor/markdown-editor.css'
import { Edit3, Split, Eye } from 'lucide-react'
import { Toaster } from 'sonner'
import Recorder from './recorder'
import { encodeContent, decodeContent } from '../shared/compression'
import type { PreviewMode } from '../shared/types'

const MAX_URL_LENGTH = 2048 // Safe URL length limit
const SAVE_DELAY = 1000 // 1 second delay after typing stops
const TITLE_PREVIEW_LENGTH = 50 // Number of characters to show in browser tab title
const DESCRIPTION_LENGTH = 160 // SEO-friendly description length

function Editor() {
  const [usagePercentage, setUsagePercentage] = useState(0)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [isLimitReached, setIsLimitReached] = useState(false)
  const [markdownValue, setMarkdownValue] = useState('')
  const [previewMode, setPreviewMode] = useState<PreviewMode>('edit')
  
  // Refs for debouncing and tracking
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasUnsavedChangesRef = useRef(false)
  const lastSavedContentRef = useRef('')
  const currentContentRef = useRef('')
  const lastSavedModeRef = useRef<PreviewMode>('edit')
  const editorControlsRef = useRef<HTMLDivElement>(null)
  const recordingCursorPositionRef = useRef<number>(0)
  const lastKnownCursorPositionRef = useRef<number>(0)

  // Virtual keyboard detection using Visual Viewport API
  useEffect(() => {
    if (!window.visualViewport) return

    const handleViewportChange = () => {
      const viewport = window.visualViewport!
      const windowHeight = window.innerHeight
      const viewportHeight = viewport.height
      
      // Detect if virtual keyboard is likely open
      const heightDifference = windowHeight - viewportHeight
      const isKeyboardOpen = heightDifference > 300
      
      // Only adjust for mobile/touch devices with substantial keyboard presence
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      
      if (editorControlsRef.current && (isMobile || hasTouch)) {
        if (isKeyboardOpen) {
          // Position controls above the keyboard
          const keyboardHeight = heightDifference
          const safeOffset = 12
          editorControlsRef.current.style.bottom = `${keyboardHeight + safeOffset}px`
        } else {
          // Reset to default position
          editorControlsRef.current.style.bottom = '12px'
        }
      }
    }

    // Listen for viewport changes
    window.visualViewport.addEventListener('resize', handleViewportChange)
    window.visualViewport.addEventListener('scroll', handleViewportChange)
    
    // Initial check
    handleViewportChange()

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange)
        window.visualViewport.removeEventListener('scroll', handleViewportChange)
      }
    }
  }, [])

  // Theme detection and theme-color setting
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const updateTheme = (isDark: boolean) => {
      const newTheme = isDark ? 'dark' : 'light'
      setTheme(newTheme)
      
      // Add/remove dark class from document root for Tailwind dark mode
      if (isDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      
      // Update theme-color meta tag immediately
      const themeColor = newTheme === 'dark' ? '#000000' : '#f7f7f7'
      let themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement
      
      if (!themeColorMeta) {
        themeColorMeta = document.createElement('meta')
        themeColorMeta.setAttribute('name', 'theme-color')
        document.head.appendChild(themeColorMeta)
      }
      
      themeColorMeta.setAttribute('content', themeColor)
    }
    
    // Set initial theme and theme-color
    updateTheme(mediaQuery.matches)
    
    const handler = (e: MediaQueryListEvent) => {
      updateTheme(e.matches)
    }
    
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Keyboard shortcut handler for Ctrl+E/Cmd+E to toggle preview mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault()
        setPreviewMode(prev => {
          const newMode = (() => {
            switch (prev) {
              case 'edit':
                return 'live'
              case 'live':
                return 'view'
              case 'view':
                return 'edit'
              default:
                return 'edit'
            }
          })()
          
          // Save immediately when mode changes (will be handled by the effect below)
          return newMode
        })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Utility function to update all page metadata
  const updatePageMetadata = useCallback((content: string) => {
    // Get the first line only for title
    const firstLine = content.split('\n')[0].trim()
    
    // Create clean text without markdown formatting
    const cleanText = firstLine
      .replace(/[#*_`~\[\]]/g, '') // Remove common markdown characters
      .trim()
    
    // Update document title
    if (!cleanText) {
      document.title = 'Vark'
    } else {
      const titlePreview = cleanText.length > TITLE_PREVIEW_LENGTH 
        ? cleanText.substring(0, TITLE_PREVIEW_LENGTH) + '...'
        : cleanText
      document.title = `Vark | ${titlePreview}`
    }
    
    // Create description from content (first few lines, cleaned)
    const contentLines = content.split('\n').slice(0, 3).join(' ').trim()
    const cleanDescription = contentLines
      .replace(/[#*_`~\[\]]/g, '') // Remove markdown formatting
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
    
    const description = cleanDescription 
      ? (cleanDescription.length > DESCRIPTION_LENGTH 
          ? cleanDescription.substring(0, DESCRIPTION_LENGTH) + '...'
          : cleanDescription)
      : 'Minimal markdown editor that lives in your browser\'s URL'
    
    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, property?: string) => {
      const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`
      let metaTag = document.querySelector(selector) as HTMLMetaElement
      
      if (!metaTag) {
        metaTag = document.createElement('meta')
        if (property) {
          metaTag.setAttribute('property', name)
        } else {
          metaTag.setAttribute('name', name)
        }
        document.head.appendChild(metaTag)
      }
      
      metaTag.setAttribute('content', content)
    }
    
    // Basic meta tags
    updateMetaTag('description', description)
    updateMetaTag('author', 'Vark')
    
    // Open Graph tags
    updateMetaTag('og:title', document.title, 'property')
    updateMetaTag('og:description', description, 'property')
    updateMetaTag('og:type', 'website', 'property')
    updateMetaTag('og:url', window.location.href, 'property')
    updateMetaTag('og:site_name', 'Vark', 'property')
    
    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary')
    updateMetaTag('twitter:title', document.title)
    updateMetaTag('twitter:description', description)
    
    // Additional meta tags for better SEO
    updateMetaTag('keywords', 'markdown, editor, notes, writing, text editor, online editor')
    updateMetaTag('robots', 'index, follow')
  }, [])

  // Update browser tab title based on content (keeping for backwards compatibility)
  const updatePageTitle = useCallback((content: string) => {
    updatePageMetadata(content)
  }, [updatePageMetadata])


  // Save content to URL (debounced)
  const saveToUrl = useCallback(async (content: string) => {
    const currentMode = previewMode // Use current preview mode
    const encoded = await encodeContent(content, currentMode)
    const urlLength = encoded.length + 1 // +1 for the # character
    const remaining = MAX_URL_LENGTH - urlLength
    const percentage = Math.round((urlLength / MAX_URL_LENGTH) * 100)
    
    setUsagePercentage(percentage)
    setIsLimitReached(remaining < 0)
    
    if (remaining >= 0) {
      // Update URL hash only if it's different
      if (window.location.hash.slice(1) !== encoded) {
        // Use pushState to add to navigation stack instead of replaceState
        window.history.pushState(null, '', `#${encoded}`)
      }
      lastSavedContentRef.current = content
      lastSavedModeRef.current = currentMode
      hasUnsavedChangesRef.current = false
      
      // Update browser tab title only after successful save
      updatePageTitle(content)
    } else {
      // If over limit, mark as reached but don't save
      setIsLimitReached(true)
    }
  }, [encodeContent, updatePageTitle, previewMode])

  // Save content with specific mode to URL
  const saveToUrlWithMode = useCallback(async (content: string, mode: PreviewMode) => {
    const encoded = await encodeContent(content, mode)
    const urlLength = encoded.length + 1 // +1 for the # character
    const remaining = MAX_URL_LENGTH - urlLength
    const percentage = Math.round((urlLength / MAX_URL_LENGTH) * 100)
    
    setUsagePercentage(percentage)
    setIsLimitReached(remaining < 0)
    
    if (remaining >= 0) {
      // Update URL hash only if it's different
      if (window.location.hash.slice(1) !== encoded) {
        // Use pushState to add to navigation stack instead of replaceState
        window.history.pushState(null, '', `#${encoded}`)
      }
      lastSavedContentRef.current = content
      lastSavedModeRef.current = mode
      hasUnsavedChangesRef.current = false
      
      // Update browser tab title only after successful save
      updatePageTitle(content)
    } else {
      // If over limit, mark as reached but don't save
      setIsLimitReached(true)
    }
  }, [updatePageTitle])

  // Debounced save function
  const debouncedSave = useCallback((content: string) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    console.log('Setting up debounced save for 3 seconds...')
    
    // Set new timeout
    saveTimeoutRef.current = setTimeout(() => {
      console.log('Debounced save triggered, hasUnsavedChanges:', hasUnsavedChangesRef.current)
      if (hasUnsavedChangesRef.current) {
        saveToUrl(content)
      }
    }, SAVE_DELAY)
  }, [saveToUrl])

  // Immediate save function (for blur/mouse events)
  const saveImmediately = useCallback((content?: string) => {
    // Clear any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    
    // Use current content if not provided
    const contentToSave = content ?? currentContentRef.current
    
    if (hasUnsavedChangesRef.current && contentToSave) {
      console.log('Saving immediately:', contentToSave.slice(0, 50) + '...')
      saveToUrl(contentToSave)
    }
  }, [saveToUrl])

  // Load content from URL on mount
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) {
      decodeContent(hash).then(async (decodedData) => {
        if (decodedData.content || decodedData.mode !== 'edit') {
          setMarkdownValue(decodedData.content)
          setPreviewMode(decodedData.mode)
          currentContentRef.current = decodedData.content
          lastSavedContentRef.current = decodedData.content
          lastSavedModeRef.current = decodedData.mode
          
          // Update browser tab title
          updatePageTitle(decodedData.content)
          
          // Calculate and update usage percentage immediately after loading
          const encoded = await encodeContent(decodedData.content, decodedData.mode)
          const urlLength = encoded.length + 1
          const percentage = Math.round((urlLength / MAX_URL_LENGTH) * 100)
          setUsagePercentage(percentage)
          setIsLimitReached(urlLength > MAX_URL_LENGTH)
        }
      })
    } else {
      // Set default title when no content
      updatePageTitle('')
    }
  }, [decodeContent, encodeContent, updatePageTitle])

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash.slice(1)
      if (hash) {
        decodeContent(hash).then(async (decodedData) => {
          if (decodedData.content || decodedData.mode !== 'edit') {
            setMarkdownValue(decodedData.content)
            setPreviewMode(decodedData.mode)
            currentContentRef.current = decodedData.content
            lastSavedContentRef.current = decodedData.content
            lastSavedModeRef.current = decodedData.mode
            hasUnsavedChangesRef.current = false
            
            // Update browser tab title
            updatePageTitle(decodedData.content)
            
            // Calculate and update usage percentage
            const encoded = await encodeContent(decodedData.content, decodedData.mode)
            const urlLength = encoded.length + 1
            const percentage = Math.round((urlLength / MAX_URL_LENGTH) * 100)
            setUsagePercentage(percentage)
            setIsLimitReached(urlLength > MAX_URL_LENGTH)
          }
        })
      } else {
        // If no hash, reset to empty content
        setMarkdownValue('')
        setPreviewMode('edit')
        currentContentRef.current = ''
        lastSavedContentRef.current = ''
        lastSavedModeRef.current = 'edit'
        hasUnsavedChangesRef.current = false
        setUsagePercentage(0)
        setIsLimitReached(false)
        
        // Update browser tab title
        updatePageTitle('')
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [decodeContent, encodeContent, updatePageTitle])

  // Add event listeners for immediate saving, cursor tracking  
  useEffect(() => {
    let hasMouseMoved = false
    
    const updateCursorPosition = (textarea: HTMLTextAreaElement) => {
      if (textarea === document.activeElement) {
        lastKnownCursorPositionRef.current = textarea.selectionStart || 0
        console.log('Updated cursor position:', lastKnownCursorPositionRef.current)
      }
    }
    
    const handleBlur = (e: Event) => {
      const textarea = e.target as HTMLTextAreaElement
      // Capture cursor position before losing focus
      const cursorPos = textarea.selectionStart || 0
      recordingCursorPositionRef.current = cursorPos
      console.log('*** BLUR EVENT FIRED ***')
      console.log('Blur: captured cursor position for recording:', cursorPos)
      console.log('Textarea value length:', textarea.value.length)
      console.log('************************')
      
      if (hasUnsavedChangesRef.current) {
        saveImmediately()
      }
    }
    
    const handleMouseMove = () => {
      if (!hasMouseMoved) {
        hasMouseMoved = true
        if (hasUnsavedChangesRef.current) {
          saveImmediately()
        }
      }
    }
    
    const handleFocus = () => {
      hasMouseMoved = false
    }

    const handleKeyUp = (e: Event) => {
      updateCursorPosition(e.target as HTMLTextAreaElement)
    }

    const handleClick = (e: Event) => {
      updateCursorPosition(e.target as HTMLTextAreaElement)
    }
    
    // Add listeners to the textarea specifically
    const textarea = document.querySelector('.w-md-editor-text') as HTMLTextAreaElement
    if (textarea) {
      textarea.addEventListener('blur', handleBlur)
      textarea.addEventListener('keyup', handleKeyUp)
      textarea.addEventListener('click', handleClick)
    }
    
    // Add mouse move listener to detect user interaction elsewhere
    document.addEventListener('mousemove', handleMouseMove)
    
    // Add focus listener to reset mouse movement tracking
    document.addEventListener('focus', handleFocus, true)
    
    return () => {
      if (textarea) {
        textarea.removeEventListener('blur', handleBlur)
        textarea.removeEventListener('keyup', handleKeyUp)
        textarea.removeEventListener('click', handleClick)
      }
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('focus', handleFocus, true)
    }
  }, [saveImmediately])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Handle content changes with immediate UI update and debounced saving
  const handleContentChange = useCallback(async (value?: string) => {
    const content = value || ''
    
    // Update UI immediately for responsive typing
    setMarkdownValue(content)
    
    // Update current content ref
    currentContentRef.current = content
    
    // Track that we have unsaved changes
    if (content !== lastSavedContentRef.current || previewMode !== lastSavedModeRef.current) {
      hasUnsavedChangesRef.current = true
      console.log('Content changed, setting unsaved flag. New content length:', content.length)
      
      // Update usage percentage immediately for feedback
      const encoded = await encodeContent(content, previewMode)
      const urlLength = encoded.length + 1
      const percentage = Math.round((urlLength / MAX_URL_LENGTH) * 100)
      setUsagePercentage(percentage)
      setIsLimitReached(urlLength > MAX_URL_LENGTH)
      
      // Debounce the actual saving
      debouncedSave(content)
    }
  }, [encodeContent, debouncedSave, previewMode])

  // Map our internal mode to MDEditor's expected preview type
  const getMDEditorPreviewMode = (mode: PreviewMode): 'edit' | 'live' | 'preview' => {
    if (mode === 'view') return 'preview'
    return mode
  }

  // Get icon for current mode
  const getModeIcon = (mode: PreviewMode) => {
    switch (mode) {
      case 'edit':
        return <Edit3 size={14} />
      case 'live':
        return <Split size={14} />
      case 'view':
        return <Eye size={14} />
      default:
        return <Edit3 size={14} />
    }
  }
  const handleTranscription = useCallback((text: string) => {
    // Validate input
    if (!text || typeof text !== 'string') {
      console.warn('Invalid transcription text received:', text)
      return
    }

    // Use the cursor position captured when recording started
    const currentValue = currentContentRef.current || ''
    const cursorPos = recordingCursorPositionRef.current
    
    console.log('=== INSERTION DEBUG ===')
    console.log('Captured cursor position:', cursorPos)
    console.log('Current content length:', currentValue.length)
    console.log('Text around insertion point (20 chars before/after):')
    console.log('Before:', JSON.stringify(currentValue.slice(Math.max(0, cursorPos - 20), cursorPos)))
    console.log('After:', JSON.stringify(currentValue.slice(cursorPos, cursorPos + 20)))

    // Ensure cursor position is within bounds
    const safeCursorPos = Math.min(cursorPos, currentValue.length)
    console.log('Safe cursor position:', safeCursorPos)

    // Insert text at the captured cursor position
    const beforeCursor = currentValue.slice(0, safeCursorPos)
    const afterCursor = currentValue.slice(safeCursorPos)
    
    console.log('Before cursor length:', beforeCursor.length)
    console.log('After cursor length:', afterCursor.length)
    console.log('=======================')
    
    // Add a space before the text if needed (if not at start and previous char isn't whitespace)
    const needsSpaceBefore = beforeCursor.length > 0 && !/\s$/.test(beforeCursor)
    const prefix = needsSpaceBefore ? ' ' : ''
    
    // Add a space after the text if needed (if not at end and next char isn't whitespace)  
    const needsSpaceAfter = afterCursor.length > 0 && !/^\s/.test(afterCursor)
    const suffix = needsSpaceAfter ? ' ' : ''
    
    const newValue = beforeCursor + prefix + text + suffix + afterCursor
    const newCursorPosition = safeCursorPos + prefix.length + text.length + suffix.length

    console.log('New cursor position will be:', newCursorPosition)

    // Update the content
    handleContentChange(newValue)
    
    // Set cursor position after React updates and focus the textarea
    setTimeout(() => {
      const textarea = document.querySelector('.w-md-editor-text') as HTMLTextAreaElement
      if (textarea) {
        textarea.selectionStart = newCursorPosition
        textarea.selectionEnd = newCursorPosition
        textarea.focus()
      }
    }, 10)
  }, [handleContentChange])

  // Function called on mousedown - use the last known cursor position
  const captureCursorPosition = useCallback(() => {
    recordingCursorPositionRef.current = lastKnownCursorPositionRef.current
    console.log('Mousedown on record button - using last known cursor position:', recordingCursorPositionRef.current)
  }, [])

  // Function to trigger immediate save before recording starts  
  const triggerImmediateSave = useCallback(() => {
    saveImmediately()
  }, [saveImmediately])

  // Save immediately when preview mode changes
  useEffect(() => {
    if (previewMode !== lastSavedModeRef.current && currentContentRef.current !== undefined) {
      saveToUrlWithMode(currentContentRef.current, previewMode)
    }
  }, [previewMode, saveToUrlWithMode])

  return (
    <div className={`h-screen w-screen p-2 transition-colors duration-300 box-border ${theme === 'dark' ? 'bg-black text-white' : 'bg-gray-100 text-gray-800'}`} data-color-mode={theme}>
      <div className={`h-full w-full relative rounded-xl overflow-hidden transition-all duration-300 ${theme === 'dark' ? 'bg-zinc-900 shadow-2xl border border-zinc-800' : 'bg-white shadow-xl border border-gray-200'}`}>
        <div className="h-full w-full relative">
          <MDEditor
            value={markdownValue}
            onChange={handleContentChange}
            data-color-mode={theme}
            visibleDragbar={false}
            hideToolbar
            preview={getMDEditorPreviewMode(previewMode)}
          />
        </div>
        <div className="absolute bottom-3 right-3 flex items-center gap-3 z-25 transition-bottom duration-300" ref={editorControlsRef}>
          <Recorder onTranscription={handleTranscription} onRecordingStart={triggerImmediateSave} onCaptureCursor={captureCursorPosition} theme={theme} />
          <div className={`flex items-center h-8 rounded-md border overflow-hidden text-xs font-mono font-medium leading-6 box-border transition-all duration-200 outline-none ${
            isLimitReached 
              ? (theme === 'dark' ? 'text-red-400 bg-red-900/20 border-red-700' : 'text-red-600 bg-red-50 border-red-200')
              : (theme === 'dark' ? 'border-zinc-700 bg-zinc-900 text-white' : 'border-gray-200 bg-white text-gray-800')
          }`}>
            <button 
              className={`flex items-center justify-center gap-1.5 px-3 border-none transition-all duration-200 outline-none h-full box-border cursor-pointer font-mono text-xs font-medium ${
                theme === 'dark' 
                  ? 'border-r border-zinc-700 bg-transparent text-white hover:bg-blue-900/20' 
                  : 'border-r border-gray-200 bg-transparent text-gray-800 hover:bg-blue-50'
              } ${
                isLimitReached 
                  ? (theme === 'dark' ? 'border-r border-red-700' : 'border-r border-red-200')
                  : ''
              }`}
              title="Press Ctrl+E or Cmd+E to cycle through edit modes"
              onClick={() => {
                setPreviewMode(prev => {
                  const newMode = (() => {
                    switch (prev) {
                      case 'edit':
                        return 'live'
                      case 'live':
                        return 'view'
                      case 'view':
                        return 'edit'
                      default:
                        return 'edit'
                    }
                  })()
                  
                  return newMode
                })
              }}
            >
              {getModeIcon(previewMode)}
              {previewMode}
            </button>
            <span className={`flex items-center justify-center px-3 opacity-60 pointer-events-none h-full box-border ${
              theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
            } ${
              isLimitReached 
                ? (theme === 'dark' ? 'opacity-80 text-red-400' : 'opacity-80 text-red-600')
                : ''
            }`}>
              {usagePercentage}% used
            </span>
          </div>
        </div>
      </div>
      <Toaster theme={theme} position="top-center" toastOptions={{ 
        style: { 
          position: 'fixed', 
          top: '50vh', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          zIndex: 9999
        } 
      }} />
    </div>
  )
}

export default Editor

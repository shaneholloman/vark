import { useState, useEffect, useCallback, useRef } from 'react'
import MDEditor from '@uiw/react-md-editor'
import '@uiw/react-md-editor/markdown-editor.css'
import { Edit3, Split, Eye } from 'lucide-react'
import Recorder from './recorder'

const MAX_URL_LENGTH = 2048 // Safe URL length limit
const SAVE_DELAY = 1000 // 1 second delay after typing stops
const TITLE_PREVIEW_LENGTH = 50 // Number of characters to show in browser tab title
const DESCRIPTION_LENGTH = 160 // SEO-friendly description length

function Editor() {
  const [usagePercentage, setUsagePercentage] = useState(0)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [isLimitReached, setIsLimitReached] = useState(false)
  const [markdownValue, setMarkdownValue] = useState('')
  const [previewMode, setPreviewMode] = useState<'edit' | 'live' | 'view'>('edit')
  
  // Refs for debouncing and tracking
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasUnsavedChangesRef = useRef(false)
  const lastSavedContentRef = useRef('')
  const currentContentRef = useRef('')
  const lastSavedModeRef = useRef<'edit' | 'live' | 'view'>('edit')
  const editorControlsRef = useRef<HTMLDivElement>(null)

  // Virtual keyboard detection using Visual Viewport API
  useEffect(() => {
    if (!window.visualViewport) return

    const handleViewportChange = () => {
      const viewport = window.visualViewport!
      const windowHeight = window.innerHeight
      const viewportHeight = viewport.height
      
      // Detect if virtual keyboard is likely open
      // A significant reduction in viewport height indicates keyboard presence
      const heightDifference = windowHeight - viewportHeight
      const isKeyboardOpen = heightDifference > 150 // Threshold for keyboard detection
      
      // Dynamically adjust the position of editor controls
      if (editorControlsRef.current) {
        if (isKeyboardOpen) {
          // Position controls above the keyboard
          const keyboardHeight = heightDifference
          const safeOffset = 12 // Base offset from viewport edge
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

  // Unicode-safe base64 encoding with compression for URL
  const encodeContent = useCallback(async (text: string, mode: 'edit' | 'live' | 'view' = 'edit'): Promise<string> => {
    if (!text && mode === 'edit') return ''
    try {
      // Create an object with both content and mode
      const data = { content: text, mode }
      const jsonString = JSON.stringify(data)
      
      // First encode to UTF-8 bytes
      const utf8Bytes = new TextEncoder().encode(jsonString)
      
      // Compress using gzip
      const compressionStream = new CompressionStream('gzip')
      const compressedStream = new Response(utf8Bytes).body?.pipeThrough(compressionStream)
      const compressedBytes = new Uint8Array(await new Response(compressedStream).arrayBuffer())
      
      // Convert to base64
      const binaryString = Array.from(compressedBytes, byte => String.fromCharCode(byte)).join('')
      return btoa(binaryString)
    } catch {
      return '' // Return empty if encoding fails
    }
  }, [])

  // Unicode-safe base64 decoding with decompression from URL
  const decodeContent = useCallback(async (encoded: string): Promise<{ content: string, mode: 'edit' | 'live' | 'view' }> => {
    if (!encoded) return { content: '', mode: 'edit' }
    try {
      // First decode from base64
      const binaryString = atob(encoded)
      const compressedBytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        compressedBytes[i] = binaryString.charCodeAt(i)
      }
      
      // Decompress using gzip
      const decompressionStream = new DecompressionStream('gzip')
      const decompressedStream = new Response(compressedBytes).body?.pipeThrough(decompressionStream)
      const decompressedBytes = new Uint8Array(await new Response(decompressedStream).arrayBuffer())
      
      // Decode from UTF-8
      const jsonString = new TextDecoder().decode(decompressedBytes)
      
      try {
        // Try to parse as JSON (new format with mode)
        const data = JSON.parse(jsonString)
        if (typeof data === 'object' && data !== null && 'content' in data) {
          return {
            content: data.content || '',
            mode: data.mode || 'edit'
          }
        }
      } catch {
        // If JSON parsing fails, treat as legacy format (plain text)
        return { content: jsonString, mode: 'edit' }
      }
      
      // Fallback for legacy format
      return { content: jsonString, mode: 'edit' }
    } catch {
      return { content: '', mode: 'edit' } // Return empty if decoding fails
    }
  }, [])

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
  const saveToUrlWithMode = useCallback(async (content: string, mode: 'edit' | 'live' | 'view') => {
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
  }, [encodeContent, updatePageTitle])

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

  // Add event listeners for immediate saving on blur and mouse movement
  useEffect(() => {
    let hasMouseMoved = false
    
    const handleBlur = () => {
      console.log('Blur event triggered, hasUnsavedChanges:', hasUnsavedChangesRef.current)
      if (hasUnsavedChangesRef.current) {
        saveImmediately()
      }
    }
    
    const handleMouseMove = () => {
      if (!hasMouseMoved) {
        hasMouseMoved = true
        console.log('Mouse moved, hasUnsavedChanges:', hasUnsavedChangesRef.current)
        if (hasUnsavedChangesRef.current) {
          saveImmediately()
        }
      }
    }
    
    const handleFocus = () => {
      hasMouseMoved = false
    }
    
    // Add blur listener to the textarea specifically
    const textarea = document.querySelector('.w-md-editor-text')
    if (textarea) {
      textarea.addEventListener('blur', handleBlur)
    }
    
    // Add mouse move listener to detect user interaction elsewhere
    document.addEventListener('mousemove', handleMouseMove)
    
    // Add focus listener to reset mouse movement tracking
    document.addEventListener('focus', handleFocus, true)
    
    return () => {
      if (textarea) {
        textarea.removeEventListener('blur', handleBlur)
      }
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('focus', handleFocus, true)
    }
  }, [saveImmediately]) // Only depend on saveImmediately, not markdownValue

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
  const getMDEditorPreviewMode = (mode: 'edit' | 'live' | 'view'): 'edit' | 'live' | 'preview' => {
    if (mode === 'view') return 'preview'
    return mode
  }

  // Get icon for current mode
  const getModeIcon = (mode: 'edit' | 'live' | 'view') => {
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

    // Use the current content from ref to avoid stale state
    const currentValue = currentContentRef.current || ''
    const newValue = currentValue + (currentValue ? '\n' : '') + text
    
    // Update content through React state only
    handleContentChange(newValue)
  }, [handleContentChange])

  // Function to trigger immediate save and cancel debounces
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
    <div className={`app ${theme}`} data-color-mode={theme}>
      <div className="editor-container">
        <div className="editor-wrapper">
          <MDEditor
            value={markdownValue}
            onChange={handleContentChange}
            data-color-mode={theme}
            visibleDragbar={false}
            hideToolbar
            preview={getMDEditorPreviewMode(previewMode)}
          />
        </div>
        <div className="editor-controls" ref={editorControlsRef}>
          <Recorder onTranscription={handleTranscription} onRecordingStart={triggerImmediateSave} />
          <div className={`character-counter ${isLimitReached ? 'limit-reached' : ''}`}>
            <button 
              className="mode-section"
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
            <span className="usage-section">
              {usagePercentage}% used
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Editor

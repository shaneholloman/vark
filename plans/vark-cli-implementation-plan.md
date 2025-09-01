# Vark CLI Implementation Plan

## Project Overview

Add CLI functionality to the existing Vark application by extending current components to work in both browser and terminal contexts.

## Current Vark Architecture Analysis

### Existing Project Structure

```tree
vark/
├── src/
│   ├── components/
│   │   ├── editor.tsx       # 22KB - Main markdown editor with compression logic
│   │   ├── recorder.tsx     # 13KB - Voice recording with OpenAI Whisper
│   │   └── icon.tsx         # 817 bytes - SVG icon component
│   ├── main.tsx             # 266 bytes - Web app entry point
│   ├── style.css            # Global styles
│   └── test/                # Test files
├── package.json             # Current dependencies
├── vite.config.ts           # Web build configuration
└── tsconfig.json            # TypeScript configuration
```

### Core Functionality in Existing Components

**editor.tsx contains:**

- URL-based storage with gzip compression and base64 encoding
- Real-time markdown editing with debounced saving
- Preview modes (edit/live/view) with URL persistence
- Character limit tracking and usage percentage
- Theme detection and metadata management
- Browser-specific APIs (CompressionStream, DOM manipulation)

**recorder.tsx contains:**

- OpenAI Whisper API integration with client-side usage
- Audio recording with MediaRecorder API
- API key validation and localStorage management
- Browser-specific audio handling and permissions

## Proposed Architecture: Universal Components

### Core Principle

Make existing components **context-aware** rather than creating separate CLI versions. Each component detects its runtime environment and adapts behavior accordingly.

### Environment Detection Strategy

```typescript
// Shared environment detection utility
const isTerminal = typeof window === 'undefined' || process.env.VARK_CLI === 'true'
const isBrowser = !isTerminal
```

### Modified Project Structure

```tree
vark/
├── src/
│   ├── components/
│   │   ├── editor.tsx       # MODIFIED - Universal component for web + CLI
│   │   ├── recorder.tsx     # MODIFIED - Universal component for web + CLI
│   │   └── icon.tsx         # UNCHANGED - Web only
│   ├── providers/           # NEW - Multi-provider transcription system
│   │   ├── index.ts         # Provider factory and interfaces
│   │   ├── openai.ts        # OpenAI Whisper provider
│   │   ├── google.ts        # Google Cloud Speech-to-Text provider
│   │   └── types.ts         # Provider-specific types
│   ├── shared/
│   │   ├── compression.ts   # EXTRACTED from editor.tsx
│   │   ├── storage.ts       # Universal config/API key storage
│   │   └── types.ts         # General app types
│   ├── main.tsx             # UNCHANGED - Web entry point
│   └── cli.tsx              # NEW - CLI entry point
├── bin/
│   └── vark                 # NEW - Executable script
├── package.json             # UPDATED - Add CLI dependencies
├── vite.config.ts           # UNCHANGED
└── tsconfig.json            # UNCHANGED
```

## Implementation Strategy

### Phase 1: Extract Shared Logic

**Extract compression utilities from editor.tsx:**

```typescript
// src/shared/compression.ts
export const encodeContent = async (text: string, mode: 'edit' | 'live' | 'view') => {
  const data = { content: text, mode }
  const jsonString = JSON.stringify(data)

  if (typeof window !== 'undefined') {
    // Browser: use CompressionStream
    const compressionStream = new CompressionStream('gzip')
    // ... existing browser logic
  } else {
    // Node.js: use zlib
    const zlib = await import('zlib')
    const compressed = zlib.gzipSync(Buffer.from(jsonString, 'utf-8'))
    return compressed.toString('base64')
  }
}
```

**Extract transcription providers into provider system:**

```typescript
// src/providers/index.ts
export interface TranscriptionProvider {
  name: string
  displayName: string
  transcribe(audio: AudioData, config: ProviderConfig): Promise<string>
  validateConfig(config: ProviderConfig): Promise<boolean>
  getSupportedFormats(): string[]
}

export interface ProviderConfig {
  apiKey: string
  [key: string]: any // Provider-specific options
}

export interface AudioData {
  blob: Blob | Buffer
  format: string
}

export const createProvider = (type: 'openai' | 'google'): TranscriptionProvider => {
  switch (type) {
    case 'openai':
      return new OpenAIProvider()
    case 'google':
      return new GoogleProvider()
    default:
      throw new Error(`Unknown provider: ${type}`)
  }
}

// src/providers/openai.ts
export class OpenAIProvider implements TranscriptionProvider {
  name = 'openai'
  displayName = 'OpenAI Whisper'

  async transcribe(audio: AudioData, config: ProviderConfig): Promise<string> {
    const openai = new OpenAI({
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: typeof window !== 'undefined'
    })

    const audioFile = this.createAudioFile(audio.blob, audio.format)
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "text"
    })

    return transcription
  }
}
```

### Phase 2: Modify Existing Components

**Update editor.tsx to be universal:**

```typescript
// src/components/editor.tsx
import { Text, Box, useInput } from 'ink'  // CLI imports
import MDEditor from '@uiw/react-md-editor'  // Web imports
import { encodeContent } from '../shared/compression.js'

const isTerminal = typeof window === 'undefined'

export default function Editor() {
  // Shared state and logic remains identical
  const [markdownValue, setMarkdownValue] = useState('')

  if (isTerminal) {
    return <TerminalEditor value={markdownValue} onChange={setMarkdownValue} />
  }

  return <MDEditor value={markdownValue} onChange={setMarkdownValue} />
}

function TerminalEditor({ value, onChange }) {
  // Ink-based terminal UI using highlight.js + lowlight
  return (
    <Box flexDirection="column">
      <SyntaxHighlightedText>{value}</SyntaxHighlightedText>
    </Box>
  )
}
```

**Update recorder.tsx to be universal:**

```typescript
// src/components/recorder.tsx
import { createProvider, type TranscriptionProvider } from '../providers/index.js'
import { UniversalStorage } from '../shared/storage.js'

const isTerminal = typeof window === 'undefined'

export default function Recorder({ onTranscription }) {
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'google'>('openai')
  const storage = new UniversalStorage()

  const handleTranscription = async (audioData: AudioData) => {
    const provider = createProvider(selectedProvider)
    const config = storage.getProviderConfig(selectedProvider)
    const transcription = await provider.transcribe(audioData, config)
    onTranscription(transcription)
  }

  if (isTerminal) {
    return <TerminalRecorder onTranscription={handleTranscription} />
  }

  return <BrowserRecorder onTranscription={handleTranscription} />
}
```

### Phase 3: Create CLI Entry Point

**Add CLI main file:**

```typescript
// src/cli.tsx
import { render } from 'ink'
import { program } from 'commander'
import Editor from './components/editor.js'
import Recorder from './components/recorder.js'

process.env.VARK_CLI = 'true'  // Set environment flag

program
  .name('vark')
  .description('Terminal markdown editor with voice input')
  .action(async () => {
    const App = () => (
      <Box flexDirection="column">
        <Editor />
        <Recorder onTranscription={handleTranscription} />
      </Box>
    )

    render(<App />)
  })

program.parse()
```

### Phase 4: Package Configuration

**Update package.json:**

```json
{
  "name": "vark",
  "bin": {
    "vark": "./bin/vark"
  },
  "dependencies": {
    "@uiw/react-md-editor": "^4.0.7",
    "openai": "^4.103.0",
    "pako": "2.1.0",
    "lucide-react": "^0.511.0",
    "react": "^19.1.0",
    "react-dom": "^18.3.1",
    "ink": "^6.2.3",
    "highlight.js": "^11.11.1",
    "lowlight": "^3.3.0",
    "commander": "^12.0.0"
  }
}
```

**Create executable script:**

```bash
#!/usr/bin/env node
# bin/vark
import('./src/cli.tsx')
```

## Technical Considerations

### Shared Logic Benefits

- **Single source of truth** for compression/decompression
- **Identical URL generation** between web and CLI
- **Same OpenAI integration** with environment-specific optimizations
- **Unified testing** for core functionality

### Environment-Specific Adaptations

**Browser-only features:**

- DOM manipulation for metadata updates
- Browser CompressionStream API
- MediaRecorder for audio capture
- localStorage for API key storage

**Terminal-only features:**

- Ink components for terminal UI
- Node.js zlib for compression
- Terminal audio recording libraries
- File system for configuration storage

### Input/Output Strategy

**CLI Usage Patterns:**

```bash
vark                          # Interactive terminal editor
vark "# Hello World"          # Direct text input
vark < document.md            # File input
echo "content" | vark         # Stdin input
vark --voice                  # Voice recording mode
```

**Output Format:**

```bash
# Standard output shows the generated URL
https://shaneholloman.github.io/vark/#H4sIAAAAAAAAA...

# Verbose mode shows compression stats
Content: 142 characters
Compressed: 89 bytes (37% reduction)
URL: https://shaneholloman.github.io/vark/#H4sIAAAAAAAAA...
Usage: 12% of URL limit
```

## Implementation Phases

### Phase 1: Foundation

1. Create provider system in `src/providers/` directory
2. Extract compression logic to `src/shared/compression.ts`
3. Create universal storage system in `src/shared/storage.ts`
4. Extract current OpenAI code into `providers/openai.ts`
5. Update imports in existing components

### Phase 2: Multi-Provider Implementation

1. Implement Google Cloud Speech-to-Text provider in `providers/google.ts`
2. Update `recorder.tsx` to use provider system
3. Add provider selection UI components
4. Test both OpenAI and Google providers work identically

### Phase 3: Universal Components

1. Modify `editor.tsx` to detect environment and render accordingly
2. Modify `recorder.tsx` for universal audio handling with providers
3. Add Ink dependencies and basic terminal UI components
4. Test web app still works after modifications

### Phase 4: CLI Interface

1. Create `src/cli.tsx` with Commander.js setup
2. Implement terminal-specific UI components
3. Add `bin/vark` executable script
4. Configure package.json for CLI distribution

### Phase 5: Terminal Features & Polish

1. Implement terminal markdown syntax highlighting
2. Add terminal-based audio recording with providers
3. Handle stdin/file input processing
4. Cross-platform testing and documentation

## Success Metrics

- [ ] Multi-provider system supports OpenAI and Google seamlessly
- [ ] Web app functionality unchanged after refactoring
- [ ] CLI generates identical URLs to web app
- [ ] Voice recording works with both providers in both environments
- [ ] Terminal syntax highlighting matches web quality
- [ ] Single codebase maintains both interfaces
- [ ] Package installs globally via npm

## Dependencies to Add

```json
{
  "ink": "^6.2.3",
  "highlight.js": "^11.11.1",
  "lowlight": "^3.3.0",
  "commander": "^12.0.0",
  "string-width": "^7.1.0"
}
```

## Key Technical Decisions

### Why Universal Components?

- **Eliminates code duplication** between web and CLI versions
- **Ensures consistency** in compression and URL generation
- **Simplifies maintenance** with single components handling both contexts
- **Reduces testing burden** by testing once for both environments

### Why Extract Shared Logic?

- **Environment-agnostic utilities** can be tested independently
- **Clean separation** between UI concerns and business logic
- **Easier future extensions** for additional platforms
- **Better code organization** following single responsibility principle

This approach transforms Vark from a web-only tool into a universal markdown editor while maintaining the existing codebase and adding CLI capabilities through environment-aware components.

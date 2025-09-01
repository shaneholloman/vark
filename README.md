# `vark`

Real-time markdown editor with voice transcription and URL-encoded content storage ➜ [check it out](https://shaneholloman.github.io/vark)

![screenshot](public/screenshot.png)

## Features

- **URL-based storage** - The buffer content is compressed and stored in the URL hash
- **Voice transcription** - Record audio and convert to text using OpenAI Whisper
- **Real-time preview** - Live markdown editing and preview
- **Dark/light theme** - Automatically adapts to your system preference
- **Character limit tracking** - Visual indicator of URL length usage

## Development

This project uses PNPM for package management.

### Setup

```sh
pnpm install
```

### Available Commands

```sh
pnpm run dev      # Start development server
pnpm run build    # Build for production
pnpm run preview  # Preview production build
pnpm run test     # Run tests in watch mode
pnpm run test:run # Run tests once
```

## Deployment

### GitHub Pages Troubleshooting

If you encounter a blank white page when deploying to GitHub Pages, ensure your Pages source is configured correctly:

1. Go to your repository's Settings > Pages
2. Under "Source", select "Deploy from a branch"
3. Choose `gh-pages` branch and `/ (root)` folder

Alternatively, use the GitHub CLI:

```sh
gh api --method PUT repos/username/repo-name/pages --input - <<< '{"source":{"branch":"gh-pages","path":"/"}}'
```

This ensures GitHub Pages serves the built files from the `gh-pages` branch (where the deployment workflow publishes them) rather than the source files from the `main` branch.

## Testing

This project uses Vitest with React Testing Library for a fast, modern testing experience.

### Testing Stack

- **Vitest**: Fast unit test framework built on Vite
- **@testing-library/react**: React component testing utilities
- **@testing-library/jest-dom**: Custom DOM matchers
- **@testing-library/user-event**: User interaction simulation
- **jsdom**: Browser environment simulation

### Test Suite Purpose

**Important:** This test suite is NOT for validating that code works correctly. It serves as guardrails to prevent regressions when modifying existing features or adding new ones. The tests ensure that critical functionality like compression, storage, and provider interfaces don't break during refactoring or updates.

### Project Structure

```tree
src/
├── components/
│   ├── editor.tsx           # Main markdown editor with URL storage, live preview, and virtual keyboard handling
│   ├── recorder.tsx         # Voice recording component with multi-provider transcription support
│   ├── icon.tsx             # SVG app icon (file-volume symbol)
│   └── ui/                  # Complete shadcn/ui component library (50+ components)
│       ├── button.tsx       # Button primitives
│       ├── dialog.tsx       # Modal dialog components
│       ├── input.tsx        # Form input components
│       ├── select.tsx       # Dropdown selection components
│       ├── toast.tsx        # Toast notification components
│       └── ...              # Additional UI primitives (accordion, alert, card, etc.)
├── providers/               # Speech-to-text provider abstraction layer
│   ├── index.ts             # Provider factory and registry system
│   ├── types.ts             # Common interfaces for transcription providers
│   ├── openai.ts            # OpenAI Whisper provider implementation
│   └── google.ts            # Google Speech-to-Text provider implementation
├── shared/                  # Cross-platform utilities and core logic
│   ├── compression.ts       # URL-based content storage with gzip compression
│   ├── storage.ts           # Universal storage layer (browser localStorage + planned CLI file storage)
│   └── types.ts             # Shared TypeScript definitions
├── hooks/                   # React custom hooks
│   └── use-toast.ts         # Toast notification state management
├── lib/                     # Utility libraries
│   └── utils.ts             # Tailwind CSS class merging utility
├── test/                    # Test suite
│   ├── setup.ts             # Minimal test setup
│   ├── compression.test.ts  # Real compression tests using Node.js zlib
│   ├── providers.test.ts    # Provider factory and interface tests
│   ├── storage.test.ts      # Storage logic tests
│   └── utils.test.ts        # Utility function tests
├── main.tsx                 # React application entry point
├── index.css                # Tailwind CSS directives and base styles
├── style.css                # Custom CSS overrides for markdown editor
└── vite-env.d.ts            # TypeScript definitions for Vite environment
```

## Keyboard Shortcuts

- **Cmd + Enter**: Start/stop recording
- **Cmd + e**: Toggle editor/split/view mode
- for md shortcuts, see [react-md-editor](https://uiwjs.github.io/react-md-editor/)

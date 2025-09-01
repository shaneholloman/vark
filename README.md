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
pnpm run test:ui  # Run tests with UI
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

### Project Structure

```tree
src/
├── components/
│   ├── editor.tsx    # Main editor component
│   ├── recorder.tsx  # Voice recording component
│   └── icon.tsx      # App icon component
├── test/
│   ├── setup.ts      # Test setup and global mocks
│   ├── editor.test.tsx # Main component tests
│   └── utils.test.ts # Utility function tests
├── main.tsx          # App entry point
├── style.css         # Global styles
└── vite-env.d.ts     # Vite type definitions
```

## Keyboard Shortcuts

- **Cmd + Enter**: Start/stop recording
- **Cmd + e**: Toggle editor/split/view mode
- for md shortcuts, see [react-md-editor](https://uiwjs.github.io/react-md-editor/)

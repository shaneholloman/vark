import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Editor from './components/editor.tsx'
import './index.css'
import './style.css'

const root = createRoot(document.getElementById('app')!)
root.render(
  <StrictMode>
    <Editor />
  </StrictMode>
)

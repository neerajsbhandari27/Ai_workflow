import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#181818',
            color: '#f0f0f0',
            border: '1px solid #2a2a2a',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            borderRadius: '4px',
          },
          success: { iconTheme: { primary: '#47ffb3', secondary: '#0a0a0a' } },
          error:   { iconTheme: { primary: '#ff4757', secondary: '#0a0a0a' } },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>,
)
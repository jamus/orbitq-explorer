import './style.css'

if (import.meta.env.DEV) {
  document.title = 'OrbitQ Explorer (react)'
}
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ApolloProvider } from '@apollo/client/react'
import { client } from './lib/apollo'
import { router } from './router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApolloProvider client={client}>
      <RouterProvider router={router} />
    </ApolloProvider>
  </StrictMode>,
)

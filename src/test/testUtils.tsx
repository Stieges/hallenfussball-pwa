/* eslint-disable react-refresh/only-export-components -- Test utilities don't need HMR */
import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * Custom render function that wraps components with necessary providers
 */
const AllProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: AllProviders, ...options }),
  }
}

// Re-export everything from testing-library
export * from '@testing-library/react'
export { customRender as render, userEvent }

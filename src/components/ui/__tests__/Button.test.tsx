import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../../test/testUtils'
import { Button } from '../Button'

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn()
    const { user } = render(<Button onClick={handleClick}>Click me</Button>)

    await user.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', async () => {
    const handleClick = vi.fn()
    const { user } = render(
      <Button onClick={handleClick} disabled>
        Click me
      </Button>
    )

    await user.click(screen.getByRole('button'))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('renders with correct type attribute', () => {
    render(<Button type="submit">Submit</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })

  it('renders icon on left by default', () => {
    const icon = <span data-testid="test-icon">Icon</span>
    render(<Button icon={icon}>With Icon</Button>)

    const button = screen.getByRole('button')
    expect(button).toContainElement(screen.getByTestId('test-icon'))
  })

  it('applies aria-label for accessibility', () => {
    render(<Button aria-label="Close dialog">X</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Close dialog')
  })

  it('has aria-disabled when disabled', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true')
  })

  describe('variants', () => {
    it('renders primary variant by default', () => {
      render(<Button>Primary</Button>)
      // Button renders, default variant is applied
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('renders danger variant', () => {
      render(<Button variant="danger">Delete</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('renders ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('renders secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })

  describe('sizes', () => {
    it('renders small size', () => {
      render(<Button size="sm">Small</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('renders large size', () => {
      render(<Button size="lg">Large</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })

  it('renders full width when specified', () => {
    render(<Button fullWidth>Full Width</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveStyle({ width: '100%' })
  })
})

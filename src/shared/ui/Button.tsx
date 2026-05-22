import React from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white shadow-[0_18px_50px_rgba(139,92,246,0.28)] hover:bg-[#7C3AED]',
  secondary: 'bg-card text-text shadow-[0_14px_35px_rgba(0,0,0,0.22)] hover:bg-[#273244]',
  danger: 'bg-danger text-white shadow-[0_18px_50px_rgba(239,68,68,0.22)] hover:bg-[#DC2626]',
  ghost: 'bg-transparent text-muted hover:bg-white/5 hover:text-text'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'secondary', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={[
          'min-h-12 rounded-xl px-5 py-3 text-sm font-semibold transition duration-300 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-accent/70 focus:ring-offset-2 focus:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
          variantClasses[variant],
          className
        ].join(' ')}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

import React from 'react'

type PanelProps = React.HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'article' | 'div'
}

export function Panel({ as = 'section', className = '', children, ...props }: PanelProps) {
  const Component = as

  return (
    <Component
      className={[
        'rounded-xl border border-white/10 bg-surface/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]',
        'backdrop-blur-md',
        className
      ].join(' ')}
      {...props}
    >
      {children}
    </Component>
  )
}

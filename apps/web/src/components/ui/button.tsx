import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '#/lib/utils'

const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99]',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white shadow-xs hover:bg-primary-hover',
        secondary: 'bg-secondary text-white shadow-xs hover:bg-secondary/90',
        danger:
          'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/35',
        outline:
          'border border-border-subtle bg-background text-secondary hover:border-primary/40 hover:bg-surface',
        ghost: 'bg-transparent text-secondary hover:bg-surface',
        link: 'h-auto rounded-none p-0 text-primary underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-8 px-3 text-xs [&_svg]:size-3.5',
        sm: 'h-9 px-3.5 text-xs [&_svg]:size-4',
        md: 'h-10 px-4 text-sm [&_svg]:size-4',
        lg: 'h-11 px-5 text-sm [&_svg]:size-4.5',
        icon: 'size-9 p-0 [&_svg]:size-4',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

function Button({
  className,
  variant,
  size,
  fullWidth,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    />
  )
}

export { Button, buttonVariants }
export type { ButtonProps }

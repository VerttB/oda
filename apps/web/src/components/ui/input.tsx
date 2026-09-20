import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '#/lib/utils'

const inputVariants = cva(
  'w-full rounded-lg border text-foreground transition-colors outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 focus:border-primary focus:ring-1 focus:ring-primary aria-invalid:border-destructive aria-invalid:ring-destructive/30',
  {
    variants: {
      variant: {
        default: 'border-border-subtle bg-background',
        filled: 'border-border-subtle bg-surface',
        subtle: 'border-transparent bg-surface text-secondary',
        ghost: 'border-transparent bg-transparent shadow-none',
      },
      size: {
        xs: 'h-8 px-2.5 text-xs',
        sm: 'h-9 px-3 text-xs',
        md: 'h-10 px-3.5 text-sm',
        lg: 'h-11 px-4 text-sm',
      },
      hasLeftIcon: {
        true: '',
      },
      hasRightIcon: {
        true: '',
      },
    },
    compoundVariants: [
      { size: 'xs', hasLeftIcon: true, className: 'pl-8' },
      { size: 'sm', hasLeftIcon: true, className: 'pl-9' },
      { size: 'md', hasLeftIcon: true, className: 'pl-10' },
      { size: 'lg', hasLeftIcon: true, className: 'pl-11' },
      { size: 'xs', hasRightIcon: true, className: 'pr-8' },
      { size: 'sm', hasRightIcon: true, className: 'pr-9' },
      { size: 'md', hasRightIcon: true, className: 'pr-10' },
      { size: 'lg', hasRightIcon: true, className: 'pr-11' },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

const inputIconVariants = cva(
  'pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-full',
  {
    variants: {
      position: {
        left: '',
        right: '',
      },
      size: {
        xs: 'size-3.5',
        sm: 'size-4',
        md: 'size-4',
        lg: 'size-4.5',
      },
    },
    compoundVariants: [
      { position: 'left', size: 'xs', className: 'left-2.5' },
      { position: 'left', size: 'sm', className: 'left-3' },
      { position: 'left', size: 'md', className: 'left-3.5' },
      { position: 'left', size: 'lg', className: 'left-4' },
      { position: 'right', size: 'xs', className: 'right-2.5' },
      { position: 'right', size: 'sm', className: 'right-3' },
      { position: 'right', size: 'md', className: 'right-3.5' },
      { position: 'right', size: 'lg', className: 'right-4' },
    ],
    defaultVariants: {
      size: 'md',
    },
  },
)

type InputProps = Omit<React.ComponentProps<'input'>, 'size'> &
  VariantProps<typeof inputVariants> & {
    leftIcon?: React.ReactNode
    rightIcon?: React.ReactNode
    wrapperClassName?: string
  }

function Input({
  className,
  wrapperClassName,
  variant,
  size,
  leftIcon,
  rightIcon,
  ...props
}: InputProps) {
  const resolvedSize = size ?? 'md'

  if (leftIcon || rightIcon) {
    return (
      <div className={cn('relative w-full', wrapperClassName)}>
        {leftIcon && (
          <span
            className={cn(
              inputIconVariants({ position: 'left', size: resolvedSize }),
            )}
          >
            {leftIcon}
          </span>
        )}
        <input
          data-slot="input"
          className={cn(
            inputVariants({
              variant,
              size,
              hasLeftIcon: Boolean(leftIcon),
              hasRightIcon: Boolean(rightIcon),
            }),
            className,
          )}
          {...props}
        />
        {rightIcon && (
          <span
            className={cn(
              inputIconVariants({ position: 'right', size: resolvedSize }),
            )}
          >
            {rightIcon}
          </span>
        )}
      </div>
    )
  }

  return (
    <input
      data-slot="input"
      className={cn(inputVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Input, inputVariants }
export type { InputProps }

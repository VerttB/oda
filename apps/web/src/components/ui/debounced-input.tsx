import * as React from 'react'

import { Input, type InputProps } from '#/components/ui/input'

type DebouncedInputProps = Omit<InputProps, 'defaultValue' | 'onChange' | 'value'> & {
  delay?: number
  onValueChange: (value: string) => void
  value: string
}

function DebouncedInput({
  delay = 400,
  onValueChange,
  value,
  ...props
}: DebouncedInputProps) {
  const [localValue, setLocalValue] = React.useState(value)

  React.useEffect(() => {
    setLocalValue(value)
  }, [value])

  React.useEffect(() => {
    if (localValue === value) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      onValueChange(localValue)
    }, delay)

    return () => window.clearTimeout(timeoutId)
  }, [delay, localValue, onValueChange, value])

  return (
    <Input
      {...props}
      value={localValue}
      onChange={(event) => setLocalValue(event.target.value)}
    />
  )
}

export { DebouncedInput }
export type { DebouncedInputProps }

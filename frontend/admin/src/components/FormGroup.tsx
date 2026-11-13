import type { ReactNode } from 'react'

interface FormGroupProps {
  label?: ReactNode
  className?: string
  children?: ReactNode
}

// 原版表单项：Bootstrap .form-group + <label for="example-text-input-alt"> + 控件
export function FormGroup({ label, className, children }: FormGroupProps) {
  return (
    <div className={className ? `form-group ${className}` : 'form-group'}>
      {label !== undefined && <label htmlFor="example-text-input-alt">{label}</label>}
      {children}
    </div>
  )
}

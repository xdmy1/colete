import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destination' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const variants = {
  primary: 'bg-pill-green-bg text-emerald-800 border border-pill-green-border hover:bg-emerald-100 active:bg-emerald-200',
  secondary:
    'bg-white text-slate-600 border border-card-border hover:bg-gray-50 active:bg-gray-100',
  destination:
    'bg-white text-slate-700 border border-card-border hover:border-pill-green-border hover:bg-pill-green-bg/40 active:bg-pill-green-bg active:scale-[0.98]',
  danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50 active:bg-red-100',
}

const sizes = {
  sm: 'px-4 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-6 py-3 text-lg',
  xl: 'px-8 py-4 text-xl font-semibold',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center rounded-full
        transition-all duration-150 font-medium
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

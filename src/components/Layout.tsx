import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
  title?: string
  onBack?: () => void
  rightAction?: ReactNode
}

export default function Layout({
  children,
  title,
  onBack,
  rightAction,
}: LayoutProps) {
  return (
    <div className="min-h-screen bg-soft-bg flex flex-col">
      {/* Header */}
      {title && (
        <header className="bg-white border-b border-card-border px-4 py-3.5 flex items-center gap-3 sticky top-0 z-30">
          {onBack && (
            <button
              onClick={onBack}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-card-border text-slate-400 hover:text-slate-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}
          <h1 className="text-lg font-semibold text-slate-800 flex-1 tracking-tight">
            {title}
          </h1>
          {rightAction}
        </header>
      )}

      {/* Content */}
      <main className="flex-1 p-4">{children}</main>
    </div>
  )
}

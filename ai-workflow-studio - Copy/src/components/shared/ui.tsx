import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

// ── Button ────────────────────────────────────────────────────────────────────

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'outline'
  size?:    'sm' | 'md'
  loading?: boolean
  icon?:    React.ReactNode
}

export function Btn({
  variant = 'outline', size = 'md', loading, icon, children, style, disabled, ...rest
}: BtnProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontFamily: 'var(--mono)', cursor: 'pointer',
    border: '1px solid', borderRadius: 'var(--radius)',
    transition: 'all 0.15s', whiteSpace: 'nowrap',
    ...(size === 'sm'
      ? { fontSize: 11, padding: '5px 10px' }
      : { fontSize: 12, padding: '8px 14px' }),
  }
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#0a0a0a' },
    ghost:   { background: 'transparent',   borderColor: 'transparent',   color: 'var(--text-2)' },
    danger:  { background: 'var(--red-dim)', borderColor: 'var(--red)',   color: 'var(--red)' },
    outline: { background: 'transparent',   borderColor: 'var(--border-2)', color: 'var(--text-2)' },
  }
  return (
    <button
      disabled={disabled || loading}
      style={{ ...base, ...variants[variant], opacity: disabled || loading ? 0.45 : 1, ...style }}
      {...rest}
    >
      {loading
        ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
        : icon}
      {children}
    </button>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, style, ...rest }, ref) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label style={{
          fontFamily: 'var(--mono)', fontSize: 10,
          color: 'var(--text-3)', letterSpacing: '0.08em',
        }}>
          {label.toUpperCase()}
        </label>
      )}
      <input
        ref={ref}
        style={{
          background: 'var(--bg-2)',
          border: `1px solid ${error ? 'var(--red)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)', color: 'var(--text)',
          fontFamily: 'var(--sans)', fontSize: 13,
          padding: '8px 12px', outline: 'none', width: '100%',
          transition: 'border-color 0.15s',
          ...style,
        }}
        onFocus={e => (e.target.style.borderColor = error ? 'var(--red)' : 'var(--accent)')}
        onBlur={e  => (e.target.style.borderColor = error ? 'var(--red)' : 'var(--border)')}
        {...rest}
      />
      {error && (
        <span style={{ fontSize: 11, color: 'var(--red)', fontFamily: 'var(--mono)' }}>
          {error}
        </span>
      )}
    </div>
  ),
)

// ── Textarea ──────────────────────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, style, ...rest }, ref) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label style={{
          fontFamily: 'var(--mono)', fontSize: 10,
          color: 'var(--text-3)', letterSpacing: '0.08em',
        }}>
          {label.toUpperCase()}
        </label>
      )}
      <textarea
        ref={ref}
        style={{
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', color: 'var(--text)',
          fontFamily: 'var(--sans)', fontSize: 13,
          padding: '8px 12px', outline: 'none', width: '100%',
          resize: 'vertical', minHeight: 80, lineHeight: 1.6,
          transition: 'border-color 0.15s',
          ...style,
        }}
        onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
        onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
        {...rest}
      />
    </div>
  ),
)

// ── Select ────────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?:   string
  options:  { value: string; label: string }[]
}

export function Select({ label, options, style, ...rest }: SelectProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label style={{
          fontFamily: 'var(--mono)', fontSize: 10,
          color: 'var(--text-3)', letterSpacing: '0.08em',
        }}>
          {label.toUpperCase()}
        </label>
      )}
      <select
        style={{
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', color: 'var(--text)',
          fontFamily: 'var(--sans)', fontSize: 13,
          padding: '8px 12px', outline: 'none', width: '100%', cursor: 'pointer',
          ...style,
        }}
        {...rest}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: 'var(--bg-2)' }}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────

export function Toggle({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
      onClick={() => onChange(!checked)}
    >
      <div style={{
        width: 34, height: 20, borderRadius: 10, position: 'relative',
        background: checked ? 'var(--accent)' : 'var(--bg-3)',
        border: '1px solid var(--border-2)', transition: 'background 0.2s',
      }}>
        <div style={{
          position: 'absolute', top: 3,
          left: checked ? 16 : 3,
          width: 12, height: 12, borderRadius: '50%',
          background: checked ? '#0a0a0a' : 'var(--text-3)',
          transition: 'left 0.2s',
        }} />
      </div>
      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</span>
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────

type BadgeColor = 'accent' | 'green' | 'blue' | 'red' | 'default'

export function Badge({ children, color = 'default' }: { children: React.ReactNode; color?: BadgeColor }) {
  const map: Record<BadgeColor, { bg: string; text: string; border: string }> = {
    accent:  { bg: 'var(--accent-dim)',  text: 'var(--accent)', border: 'rgba(232,255,71,0.3)'  },
    green:   { bg: 'var(--green-dim)',   text: 'var(--green)',  border: 'rgba(71,255,179,0.3)'  },
    blue:    { bg: 'var(--blue-dim)',    text: 'var(--blue)',   border: 'rgba(71,179,255,0.3)'  },
    red:     { bg: 'var(--red-dim)',     text: 'var(--red)',    border: 'rgba(255,71,87,0.3)'   },
    default: { bg: 'var(--bg-3)',        text: 'var(--text-3)', border: 'var(--border)'          },
  }
  const c = map[color]
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.05em',
      padding: '2px 7px', borderRadius: 3,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      display: 'inline-flex', alignItems: 'center', gap: 3,
    }}>
      {children}
    </span>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

export function Card({
  children, style, onClick,
}: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-1)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 16,
        cursor: onClick ? 'pointer' : undefined,
        transition: 'border-color 0.15s',
        ...style,
      }}
      onMouseEnter={onClick ? e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)' } : undefined}
      onMouseLeave={onClick ? e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'   } : undefined}
    >
      {children}
    </div>
  )
}

// ── PageHeader ────────────────────────────────────────────────────────────────

export function PageHeader({
  title, subtitle, action,
}: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div style={{
      padding: '28px 32px 20px',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10,
          color: 'var(--text-3)', letterSpacing: '0.1em', marginBottom: 4,
        }}>
          {subtitle.toUpperCase()}
        </div>
        <h1 style={{
          fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700,
          color: 'var(--text)', letterSpacing: '-0.02em',
        }}>
          {title}
        </h1>
      </div>
      {action}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function Modal({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
      onClick={onClose}
    >
      <div
        className="fade-in"
        style={{
          background: 'var(--bg-1)', border: '1px solid var(--border-2)',
          borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 480,
          maxHeight: '85vh', overflow: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)',
        }}>
          {title}
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function Empty({
  icon, message, sub,
}: { icon: React.ReactNode; message: string; sub?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '64px 20px', gap: 10,
    }}>
      <div style={{ color: 'var(--text-3)', opacity: 0.35 }}>{icon}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-3)' }}>{message}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', opacity: 0.55 }}>{sub}</div>}
    </div>
  )
}
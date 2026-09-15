import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { AppIcon } from '@/components/icons/AppIcon';

export function AuthCard({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <header>
        <span>{eyebrow}</span>
        <h1 id="auth-title">{title}</h1>
        <p>{description}</p>
      </header>
      {children}
      <footer>{footer}</footer>
    </section>
  );
}

export function AuthField({
  id,
  label,
  type = 'text',
  autoComplete,
  required = true,
  hint,
  minLength,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  const password = type === 'password';
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-input-wrap">
        <input
          id={id}
          name={id}
          type={password && visible ? 'text' : type}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        {password ? (
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
          >
            {visible ? 'إخفاء' : 'إظهار'}
          </button>
        ) : null}
      </div>
      {hint ? <small id={`${id}-hint`}>{hint}</small> : null}
    </div>
  );
}

export function AuthSubmit({
  children,
  busy = false,
}: {
  children: ReactNode;
  busy?: boolean;
}) {
  return (
    <button
      className="auth-submit"
      type="submit"
      disabled={busy}
      aria-busy={busy}
    >
      {busy ? 'جارٍ التنفيذ…' : children}
      <AppIcon name="arrow" />
    </button>
  );
}

export function AuthStatus({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  return message ? (
    <p
      className="auth-status"
      role={error ? 'alert' : 'status'}
      data-status={error ? 'error' : 'progress'}
    >
      {message}
    </p>
  ) : null;
}

export function BackToLogin() {
  return <Link to="/login/">الرجوع لتسجيل الدخول</Link>;
}

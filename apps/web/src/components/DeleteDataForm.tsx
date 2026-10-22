'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CONTACT_EMAIL } from '@/lib/contact';

type Status = 'idle' | 'loading' | 'done' | 'error';

export function DeleteDataForm() {
  const [email, setEmail] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setStatus('loading');
    try {
      const res = await fetch('/cm-api/public/deletion-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), confirm: true }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Could not submit request. Try again.');
        return;
      }
      setStatus('done');
      setMessage(
        data.message ||
          'Request received. We will verify ownership and delete your data within 30 days.',
      );
      setEmail('');
      setConfirm(false);
    } catch {
      setStatus('error');
      setMessage('Network error. Check your connection and try again.');
    }
  }

  if (status === 'done') {
    return (
      <div className="mt-10 rounded-[var(--cm-radius-control)] border border-border bg-surface px-5 py-6">
        <p className="text-lg font-semibold text-ink">Request submitted</p>
        <p className="mt-2 text-sm text-ink-secondary leading-relaxed">{message}</p>
        <p className="mt-4 text-sm text-ink-muted">
          Questions? Email{' '}
          <a
            className="font-medium text-brand underline-offset-4 hover:underline"
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Data deletion follow-up')}`}
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-6"
          onClick={() => {
            setStatus('idle');
            setMessage(null);
          }}
        >
          Submit another request
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-10 space-y-6">
      <div className="space-y-2">
        <Label htmlFor="delete-email">Account email</Label>
        <Input
          id="delete-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === 'loading'}
        />
        <p className="text-xs text-ink-muted">
          Use the same email you sign in with (Google or password).
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm text-ink-secondary">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-[var(--cm-brand)]"
          checked={confirm}
          onChange={(e) => setConfirm(e.target.checked)}
          disabled={status === 'loading'}
          required
        />
        <span>
          I request deletion of my Penny account and associated ledger data. I understand this cannot
          be undone after we process the request.
        </span>
      </label>

      {message && status === 'error' ? (
        <p className="text-sm font-medium text-red-600" role="alert">
          {message}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={status === 'loading' || !confirm || !email.trim()}>
        {status === 'loading' ? 'Submitting…' : 'Request data deletion'}
      </Button>
    </form>
  );
}

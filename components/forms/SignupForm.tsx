'use client';

import { useActionState } from 'react';
import { signupAction, type ActionResult } from '../../app/auth/actions';

const initialState: ActionResult = { ok: true };

export function SignupForm() {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => signupAction(formData),
    initialState
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="displayName" className="mb-1 block text-sm font-medium text-gray-700">
          Anzeigename (optional)
        </label>
        <input id="displayName" name="displayName" type="text" className="input" placeholder="Max" />
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
          Passwort (min. 8 Zeichen)
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="input"
          placeholder="••••••••"
        />
      </div>
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      <button type="submit" disabled={isPending} className="btn-primary w-full">
        {isPending ? 'Erstelle Account…' : 'Account erstellen'}
      </button>
    </form>
  );
}

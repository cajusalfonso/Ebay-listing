import Link from 'next/link';
import { SignupForm } from '../../../components/forms/SignupForm';

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-2 inline-flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-900">eBay</span>
            <span className="text-2xl font-bold text-brand-600">Volume</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Account erstellen</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create your workspace. Your credentials are encrypted at rest.
          </p>
        </div>
        <div className="card">
          <SignupForm />
        </div>
        <p className="mt-6 text-center text-sm text-gray-600">
          Schon einen Account?{' '}
          <Link href="/auth/login" className="font-medium text-brand-600 hover:text-brand-700">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

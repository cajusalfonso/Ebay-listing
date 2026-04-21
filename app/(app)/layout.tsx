import { redirect } from 'next/navigation';
import { auth } from '../../lib/auth';
import { Sidebar } from '../../components/layout/Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect('/auth/login');
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar userEmail={session.user.email ?? ''} />
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}

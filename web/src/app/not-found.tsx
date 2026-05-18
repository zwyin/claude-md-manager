import Link from 'next/link';
import zh from '@/i18n/zh';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <span className="text-2xl font-bold text-muted-foreground">404</span>
      </div>
      <h2 className="text-lg font-semibold">{zh['notFound.title']}</h2>
      <p className="text-sm text-muted-foreground">{zh['notFound.description']}</p>
      <Link
        href="/"
        className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {zh['notFound.backDashboard']}
      </Link>
    </div>
  );
}

export function PageLoader({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      {message && <span className="ml-3 text-muted-foreground text-sm">{message}</span>}
    </div>
  );
}

export function PageError({ message }: { message: string }) {
  return (
    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm">
      {message}
    </div>
  );
}

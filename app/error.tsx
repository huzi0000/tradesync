'use client';

import { useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { AlertCircle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex items-center justify-center min-h-screen bg-[#F3F0E9] p-4">
        <div className="flex flex-col items-center text-center max-w-md">
          <div className="w-12 h-12 rounded-full bg-white border border-[#EDCCC5] flex items-center justify-center mb-4">
            <AlertCircle size={22} className="text-[#BA6249]" />
          </div>
          <h2 className="text-lg font-semibold text-[#1B2428] mb-2">Something went wrong</h2>
          <p className="text-sm text-[#7D8A89] mb-6 leading-relaxed">
            An unexpected error occurred. This may be a temporary issue with the RPC connection
            or a network problem.
          </p>
          {error.digest && (
            <p className="text-xs text-[#7D8A89] font-mono mb-4">Error ID: {error.digest}</p>
          )}
          <Button onClick={reset} variant="outline">
            Try Again
          </Button>
        </div>
      </body>
    </html>
  );
}

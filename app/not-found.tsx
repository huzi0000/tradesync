import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <p className="text-6xl font-mono font-bold text-[#DEDCD5] mb-4">404</p>
      <h2 className="text-lg font-semibold text-[#1B2428] mb-2">Page not found</h2>
      <p className="text-sm text-[#7D8A89] mb-6 max-w-sm">
        The page you're looking for doesn't exist.
      </p>
      <Link
        href="/"
        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#1B2428] border border-[#1B2428] rounded hover:bg-[#2C3A40] transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}

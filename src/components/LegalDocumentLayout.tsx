import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { LEGAL_LAST_UPDATED, SITE_NAME } from '../legal/config';

type LegalDocumentLayoutProps = {
  title: string;
  children: ReactNode;
};

export function LegalDocumentLayout({ title, children }: LegalDocumentLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="border-b border-gray-200/80 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to app
          </Link>
          <div className="flex items-center gap-2 text-gray-900">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">{SITE_NAME}</span>
          </div>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <header className="mb-10">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: {LEGAL_LAST_UPDATED}</p>
        </header>
        <div className="legal-prose space-y-8 text-gray-700 text-[15px] leading-relaxed">
          {children}
        </div>
      </article>
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { Check, X, AlertTriangle, ExternalLink, Rocket, Eye } from 'lucide-react';
// Types duplicated locally — importing from a 'use server' file (even as `type`)
// can trigger Server Action bundler quirks that show up as generic error digests.
interface ListingActionResult {
  ok: boolean;
  error?: string;
  preview?: PreviewData;
  publish?: PublishOutcome;
}

interface PreviewData {
  title: string;
  brand: string | null;
  primarySource: string;
  qualityScore: number;
  suggestedCategoryId: string | null;
  imageCount: number;
  compliance: {
    passed: boolean;
    blockers: readonly string[];
    warnings: readonly string[];
  };
  market: {
    competitorCount: number;
    lowestPriceEur: number | null;
    medianPriceEur: number | null;
    searchUrl: string;
  };
  pricing: {
    decision: 'list' | 'skip' | 'manual_review';
    reason: string;
    recommendedPriceGross: number;
    marketPosition: string;
    profitEur: number;
    marginPercent: number;
  };
}

interface PublishOutcome {
  published: boolean;
  listingId: string | null;
  listingUrl: string | null;
  sku: string | null;
  failureReason: string | null;
}

type Result = ListingActionResult;

function formatEur(value: number | null): string {
  if (value === null) return '—';
  return `€${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function PreviewView({ preview }: { preview: NonNullable<Result['preview']> }) {
  const decisionColor =
    preview.pricing.decision === 'list'
      ? 'text-brand-700 bg-brand-50 border-brand-200'
      : preview.pricing.decision === 'skip'
        ? 'text-red-700 bg-red-50 border-red-200'
        : 'text-amber-700 bg-amber-50 border-amber-200';

  return (
    <div className="mt-6 space-y-4">
      <div className="card">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Product</p>
        <h3 className="mt-1 text-lg font-semibold text-gray-900">{preview.title}</h3>
        <p className="mt-1 text-sm text-gray-500">
          {preview.brand ?? 'no brand'} · primary source{' '}
          <span className="font-medium">{preview.primarySource}</span> · quality{' '}
          {preview.qualityScore}/100 · {preview.imageCount} images
        </p>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Compliance</h3>
          {preview.compliance.passed ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
              <Check size={12} /> passed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
              <X size={12} /> blocked
            </span>
          )}
        </div>
        {preview.compliance.blockers.length > 0 ? (
          <ul className="space-y-1 text-sm text-red-700">
            {preview.compliance.blockers.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <X size={14} className="mt-0.5 shrink-0" />
                <code className="rounded bg-red-50 px-1 text-xs">{b}</code>
              </li>
            ))}
          </ul>
        ) : null}
        {preview.compliance.warnings.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-amber-700">
            {preview.compliance.warnings.map((w) => (
              <li key={w} className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <code className="rounded bg-amber-50 px-1 text-xs">{w}</code>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Market (eBay.de Browse)</h3>
          <a
            href={preview.market.searchUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
          >
            open search <ExternalLink size={12} />
          </a>
        </div>
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-xs text-gray-500">Competitors</dt>
            <dd className="font-medium text-gray-900">{preview.market.competitorCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Lowest price</dt>
            <dd className="font-medium text-gray-900">
              {formatEur(preview.market.lowestPriceEur)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Median price</dt>
            <dd className="font-medium text-gray-900">
              {formatEur(preview.market.medianPriceEur)}
            </dd>
          </div>
        </dl>
      </div>

      <div className={`card ${decisionColor} border`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Pricing Decision</h3>
          <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-medium uppercase">
            {preview.pricing.decision}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <dt className="text-xs opacity-75">Recommended price</dt>
            <dd className="text-lg font-bold">
              {formatEur(preview.pricing.recommendedPriceGross)}
            </dd>
          </div>
          <div>
            <dt className="text-xs opacity-75">Profit</dt>
            <dd className="text-lg font-bold">{formatEur(preview.pricing.profitEur)}</dd>
          </div>
          <div>
            <dt className="text-xs opacity-75">Margin</dt>
            <dd className="text-lg font-bold">{formatPercent(preview.pricing.marginPercent)}</dd>
          </div>
          <div>
            <dt className="text-xs opacity-75">Position</dt>
            <dd className="text-lg font-bold">{preview.pricing.marketPosition}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs opacity-75">
          Reason: <code className="rounded bg-white/60 px-1">{preview.pricing.reason}</code>
        </p>
      </div>
    </div>
  );
}

function PublishOutcomeView({ publish }: { publish: NonNullable<Result['publish']> }) {
  if (publish.published && publish.listingUrl) {
    return (
      <div className="mt-4 rounded-md border border-brand-200 bg-brand-50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Check className="text-brand-600" size={18} />
          <h3 className="text-sm font-semibold text-brand-700">Listing published!</h3>
        </div>
        <p className="mb-3 text-sm text-brand-700">
          SKU: <code className="rounded bg-white px-1 text-xs">{publish.sku}</code>
        </p>
        <a
          href={publish.listingUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
        >
          View on eBay <ExternalLink size={14} />
        </a>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <X className="text-red-600" size={18} />
        <h3 className="text-sm font-semibold text-red-700">Publish failed</h3>
      </div>
      <p className="text-sm text-red-700">
        {publish.failureReason ?? 'Unknown error — check server logs.'}
      </p>
    </div>
  );
}

export function CreateListingForm() {
  const [result, setResult] = useState<Result>({ ok: true });
  const [isPending, startTransition] = useTransition();

  const submit = (ean: string, cogs: string, publish: boolean) => {
    startTransition(async () => {
      try {
        const response = await fetch('/api/listings/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ean, cogs: Number(cogs), publish }),
        });
        const json = (await response.json()) as Result;
        setResult(json);
      } catch (error) {
        setResult({
          ok: false,
          error: `Request failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    });
  };

  return (
    <div>
      <form
        className="card space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const ean = (form.elements.namedItem('ean') as HTMLInputElement).value;
          const cogs = (form.elements.namedItem('cogs') as HTMLInputElement).value;
          const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          const publish = submitter?.name === 'publish';
          submit(ean, cogs, publish);
        }}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="ean" className="mb-1 block text-sm font-medium text-gray-700">
              EAN / GTIN
            </label>
            <input
              id="ean"
              name="ean"
              type="text"
              required
              pattern="\d{8,14}"
              className="input"
              placeholder="4006381333115"
            />
          </div>
          <div>
            <label htmlFor="cogs" className="mb-1 block text-sm font-medium text-gray-700">
              COGS (EUR, net)
            </label>
            <input
              id="cogs"
              name="cogs"
              type="number"
              step="0.01"
              min="0.01"
              required
              className="input"
              placeholder="5.50"
            />
          </div>
        </div>

        {result.error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {result.error}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            <span className="font-medium">Preview</span> runs enrichment + compliance + market +
            pricing.{' '}
            <span className="font-medium">Publish</span> creates the actual listing on eBay
            Sandbox.
          </p>
          <div className="flex items-center gap-2">
            <button type="submit" name="preview" disabled={isPending} className="btn-secondary">
              <Eye size={16} />
              {isPending ? 'Running…' : 'Preview'}
            </button>
            <button type="submit" name="publish" disabled={isPending} className="btn-primary">
              <Rocket size={16} />
              {isPending ? 'Running…' : 'Publish'}
            </button>
          </div>
        </div>
      </form>

      {result.publish ? <PublishOutcomeView publish={result.publish} /> : null}
      {result.preview ? <PreviewView preview={result.preview} /> : null}
    </div>
  );
}

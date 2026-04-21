import type { PublishEvent } from './types';

/** Discord color int = 0xRRGGBB as a decimal. */
const COLOR_GREEN = 0x2ecc71;
const COLOR_YELLOW = 0xf1c40f;
const COLOR_RED = 0xe74c3c;
const COLOR_GRAY = 0x95a5a6;

const TITLE_MAX_LEN = 256;

export interface DiscordEmbed {
  readonly title: string;
  readonly url?: string;
  readonly color: number;
  readonly fields: readonly {
    readonly name: string;
    readonly value: string;
    readonly inline: boolean;
  }[];
  readonly footer: { readonly text: string };
  readonly timestamp: string;
}

export interface DiscordWebhookPayload {
  readonly embeds: readonly DiscordEmbed[];
  readonly username?: string;
}

function truncateTitle(title: string): string {
  if (title.length <= TITLE_MAX_LEN) return title;
  return `${title.slice(0, TITLE_MAX_LEN - 1)}…`;
}

function formatEur(value: number): string {
  return `€${value.toFixed(2)}`;
}

function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(2)}%`;
}

function pickColor(event: PublishEvent): number {
  if (event.status === 'failed') return COLOR_RED;
  if (event.status === 'would_publish_dry_run') return COLOR_GRAY;
  return event.marketPosition === 'cheapest' ? COLOR_GREEN : COLOR_YELLOW;
}

function statusPrefix(event: PublishEvent): string {
  switch (event.status) {
    case 'published':
      return event.environment === 'production' ? '🟢 Live' : '🧪 Sandbox';
    case 'would_publish_dry_run':
      return '🔍 Dry Run';
    case 'failed':
      return '❌ Failed';
    default:
      return '';
  }
}

interface MutableField {
  name: string;
  value: string;
  inline: boolean;
}

/** Build the Discord embed payload from a publish event. Pure, no I/O. */
export function buildEmbedPayload(event: PublishEvent): DiscordWebhookPayload {
  const fields: MutableField[] = [
    { name: 'EAN', value: event.ean, inline: true },
    { name: 'Kategorie', value: `${event.categoryName} (${event.categoryId})`, inline: true },
    { name: 'COGS', value: formatEur(event.cogsEur), inline: true },
    { name: 'Sell Price', value: formatEur(event.sellPriceGrossEur), inline: true },
    {
      name: 'Profit / Margin',
      value: `${formatEur(event.profitEur)} / ${formatPercent(event.marginPercent)}`,
      inline: true,
    },
    {
      name: 'Competitors',
      value:
        event.competitorCount === 0
          ? '0 (no competition on eBay.de)'
          : `${event.competitorCount} · lowest ${
              event.lowestCompetitorEur === null ? 'n/a' : formatEur(event.lowestCompetitorEur)
            }`,
      inline: true,
    },
    { name: 'Market Position', value: event.marketPosition, inline: true },
    { name: 'eBay Search', value: `[open search](${event.ebaySearchUrl})`, inline: false },
  ];

  if (event.ebayListingUrl) {
    fields.push({
      name: 'eBay Listing',
      value: `[open listing](${event.ebayListingUrl})`,
      inline: false,
    });
  }

  if (event.failureReason) {
    fields.push({ name: 'Failure reason', value: event.failureReason, inline: false });
  }

  const embed: DiscordEmbed = {
    title: `${statusPrefix(event)} · ${truncateTitle(event.title)}`,
    color: pickColor(event),
    fields,
    footer: { text: `Environment: ${event.environment}` },
    timestamp: new Date().toISOString(),
    ...(event.ebayListingUrl ? { url: event.ebayListingUrl } : {}),
  };

  return {
    embeds: [embed],
    username: 'eBay Volume Tool',
  };
}

import { request } from 'undici';
import { HTTP_TIMEOUTS } from '../../config/constants';
import { buildEmbedPayload } from './embed';
import { DiscordError } from './errors';
import type { Notifier, PublishEvent } from './types';

export interface WebhookNotifierConfig {
  readonly webhookUrl: string;
  /** When `true`, the notifier prints to stdout and skips the HTTP POST. */
  readonly dryRun?: boolean;
  /** Called instead of `console.log` for dry-run output — inject for tests. */
  readonly printer?: (line: string) => void;
}

/**
 * Discord webhook notifier. On publish:
 *   - Builds the embed payload via `buildEmbedPayload`
 *   - POSTs to the webhook URL (unless `dryRun` is true)
 *   - Throws `DiscordError` on 4xx/5xx — caller logs; failure to notify
 *     does not roll back the eBay listing (already live).
 *
 * Dry-run mode prints the JSON payload to stdout for manual inspection —
 * useful when testing the list-product flow locally without actually posting.
 */
export function createDiscordNotifier(config: WebhookNotifierConfig): Notifier {
  const print = config.printer ?? ((line: string) => process.stdout.write(`${line}\n`));

  return {
    name: 'discord_webhook',

    async publishEvent(event: PublishEvent) {
      const payload = buildEmbedPayload(event);

      if (config.dryRun) {
        print('[Discord dry-run] Would send webhook payload:');
        print(JSON.stringify(payload, null, 2));
        return;
      }

      const { statusCode, body } = await request(config.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        bodyTimeout: HTTP_TIMEOUTS.default,
        headersTimeout: HTTP_TIMEOUTS.default,
      });

      // Discord returns 204 on success.
      if (statusCode >= 200 && statusCode < 300) {
        await body.dump();
        return;
      }

      const responseText = await body.text();
      throw new DiscordError(`Discord webhook returned HTTP ${statusCode}`, {
        statusCode,
        responseText: responseText.slice(0, 500),
      });
    },
  };
}

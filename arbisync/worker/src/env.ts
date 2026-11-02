/**
 * Alle Werte aus .env (lokal) bzw. Cloudflare-Secrets (live).
 * Erklärung jeder Variable: siehe .env.example
 */
export interface Env {
  DB: D1Database;
  API_KEY?: string;
  DASHBOARD_PASSWORD?: string;
  DATA_PROVIDER?: string;
  DRY_RUN?: string;
  EBAY_ENV?: string;
  EBAY_CLIENT_ID?: string;
  EBAY_CLIENT_SECRET?: string;
  EBAY_RU_NAME?: string;
  EBAY_REFRESH_TOKEN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  KEEPA_API_KEY?: string;
  KEEPA_TOKENS_PER_MIN?: string;
  MAX_PRICE_AGE_HOURS?: string;
}

export interface AppConfig {
  dataProvider: 'extension' | 'keepa';
  /** Standard: true. Nur der exakte Wert "false" schaltet echtes Pushen zu eBay ein. */
  dryRun: boolean;
  ebayEnv: 'sandbox' | 'production';
  keepaTokensPerMin: number;
}

export const MIN_API_KEY_LENGTH = 32;

export function readConfig(env: Env): AppConfig {
  const provider = (env.DATA_PROVIDER ?? 'extension').trim().toLowerCase();
  if (provider !== 'extension' && provider !== 'keepa') {
    throw new Error(`DATA_PROVIDER muss "extension" oder "keepa" sein, ist aber "${env.DATA_PROVIDER}".`);
  }
  const ebayEnv = (env.EBAY_ENV ?? 'sandbox').trim().toLowerCase();
  if (ebayEnv !== 'sandbox' && ebayEnv !== 'production') {
    throw new Error(`EBAY_ENV muss "sandbox" oder "production" sein, ist aber "${env.EBAY_ENV}".`);
  }
  const tokens = Number(env.KEEPA_TOKENS_PER_MIN ?? '20');
  return {
    dataProvider: provider,
    dryRun: (env.DRY_RUN ?? 'true').trim().toLowerCase() !== 'false',
    ebayEnv,
    keepaTokensPerMin: Number.isFinite(tokens) && tokens > 0 ? tokens : 20,
  };
}

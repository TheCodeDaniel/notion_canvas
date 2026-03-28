// src/utils/token-check.ts
export function checkFigmaPATExpiry(): void {
  const expiryStr = process.env.FIGMA_PAT_EXPIRES;
  if (!expiryStr) return;

  const expiry = new Date(expiryStr);
  const daysLeft = Math.floor((expiry.getTime() - Date.now()) / 86_400_000);

  if (daysLeft <= 0) {
    console.error('[NotionCanvas] ❌ FIGMA_ACCESS_TOKEN has expired.');
    console.error('   Regenerate at: figma.com → Settings → Security → Personal access tokens');
    process.exit(1);
  } else if (daysLeft <= 14) {
    console.warn(`[NotionCanvas] ⚠️  Figma PAT expires in ${daysLeft} days. Please regenerate soon.`);
  }
}

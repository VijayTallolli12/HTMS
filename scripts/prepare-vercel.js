/**
 * Enterprise HMS — Vercel Deployment Preparation Script
 *
 * Injects the production backend origin into vercel.json rewrites
 * using the BACKEND_API_URL environment variable prior to deployment.
 *
 * Usage:
 *   BACKEND_API_URL=https://api.yourdomain.com node scripts/prepare-vercel.js
 */

const fs = require('fs');
const path = require('path');

const vercelConfigPath = path.resolve(__dirname, '../vercel.json');

if (!fs.existsSync(vercelConfigPath)) {
  console.error('[prepare-vercel] Error: vercel.json not found at', vercelConfigPath);
  process.exit(1);
}

const rawBackendUrl = process.env.BACKEND_API_URL;

if (!rawBackendUrl || !rawBackendUrl.trim()) {
  console.log('[prepare-vercel] Notice: BACKEND_API_URL environment variable is not set.');
  console.log('[prepare-vercel] vercel.json retains the placeholder: https://YOUR_BACKEND_API_URL');
  console.log('[prepare-vercel] Set BACKEND_API_URL in your deployment pipeline or Vercel settings if proxying /api/* requests.');
  process.exit(0);
}

const sanitizedBackendUrl = rawBackendUrl.trim().replace(/\/+$/, '');

try {
  const config = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));

  if (Array.isArray(config.rewrites)) {
    let updated = false;
    for (const rewrite of config.rewrites) {
      if (rewrite.source === '/api/:path*' && typeof rewrite.destination === 'string') {
        rewrite.destination = `${sanitizedBackendUrl}/api/:path*`;
        updated = true;
      }
    }

    if (updated) {
      fs.writeFileSync(vercelConfigPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
      console.log(`[prepare-vercel] Successfully configured /api proxy destination: ${sanitizedBackendUrl}/api/:path*`);
    } else {
      console.warn('[prepare-vercel] Warning: Could not find /api/:path* rewrite rule in vercel.json');
    }
  }
} catch (err) {
  console.error('[prepare-vercel] Failed to update vercel.json:', err);
  process.exit(1);
}

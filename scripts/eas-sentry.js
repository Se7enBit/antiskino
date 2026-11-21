// Before an EAS app build: readable stack traces in Sentry. With
// SENTRY_AUTH_TOKEN set, this checkout's app.json (never committed) gets
// Sentry's Expo plugin, whose build step uploads the app's source maps, and the
// token is stored as a secret EAS environment variable of the build profile's
// environment, where the build reads it. Without the token nothing changes and
// the build uploads nothing.
// SENTRY_PROJECT (default antiskino) and SENTRY_ORG come from the environment;
// an organization token already names its organization and region.
// Usage: node scripts/eas-sentry.js <eas environment: preview | production>
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const log = (message) => process.stdout.write(`${message}\n`);

const PLUGIN = '@sentry/react-native/expo';

/**
 * The Expo config with Sentry's plugin for this organization and project.
 * @param {{ expo: { plugins?: unknown[] } & Record<string, unknown> }} appJson
 * @param {{ organization?: string, project: string }} names
 */
function withSentryPlugin(appJson, { organization, project }) {
  const options = { project, ...(organization ? { organization } : {}) };
  const plugins = (appJson.expo.plugins ?? []).filter(
    (plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) !== PLUGIN,
  );
  return { ...appJson, expo: { ...appJson.expo, plugins: [...plugins, [PLUGIN, options]] } };
}

function main() {
  const environment = process.argv[2];
  if (!environment) {
    console.error('Usage: node scripts/eas-sentry.js <eas environment>');
    process.exit(1);
  }
  const token = process.env.SENTRY_AUTH_TOKEN;
  if (!token) {
    log('SENTRY_AUTH_TOKEN is not set: this build uploads no source maps to Sentry.');
    return;
  }
  // The value only travels to EAS; nothing is printed.
  execFileSync(
    'eas',
    [
      'env:set',
      '--environment',
      environment,
      '--name',
      'SENTRY_AUTH_TOKEN',
      '--value',
      token,
      '--visibility',
      'secret',
      '--non-interactive',
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  const file = path.join(process.cwd(), 'app.json');
  const appJson = JSON.parse(fs.readFileSync(file, 'utf8'));
  const config = withSentryPlugin(appJson, {
    organization: process.env.SENTRY_ORG || undefined,
    project: process.env.SENTRY_PROJECT || 'antiskino',
  });
  fs.writeFileSync(file, JSON.stringify(config, null, 2));
  log(`Sentry source maps: on (EAS environment ${environment}).`);
}

if (require.main === module) main();

module.exports = { withSentryPlugin };

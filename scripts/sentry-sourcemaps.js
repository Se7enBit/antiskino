// After `expo export -p web --source-maps`: readable stack traces in Sentry.
// With SENTRY_AUTH_TOKEN set, the bundles (in _expo/) get Sentry's debug ID
// snippet (sentry-cli sourcemaps inject) and their source maps are uploaded;
// Sentry matches error reports to the maps by that ID. Expo already marks each
// bundle with a `//# debugId=` comment but without the snippet the browser SDK
// reads, and sentry-cli skips marked files, so the comments are removed first:
// sentry-cli then reuses the ID already in each map. Either way the .map files
// are deleted afterwards, so the published site never serves the source.
// SENTRY_ORG and SENTRY_PROJECT come from the environment (an organization
// token already names its organization and region). A failed upload only warns:
// the website is published anyway.
// Usage: node scripts/sentry-sourcemaps.js <export folder>
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const log = (message) => process.stdout.write(`${message}\n`);

/**
 * Every file under the folder whose name ends with the suffix.
 * @param {string} dir
 * @param {string} suffix
 * @returns {string[]}
 */
function filesEndingWith(dir, suffix) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesEndingWith(file, suffix);
    return entry.name.endsWith(suffix) ? [file] : [];
  });
}

/**
 * The bundle without Expo's `//# debugId=` line.
 * @param {string} source
 */
function withoutDebugIdComment(source) {
  return source.replace(/^\/\/# debugId=.*(\r?\n)?/gm, '');
}

/** The sentry-cli binary of the project in the current folder, if installed. */
function sentryCli() {
  try {
    return require.resolve('@sentry/cli/bin/sentry-cli', { paths: [process.cwd()] });
  } catch {
    return null;
  }
}

function upload(bundles) {
  const cli = sentryCli();
  if (!cli) {
    log('::warning::@sentry/cli is not installed: no source maps uploaded.');
    return;
  }
  for (const file of filesEndingWith(bundles, '.js')) {
    fs.writeFileSync(file, withoutDebugIdComment(fs.readFileSync(file, 'utf8')));
  }
  // Unset Actions variables arrive as empty strings, which sentry-cli would use.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name, value]) => !name.startsWith('SENTRY_') || value),
  );
  try {
    execFileSync(process.execPath, [cli, 'sourcemaps', 'inject', bundles], {
      stdio: 'inherit',
      env,
    });
    execFileSync(process.execPath, [cli, 'sourcemaps', 'upload', bundles], {
      stdio: 'inherit',
      env,
    });
  } catch {
    log(
      '::warning::Uploading the source maps to Sentry failed: check SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT. The site is published anyway.',
    );
  }
}

function main() {
  const dir = process.argv[2];
  if (!dir || !fs.existsSync(dir)) {
    console.error('Usage: node scripts/sentry-sourcemaps.js <export folder>');
    process.exit(1);
  }
  const bundles = path.join(dir, '_expo');
  if (!process.env.SENTRY_AUTH_TOKEN) {
    log('SENTRY_AUTH_TOKEN is not set: no source maps uploaded.');
  } else if (fs.existsSync(bundles)) {
    upload(bundles);
  }
  const maps = filesEndingWith(dir, '.map');
  for (const file of maps) fs.rmSync(file);
  log(`Removed ${maps.length} source map file(s) from ${dir}.`);
}

if (require.main === module) main();

module.exports = { filesEndingWith, withoutDebugIdComment };

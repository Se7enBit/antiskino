// Stands in for zod's `locales` export (error messages in ~40 languages, about
// 290 KB) in the app bundles: metro.config.js points zod's import here. The app
// never uses z.locales; zod's own English messages load separately.
export {};

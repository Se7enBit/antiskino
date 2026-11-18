// Expo config plugin: R8 keep rules for Android release builds (app/proguard-rules.pro).
//
// Room creates generated databases by reflection (WorkManager's
// WorkDatabase_Impl, for one). When R8 removed their constructors, the first
// preview APK closed on start ("Failed to create an instance of class
// androidx.work.impl.WorkDatabase"). Keeping them is safe when Room is absent.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const MARKER = '# antiskino keep rules';
const RULES = `${MARKER}
-keep class * extends androidx.room.RoomDatabase { <init>(...); }
`;

/** The rules file with ours added once. */
function addKeepRules(contents) {
  if (contents.includes(MARKER)) return contents;
  return `${contents.trimEnd()}\n\n${RULES}`.trimStart();
}

function withAndroidKeepRules(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const file = path.join(modConfig.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      fs.writeFileSync(file, addKeepRules(current));
      return modConfig;
    },
  ]);
}

module.exports = withAndroidKeepRules;
module.exports.addKeepRules = addKeepRules;

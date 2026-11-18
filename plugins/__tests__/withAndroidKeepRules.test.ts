// eslint-disable-next-line @typescript-eslint/no-require-imports -- the plugin is CommonJS, as Expo loads it
const { addKeepRules } = require('../withAndroidKeepRules') as {
  addKeepRules: (contents: string) => string;
};

describe('Android keep rules', () => {
  it('keeps the constructors of Room databases', () => {
    const rules = addKeepRules('# react-native\n-keep class com.facebook.react.** { *; }\n');
    expect(rules).toContain('-keep class com.facebook.react.** { *; }');
    expect(rules).toContain('-keep class * extends androidx.room.RoomDatabase { <init>(...); }');
  });

  it('adds them once', () => {
    const once = addKeepRules('');
    expect(addKeepRules(once)).toBe(once);
  });
});

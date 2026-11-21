import fs from 'fs';
import os from 'os';
import path from 'path';

import { filesEndingWith, withoutDebugIdComment } from '../sentry-sourcemaps';

describe('sentry source maps post-export step', () => {
  it("removes Expo's debug ID comment and nothing else", () => {
    const bundle =
      '__d(function(){},1,[]);\n//# sourceMappingURL=/a.js.map\n//# debugId=ee836fe4-da2b-4e7d-9711-199089ed2823\n';
    expect(withoutDebugIdComment(bundle)).toBe(
      '__d(function(){},1,[]);\n//# sourceMappingURL=/a.js.map\n',
    );
    expect(withoutDebugIdComment('const s = "//# debugId=x";\n')).toBe(
      'const s = "//# debugId=x";\n',
    );
  });

  it('finds the source maps in nested folders', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maps-'));
    fs.mkdirSync(path.join(dir, '_expo', 'web'), { recursive: true });
    for (const file of ['index.html', '_expo/web/a.js', '_expo/web/a.js.map', 'b.js.map']) {
      fs.writeFileSync(path.join(dir, file), '');
    }
    expect(
      filesEndingWith(dir, '.map')
        .map((file) => path.relative(dir, file))
        .sort(),
    ).toEqual([path.join('_expo', 'web', 'a.js.map'), 'b.js.map']);
    fs.rmSync(dir, { recursive: true });
  });
});

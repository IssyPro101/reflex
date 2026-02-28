import { evaluateChangedFiles } from './file-safety';

describe('evaluateChangedFiles', () => {
  it('flags forbidden files', () => {
    const result = evaluateChangedFiles([
      '.env',
      '.github/workflows/release.yml',
      'src/app.ts',
      'docker-compose.prod.yml',
    ]);

    expect(result.forbidden).toEqual(
      expect.arrayContaining([
        '.env',
        '.github/workflows/release.yml',
        'docker-compose.prod.yml',
      ]),
    );
  });

  it('flags soft warning files', () => {
    const result = evaluateChangedFiles([
      'src/auth/service.ts',
      'migrations/002_add_table.sql',
      'package-lock.json',
    ]);

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'src/auth/service.ts',
        'migrations/002_add_table.sql',
        'package-lock.json',
      ]),
    );
  });
});

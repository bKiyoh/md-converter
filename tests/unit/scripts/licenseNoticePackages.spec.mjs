import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  collectNoticePackages,
  loadInstalledPackageMetadata,
} from '../../../scripts/license-notice-packages.mjs'

const temporaryDirectories = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function createTemporaryProject() {
  const directory = mkdtempSync(join(tmpdir(), 'md-converter-licenses-'))
  temporaryDirectories.push(directory)
  return directory
}

describe('license notice package selection', () => {
  it('optional依存をOSやCPUの指定有無にかかわらず決定的に除外する', () => {
    const lock = {
      packages: {
        '': { version: '0.1.0' },
        'node_modules/required-package': {
          version: '1.0.0',
          license: 'MIT',
        },
        'node_modules/platform-optional-package': {
          version: '2.0.0',
          license: 'MIT',
          optional: true,
          os: ['win32'],
          cpu: ['x64'],
        },
        'node_modules/helper-optional-package': {
          version: '3.0.0',
          license: 'MIT',
          optional: true,
        },
      },
    }

    const result = collectNoticePackages(lock)

    expect(result.packages.map((packageEntry) => packageEntry.name)).toEqual([
      'required-package',
    ])
    expect(result.excludedOptionalPackageCount).toBe(2)
  })

  it('対象依存のメタデータが未インストールの場合は明示的に失敗する', () => {
    const projectRoot = createTemporaryProject()

    expect(() =>
      loadInstalledPackageMetadata(
        projectRoot,
        'node_modules/required-package',
        '1.0.0',
      ),
    ).toThrowError(/Run npm ci/)
  })

  it('インストール済みバージョンがlockfileと異なる場合は明示的に失敗する', () => {
    const projectRoot = createTemporaryProject()
    const packageDirectory = join(
      projectRoot,
      'node_modules',
      'required-package',
    )
    mkdirSync(packageDirectory, { recursive: true })
    writeFileSync(
      join(packageDirectory, 'package.json'),
      JSON.stringify({ name: 'required-package', version: '2.0.0' }),
      'utf8',
    )

    expect(() =>
      loadInstalledPackageMetadata(
        projectRoot,
        'node_modules/required-package',
        '1.0.0',
      ),
    ).toThrowError(/expected 1\.0\.0, found 2\.0\.0/)
  })
})

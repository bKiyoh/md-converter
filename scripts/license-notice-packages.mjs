import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function getPackageName(packagePath) {
  const packageSuffix = packagePath.split('node_modules/').at(-1)
  const pathParts = packageSuffix.split('/')

  return pathParts[0].startsWith('@')
    ? pathParts.slice(0, 2).join('/')
    : pathParts[0]
}

export function collectNoticePackages(lock) {
  const packagesByIdentity = new Map()
  const excludedOptionalIdentities = new Set()

  for (const [packagePath, lockEntry] of Object.entries(lock.packages)) {
    if (!packagePath.startsWith('node_modules/') || !lockEntry.version) {
      continue
    }

    const name = getPackageName(packagePath)
    const identity = `${name}@${lockEntry.version}`

    if (lockEntry.optional === true) {
      if (!packagesByIdentity.has(identity)) {
        excludedOptionalIdentities.add(identity)
      }
      continue
    }

    excludedOptionalIdentities.delete(identity)
    const existing = packagesByIdentity.get(identity)

    if (existing && (!existing.dev || lockEntry.dev)) {
      continue
    }

    packagesByIdentity.set(identity, {
      name,
      version: lockEntry.version,
      license: lockEntry.license ?? 'NOASSERTION',
      dev: lockEntry.dev === true,
      packagePath,
    })
  }

  return {
    packages: [...packagesByIdentity.values()].sort((left, right) =>
      left.name.localeCompare(right.name, 'en') ||
      left.version.localeCompare(right.version, 'en'),
    ),
    excludedOptionalPackageCount: excludedOptionalIdentities.size,
  }
}

export function loadInstalledPackageMetadata(
  projectRoot,
  packagePath,
  expectedVersion,
) {
  const metadataPath = resolve(projectRoot, packagePath, 'package.json')

  if (!existsSync(metadataPath)) {
    throw new Error(
      `Package metadata is missing for ${packagePath}. Run npm ci before generating third-party notices.`,
    )
  }

  const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'))

  if (metadata.version !== expectedVersion) {
    throw new Error(
      `Installed package version does not match package-lock.json for ${packagePath}: expected ${expectedVersion}, found ${metadata.version ?? 'unknown'}. Run npm ci before generating third-party notices.`,
    )
  }

  return metadata
}

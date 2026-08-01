import { createHash } from 'node:crypto'
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lockPath = resolve(projectRoot, 'package-lock.json')
const outputPath = resolve(projectRoot, 'THIRD_PARTY_NOTICES.md')
const checkOnly = process.argv.includes('--check')

const lockText = readFileSync(lockPath, 'utf8')
const lock = JSON.parse(lockText)

function getPackageName(packagePath) {
  const packageSuffix = packagePath.split('node_modules/').at(-1)
  const pathParts = packageSuffix.split('/')

  return pathParts[0].startsWith('@')
    ? pathParts.slice(0, 2).join('/')
    : pathParts[0]
}

function normalizeAuthor(author) {
  if (typeof author === 'string') {
    return author
  }

  if (author && typeof author === 'object') {
    return [author.name, author.email, author.url].filter(Boolean).join(' ')
  }

  return ''
}

function normalizeRepository(repository) {
  const repositoryUrl =
    typeof repository === 'string' ? repository : repository?.url

  return repositoryUrl
    ? repositoryUrl.replace(/^git\+/, '').replace(/\.git$/, '')
    : ''
}

function readPackageMetadata(packagePath, expectedVersion) {
  const metadataPath = resolve(projectRoot, packagePath, 'package.json')

  if (!existsSync(metadataPath)) {
    return null
  }

  const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'))

  return metadata.version === expectedVersion ? metadata : null
}

function readNoticeDocuments(packagePath) {
  const packageDirectory = resolve(projectRoot, packagePath)

  if (!existsSync(packageDirectory)) {
    return []
  }

  return readdirSync(packageDirectory)
    .filter((fileName) =>
      /^(?:licen[cs]e|copying|notice)(?:$|[._-])/i.test(fileName),
    )
    .filter((fileName) => statSync(resolve(packageDirectory, fileName)).isFile())
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map((fileName) => ({
      fileName,
      content: readFileSync(resolve(packageDirectory, fileName), 'utf8')
        .replace(/\r\n/g, '\n')
        .trim(),
    }))
    .filter((document) => document.content.length > 0)
}

function escapeTableCell(value) {
  return String(value)
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>')
}

function createFence(content) {
  const longestRun = Math.max(
    2,
    ...(content.match(/`+/g) ?? []).map((run) => run.length),
  )

  return '`'.repeat(longestRun + 1)
}

const packagesByIdentity = new Map()

for (const [packagePath, lockEntry] of Object.entries(lock.packages)) {
  if (!packagePath.startsWith('node_modules/') || !lockEntry.version) {
    continue
  }

  const name = getPackageName(packagePath)
  const identity = `${name}@${lockEntry.version}`
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

const packages = [...packagesByIdentity.values()].sort((left, right) =>
  left.name.localeCompare(right.name, 'en') ||
  left.version.localeCompare(right.version, 'en'),
)
const documentGroupsByHash = new Map()

for (const packageEntry of packages) {
  const metadata = readPackageMetadata(
    packageEntry.packagePath,
    packageEntry.version,
  )
  const documents = readNoticeDocuments(packageEntry.packagePath)
  const copyrightLines = [
    ...new Set(
      documents.flatMap(({ content }) =>
        content
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => /copyright\s*(?:\(c\)|©)?\s*\d{4}|©\s*\d{4}/i.test(line)),
      ),
    ),
  ]

  packageEntry.author = normalizeAuthor(metadata?.author)
  packageEntry.repository = normalizeRepository(metadata?.repository)
  packageEntry.copyright = copyrightLines.join('; ')
  packageEntry.documentHashes = []

  for (const document of documents) {
    const hash = createHash('sha256').update(document.content).digest('hex')
    const existingGroup = documentGroupsByHash.get(hash)

    if (existingGroup) {
      existingGroup.packages.push({
        identity: `${packageEntry.name}@${packageEntry.version}`,
        fileName: document.fileName,
      })
    } else {
      documentGroupsByHash.set(hash, {
        hash,
        content: document.content,
        packages: [
          {
            identity: `${packageEntry.name}@${packageEntry.version}`,
            fileName: document.fileName,
          },
        ],
      })
    }

    packageEntry.documentHashes.push(hash)
  }
}

const documentGroups = [...documentGroupsByHash.values()].sort((left, right) =>
  left.hash.localeCompare(right.hash, 'en'),
)
const documentIds = new Map(
  documentGroups.map((group, index) => [
    group.hash,
    `N${String(index + 1).padStart(3, '0')}`,
  ]),
)
const productionCount = packages.filter((packageEntry) => !packageEntry.dev).length
const developmentCount = packages.length - productionCount
const lockHash = createHash('sha256').update(lockText).digest('hex')
const lines = [
  '# Third-Party Notices',
  '',
  'This file records third-party packages resolved by `package-lock.json`. It is generated by',
  '`npm run licenses:generate`; verify it with `npm run licenses:check` after dependency changes.',
  '',
  `- Lockfile SHA-256: \`${lockHash}\``,
  `- Production dependency tree: ${productionCount} unique package/version entries`,
  `- Development-only dependency tree: ${developmentCount} unique package/version entries`,
  '',
  '“Production” follows npm lockfile dependency classification conservatively and can include peer',
  'packages used during the build. Development-only packages are not included in the static `dist/`',
  'output, but are listed for repository and build-environment review. This notice covers third-party',
  'materials only and does not grant a license for the Md Converter project itself.',
  '',
  '## Dependency manifest',
  '',
  '| Package | Scope | License | Copyright / author | Full text |',
  '| --- | --- | --- | --- | --- |',
]

for (const packageEntry of packages) {
  const npmUrl = `https://www.npmjs.com/package/${packageEntry.name}/v/${packageEntry.version}`
  const licenseUrl =
    packageEntry.license === 'NOASSERTION'
      ? ''
      : `https://spdx.org/licenses/${encodeURIComponent(packageEntry.license)}.html`
  const identity = `[${packageEntry.name}@${packageEntry.version}](${npmUrl})`
  const license = licenseUrl
    ? `[${packageEntry.license}](${licenseUrl})`
    : packageEntry.license
  const rights =
    packageEntry.copyright ||
    packageEntry.author ||
    'Not stated in installed package metadata or local notice text'
  const documentReferences = packageEntry.documentHashes.length
    ? [...new Set(packageEntry.documentHashes)]
        .map((hash) => `[${documentIds.get(hash)}](#${documentIds.get(hash).toLowerCase()})`)
        .join(', ')
    : packageEntry.repository
      ? `[upstream](${packageEntry.repository})`
      : 'package metadata only'

  lines.push(
    `| ${escapeTableCell(identity)} | ${packageEntry.dev ? 'development only' : 'production'} | ${escapeTableCell(license)} | ${escapeTableCell(rights)} | ${documentReferences} |`,
  )
}

lines.push('', '## License and notice texts', '')

for (const group of documentGroups) {
  const documentId = documentIds.get(group.hash)
  const appliesTo = group.packages
    .sort((left, right) =>
      left.identity.localeCompare(right.identity, 'en') ||
      left.fileName.localeCompare(right.fileName, 'en'),
    )
    .map(({ identity, fileName }) => `${identity} (${fileName})`)
    .join(', ')
  const fence = createFence(group.content)

  lines.push(
    `### ${documentId}`,
    '',
    `Applies to: ${appliesTo}`,
    '',
    `${fence}text`,
    group.content,
    fence,
    '',
  )
}

const generated = `${lines.join('\n').trimEnd()}\n`

if (checkOnly) {
  const current = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : ''

  if (current !== generated) {
    console.error(
      'THIRD_PARTY_NOTICES.md is out of date. Run npm run licenses:generate.',
    )
    process.exitCode = 1
  } else {
    console.log(`THIRD_PARTY_NOTICES.md is current (${packages.length} packages).`)
  }
} else {
  writeFileSync(outputPath, generated, 'utf8')
  console.log(
    `Generated THIRD_PARTY_NOTICES.md for ${packages.length} packages and ${documentGroups.length} unique notice texts.`,
  )
}

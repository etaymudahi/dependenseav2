# Dependensea V2

A production-grade Node.js CLI tool designed to recursively download and localize NPM dependencies for air-gapped environments.

## Features

- **Visual Enhancements**: Beautiful ASCII banner and smooth loading spinners for a premium CLI experience.
- **Recursive Resolution**: Parses `package-lock.json` (v1, v2, v3) to identify all sub-dependencies.
- **Concurrency Control**: Downloads artifacts in parallel with a configurable limit (default: 10) using `p-limit`.
- **Integrity Verification**: Validates the SHA integrity of every downloaded `.tgz` file using `ssri`.
- **Conflict Handling**: Renames files to `name-version.tgz` to safely handle multiple versions of the same package.
- **Robust**: Retries and error handling (basic) included.

## Installation

```bash
git clone https://github.com/etaymudahi/dependenseav2.git
cd dependenseav2
npm install
npm run build
```

## Usage

DepSea provides three main commands: `download`, `download-package`, and `publish`.

### Download (from lockfile)
Recursively downloads dependencies from a package-lock.json.

```bash
# Syntax
depsea download <path-to-lockfile> [output-directory] [options]

# Example
depsea download ./package-lock.json ./my-offline-repo --concurrency 20
```

### Download Package
Downloads dependencies for a specific package by generating a temporary lockfile. Useful when you don't have a `package-lock.json` handy.

```bash
# Syntax
depsea download-package <package-name> [output-directory] [options]

# Example
depsea download-package is-odd ./package-downloads
```

### Publish
Publishes all `.tgz` files from a directory to the configured NPM registry (uses your `.npmrc`).

```bash
# Syntax
depsea publish [directory-with-tgzs] [options]

# Example
depsea publish ./my-offline-repo --concurrency 5
```

## CLI Options

### Download Options
| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--concurrency` | `-c` | Number of concurrent downloads | `10` |

### Publish Options
| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--concurrency` | `-c` | Number of concurrent publishes | `5` |

## Development

### Running Tests

```bash
npm test
# or
npx vitest
```

### Build

```bash
npm run build
```

## Packaging

To create a distributable `.tgz` file (tarball) that can be installed globally or in other projects:

1.  **Build the project**:
    ```bash
    npm run build
    ```
2.  **Pack the project**:
    ```bash
    npm pack
    ```

This will generate a file named `dependenseav2-1.0.0.tgz` (version may vary).

You can then install this tarball globally on another machine:

```bash
npm install -g ./dependenseav2-1.0.0.tgz
```

import fs from 'fs';
import { PackageLock, DependencyArtifact, DependencyEntry, PackageEntry } from './types.js';

export class PackageLockParser {
    private artifacts = new Map<string, DependencyArtifact>();

    constructor() {}

    public async parse(filePath: string): Promise<DependencyArtifact[]> {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const lockfile: PackageLock = JSON.parse(content);
        return this.parseLockData(lockfile);
    }

    public parseLockData(lockfile: PackageLock): DependencyArtifact[] {
        if (lockfile.packages) {
            this.parsePackages(lockfile.packages);
        } else if (lockfile.dependencies) {
            this.parseDependencies(lockfile.dependencies);
        } else {
            throw new Error('Invalid package-lock.json: No packages or dependencies found.');
        }

        return Array.from(this.artifacts.values());
    }

    private parsePackages(packages: Record<string, PackageEntry>) {
        for (const [path, entry] of Object.entries(packages)) {
            if (path === '') continue; // Skip root
            if (!entry.resolved || !entry.integrity) continue; // Skip local links or missing info

            const name = this.extractNameFromPath(path);
            const artifact: DependencyArtifact = {
                name: name,
                version: entry.version,
                resolved: entry.resolved,
                integrity: entry.integrity,
                filename: this.generateFilename(name, entry.version)
            };
            
            // Deduplicate by integrity (same content = same file)
            // But wait, if filename logic changes, we might overwrite.
            // Using integrity as key ensures we download unique content.
            if (!this.artifacts.has(entry.integrity)) {
                this.artifacts.set(entry.integrity, artifact);
            }
        }
    }

    private parseDependencies(dependencies: Record<string, DependencyEntry>) {
        for (const [name, entry] of Object.entries(dependencies)) {
            if (entry.resolved && entry.integrity) {
                const artifact: DependencyArtifact = {
                    name,
                    version: entry.version,
                    resolved: entry.resolved,
                    integrity: entry.integrity,
                    filename: this.generateFilename(name, entry.version)
                };

                if (!this.artifacts.has(entry.integrity)) {
                    this.artifacts.set(entry.integrity, artifact);
                }
            }

            if (entry.dependencies) {
                this.parseDependencies(entry.dependencies);
            }
        }
    }

    private extractNameFromPath(path: string): string {
        // "node_modules/lodash" -> "lodash"
        // "node_modules/@types/node" -> "@types/node"
        // "node_modules/a/node_modules/b" -> "b"
        const parts = path.split('node_modules/');
        return parts[parts.length - 1];
    }

    private generateFilename(name: string, version: string): string {
        // "lodash", "4.17.21" -> "lodash-4.17.21.tgz"
        // "@types/node", "1.0.0" -> "@types-node-1.0.0.tgz"
        const safeName = name.replace(/\//g, '-').replace(/@/g, '');
        return `${safeName}-${version}.tgz`;
    }
}

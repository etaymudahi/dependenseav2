export interface DependencyArtifact {
    name: string;
    version: string;
    resolved: string;
    integrity: string;
    filename: string;
}

export interface PackageLock {
    name: string;
    version: string;
    lockfileVersion: number;
    packages?: Record<string, PackageEntry>; // Lockfile v2/v3
    dependencies?: Record<string, DependencyEntry>; // Lockfile v1
}

export interface PackageEntry {
    version: string;
    resolved?: string;
    integrity?: string;
    dependencies?: Record<string, string>;
}

export interface DependencyEntry {
    version: string;
    resolved?: string;
    integrity?: string;
    requires?: Record<string, string>;
    dependencies?: Record<string, DependencyEntry>;
}

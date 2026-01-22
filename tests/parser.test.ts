import { describe, it, expect, beforeEach } from 'vitest';
import { PackageLockParser } from '../src/parser.js';
import { PackageLock } from '../src/types.js';

describe('PackageLockParser', () => {
    let parser: PackageLockParser;

    beforeEach(() => {
        parser = new PackageLockParser();
    });

    it('should parse lockfile v2/v3 packages correctly', () => {
        const lockfile: PackageLock = {
            name: 'test-project',
            version: '1.0.0',
            lockfileVersion: 2,
            packages: {
                '': { version: '1.0.0' },
                'node_modules/lodash': {
                    version: '4.17.21',
                    resolved: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
                    integrity: 'sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg=='
                },
                'node_modules/foo': {
                    version: '1.0.0',
                    resolved: 'https://registry.npmjs.org/foo/-/foo-1.0.0.tgz',
                    integrity: 'sha512-foo'
                }
            }
        };

        const artifacts = parser.parseLockData(lockfile);
        expect(artifacts).toHaveLength(2);
        
        const lodash = artifacts.find(a => a.name === 'lodash');
        expect(lodash).toBeDefined();
        expect(lodash?.version).toBe('4.17.21');
        expect(lodash?.filename).toBe('lodash-4.17.21.tgz');
    });

    it('should parse lockfile v1 dependencies recursively', () => {
        const lockfile: PackageLock = {
            name: 'test-project',
            version: '1.0.0',
            lockfileVersion: 1,
            dependencies: {
                'a': {
                    version: '1.0.0',
                    resolved: 'https://registry.npmjs.org/a/-/a-1.0.0.tgz',
                    integrity: 'sha512-a',
                    dependencies: {
                        'b': {
                            version: '2.0.0',
                            resolved: 'https://registry.npmjs.org/b/-/b-2.0.0.tgz',
                            integrity: 'sha512-b'
                        }
                    }
                }
            }
        };

        const artifacts = parser.parseLockData(lockfile);
        expect(artifacts).toHaveLength(2);
        expect(artifacts.find(a => a.name === 'a')).toBeDefined();
        expect(artifacts.find(a => a.name === 'b')).toBeDefined();
    });

    it('should deduplicate artifacts with same integrity', () => {
        const lockfile: PackageLock = {
            name: 'test-project',
            version: '1.0.0',
            lockfileVersion: 2,
            packages: {
                '': { version: '1.0.0' },
                'node_modules/a': {
                    version: '1.0.0',
                    resolved: 'https://registry.npmjs.org/a/-/a-1.0.0.tgz',
                    integrity: 'sha512-same'
                },
                'node_modules/nested/node_modules/a': {
                    version: '1.0.0',
                    resolved: 'https://registry.npmjs.org/a/-/a-1.0.0.tgz',
                    integrity: 'sha512-same' // Same integrity, should be deduped
                }
            }
        };

        const artifacts = parser.parseLockData(lockfile);
        expect(artifacts).toHaveLength(1);
        expect(artifacts[0].name).toBe('a');
    });
});

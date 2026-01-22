import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Downloader } from '../src/downloader.js';
import { DependencyArtifact } from '../src/types.js';
import fs from 'fs';
import path from 'path';

// Hoist mock factory
vi.mock('fs', async (importOriginal) => {
    // const actual = await importOriginal<typeof import('fs')>();
    return {
        default: {
            existsSync: vi.fn(),
            createWriteStream: vi.fn(),
            promises: {
                mkdir: vi.fn(),
                writeFile: vi.fn()
            }
        },
        // Also map named exports if needed, but we mostly use default in the code or properties of default
        existsSync: vi.fn(),
        createWriteStream: vi.fn(),
        promises: {
            mkdir: vi.fn(),
            writeFile: vi.fn()
        }
    };
});

// Mock global fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('Downloader', () => {
    let downloader: Downloader;
    const outputDir = '/tmp/tgzs';

    beforeEach(() => {
        downloader = new Downloader(2);
        vi.clearAllMocks();
        
        fetchMock.mockResolvedValue({
            ok: true,
            statusText: 'OK',
            body: 'mock-body',
            arrayBuffer: async () => Buffer.from('mock-content')
        } as any);

        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.createWriteStream).mockReturnValue({
            on: vi.fn(),
            write: vi.fn(),
            end: vi.fn(),
        } as any);
    });

    it('should download artifacts', async () => {
        const artifacts: DependencyArtifact[] = [
            {
                name: 'pkg-a',
                version: '1.0.0',
                resolved: 'https://registry.npmjs.org/pkg-a/-/pkg-a-1.0.0.tgz',
                integrity: 'sha512-a',
                filename: 'pkg-a-1.0.0.tgz'
            }
        ];

        await downloader.downloadArtifacts(artifacts, outputDir);

        expect(fetchMock).toHaveBeenCalledWith('https://registry.npmjs.org/pkg-a/-/pkg-a-1.0.0.tgz');
        // Check fs.promises.mkdir call
        expect(fs.promises.mkdir).toHaveBeenCalledWith(outputDir, { recursive: true });
        // Check fs.promises.writeFile call
        expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('should skip existing files', async () => {
        vi.mocked(fs.existsSync).mockImplementation((p: any) => {
            if (p.toString().endsWith('pkg-a-1.0.0.tgz')) return true; 
            return false; 
        });

        const artifacts: DependencyArtifact[] = [
            {
                name: 'pkg-a',
                version: '1.0.0',
                resolved: 'https://registry.npmjs.org/pkg-a/-/pkg-a-1.0.0.tgz',
                integrity: 'sha512-a',
                filename: 'pkg-a-1.0.0.tgz'
            }
        ];

        await downloader.downloadArtifacts(artifacts, outputDir);

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should handle fetch errors', async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            statusText: 'Not Found'
        } as any);

        const artifacts: DependencyArtifact[] = [
            {
                name: 'pkg-fail',
                version: '1.0.0',
                resolved: 'https://fail.com',
                integrity: 'sha512-fail',
                filename: 'fail.tgz'
            }
        ];

        await expect(downloader.downloadArtifacts(artifacts, outputDir)).rejects.toThrow('Failed to fetch https://fail.com: Not Found');
    });
});

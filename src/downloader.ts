import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import { DependencyArtifact } from './types.js';
import { getAuthToken } from './auth.js';

export class Downloader {
    private limit;

    constructor(concurrency: number = 10) {
        this.limit = pLimit(concurrency);
    }

    public async downloadArtifacts(
        artifacts: DependencyArtifact[], 
        outputDir: string,
        onProgress?: (completed: number, total: number) => void
    ): Promise<void> {
        if (!fs.existsSync(outputDir)) {
            await fs.promises.mkdir(outputDir, { recursive: true });
        }

        let completed = 0;
        const total = artifacts.length;

        const tasks = artifacts.map(artifact => {
            return this.limit(async () => {
                await this.downloadFile(artifact, outputDir);
                completed++;
                if (onProgress) {
                    onProgress(completed, total);
                }
            });
        });

        await Promise.all(tasks);
    }

    private async downloadFile(artifact: DependencyArtifact, outputDir: string): Promise<void> {
        const filePath = path.join(outputDir, artifact.filename);

        if (fs.existsSync(filePath)) {
            // console.log(`Skipping ${artifact.filename}, already exists.`);
            return;
        }

        // console.log(`Downloading ${artifact.name} version ${artifact.version}...`);

        try {
            // Attempt to get auth token for the registry of this artifact
            const authToken = getAuthToken(artifact.resolved);
            const headers: HeadersInit = {};
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }

            const response = await fetch(artifact.resolved, { headers });
            if (!response.ok) {
                throw new Error(`Failed to fetch ${artifact.resolved}: ${response.statusText}`);
            }
            
            if (!response.body) {
                throw new Error(`No body in response for ${artifact.resolved}`);
            }

            const fileStream = fs.createWriteStream(filePath);
            
            // @ts-ignore - native fetch body is a ReadableStream which is compatible with pipeline/pipe conceptually but types might differ in node
            // Actually, for Node 18+ fetch, we can use Readable.fromWeb or just iterate chunks.
            // Or response.arrayBuffer() -> Buffer.writes
            
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            await fs.promises.writeFile(filePath, buffer);

            // console.log(`Downloaded ${artifact.filename}`);

        } catch (error) {
            console.error(`Error downloading ${artifact.filename}:`, error);
            // We might want to re-throw or collect errors. For now, log and throw.
            throw error;
        }
    }
}

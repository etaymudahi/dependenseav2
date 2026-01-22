import { describe, it, expect, beforeEach } from 'vitest';
import { Verifier } from '../src/verifier.js';
import ssri from 'ssri';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Verifier', () => {
    let verifier: Verifier;
    let tempDir: string;

    beforeEach(async () => {
        verifier = new Verifier();
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'verifier-test-'));
    });

    it('should return true for valid file', async () => {
        const content = 'hello world';
        const integrity = ssri.fromData(content).toString();
        const filePath = path.join(tempDir, 'valid.txt');
        await fs.promises.writeFile(filePath, content);

        const result = await verifier.verify(filePath, integrity);
        expect(result).toBe(true);
    });

    it('should return false for invalid file', async () => {
        const content = 'hello world';
        const integrity = ssri.fromData(content).toString();
        const filePath = path.join(tempDir, 'invalid.txt');
        await fs.promises.writeFile(filePath, 'corrupted content');

        const result = await verifier.verify(filePath, integrity);
        expect(result).toBe(false);
    });

    it('should return false if file does not exist', async () => {
        const result = await verifier.verify(path.join(tempDir, 'missing.txt'), 'sha512-whatever');
        expect(result).toBe(false);
    });
});

import fs from 'fs';
import ssri from 'ssri';
import { DependencyArtifact } from './types.js';

export class Verifier {
    public async verify(filePath: string, expectedIntegrity: string): Promise<boolean> {
        try {
            const stream = fs.createReadStream(filePath);
            await ssri.checkStream(stream, expectedIntegrity);
            return true;
        } catch (error) {
            return false;
        }
    }
}

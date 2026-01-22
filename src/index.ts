#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import figlet from 'figlet';
import gradient from 'gradient-string';
import ora from 'ora';
import { PackageLockParser } from './parser.js';
import { Downloader } from './downloader.js';
import { Verifier } from './verifier.js';
import { DependencyArtifact } from './types.js';

const getBanner = () => {
    const banner = figlet.textSync('DepSea', {
        font: 'Standard',
        horizontalLayout: 'default',
        verticalLayout: 'default',
    });
    return gradient.pastel.multiline(banner);
};

const displayBanner = () => {
    console.log(getBanner());
};

const program = new Command();

program
    .name('depsea')
    .description('Recursively download NPM dependencies for air-gapped environments')
    .version('1.0.0')
    .addHelpText('before', getBanner());

program
    .command('download')
    .description('Download dependencies from package-lock.json to a local directory')
    .argument('<lockfile>', 'Path to package-lock.json')
    .argument('[outputDir]', 'Directory to save .tgz files (defaults to current directory)')
    .option('-c, --concurrency <number>', 'Download concurrency', '10')
    .action(async (lockfile, outputDir, options) => {
        try {
            displayBanner();
            
            const parseSpinner = ora(`Parsing ${lockfile}...`).start();
            try {
                const parser = new PackageLockParser();
                const artifacts = await parser.parse(lockfile);
                parseSpinner.succeed(`Found ${artifacts.length} unique artifacts.`);
                
                const resolvedOutputDir = path.resolve(outputDir || process.cwd(), 'package-lock-tgzs');
                const downloadSpinner = ora(`Downloading to ${resolvedOutputDir} with concurrency ${options.concurrency}...`).start();
                
                try {
                    const downloader = new Downloader(parseInt(options.concurrency));
                    await downloader.downloadArtifacts(artifacts, resolvedOutputDir, (completed, total) => {
                        downloadSpinner.text = `Downloading... (${completed}/${total})`;
                    });
                    downloadSpinner.succeed('Download complete.');
                } catch (downloadError: any) {
                    downloadSpinner.fail(`Download failed: ${downloadError.message}`);
                    throw downloadError;
                }

                const verifySpinner = ora('Verifying integrity...').start();
                const verifier = new Verifier();
                let verifiedCount = 0;
                let failedCount = 0;

                for (const artifact of artifacts) {
                    const filePath = path.join(resolvedOutputDir, artifact.filename);
                    const isValid = await verifier.verify(filePath, artifact.integrity);
                    
                    if (isValid) {
                        verifiedCount++;
                    } else {
                        verifySpinner.clear(); // Temporarily clear spinner to log error
                        console.error(`Integrity check failed for ${artifact.filename}`);
                        verifySpinner.render(); // Bring spinner back
                        failedCount++;
                    }
                }

                if (failedCount > 0) {
                     verifySpinner.fail(`Verification complete: ${verifiedCount} passed, ${failedCount} failed.`);
                     process.exit(1);
                } else {
                    verifySpinner.succeed(`Verification complete: ${verifiedCount} passed, ${failedCount} failed.`);
                }

            } catch (err: any) {
                if (parseSpinner.isSpinning) parseSpinner.fail('Parsing failed');
                throw err;
            }

        } catch (error: any) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    });

program
    .command('publish')
    .description('Publish all .tgz files in a directory to the configured NPM registry')
    .argument('[tgzsDir]', 'Directory containing .tgz files (defaults to current directory)')
    .option('-c, --concurrency <number>', 'Publish concurrency', '5')
    .action(async (tgzsDir, options) => {
        try {
            displayBanner();

            const fs = await import('fs');
            const { exec } = await import('child_process');
            const util = await import('util');
            const execAsync = util.promisify(exec);
            const pLimit = (await import('p-limit')).default;

            const resolvedDir = path.resolve(tgzsDir || process.cwd());
            if (!fs.existsSync(resolvedDir)) {
                console.error(`Directory not found: ${resolvedDir}`);
                process.exit(1);
            }

            const files = await fs.promises.readdir(resolvedDir);
            const tgzFiles = files.filter(f => f.endsWith('.tgz'));
            
            const publishSpinner = ora(`Found ${tgzFiles.length} .tgz files in ${resolvedDir}. Publishing...`).start();

            const limit = pLimit(parseInt(options.concurrency));
            let successCount = 0;
            let failCount = 0;

            const tasks = tgzFiles.map(file => limit(async () => {
                const filePath = path.join(resolvedDir, file);
                try {
                    // console.log(`Publishing ${file}...`);
                    await execAsync(`npm publish "${filePath}"`);
                    // console.log(`Published ${file}`);
                    successCount++;
                    publishSpinner.text = `Publishing... (${successCount}/${tgzFiles.length})`;
                } catch (err: any) {
                    publishSpinner.clear();
                    console.error(`Failed to publish ${file}:`, err.message.split('\n')[0]); // Log first line of error
                    publishSpinner.render();
                    failCount++;
                }
            }));

            await Promise.all(tasks);

            if (failCount > 0) {
                publishSpinner.fail(`Publishing complete: ${successCount} published, ${failCount} failed.`);
                process.exit(1);
            } else {
                publishSpinner.succeed(`Publishing complete: ${successCount} published, ${failCount} failed.`);
            }

        } catch (error: any) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    });

program
    .command('download-package')
    .description('Download dependencies for a specific package by generating a temporary lockfile')
    .argument('<packageName>', 'Name of the package to download')
    .argument('[outputDir]', 'Parent directory to save the package tgzs (defaults to current directory)')
    .option('-c, --concurrency <number>', 'Download concurrency', '10')
    .action(async (packageName, outputDir, options) => {
        try {
            displayBanner();
            
            const fs = await import('fs');
            const { exec } = await import('child_process');
            const util = await import('util');
            const execAsync = util.promisify(exec);
            
            const baseDir = path.resolve(outputDir || process.cwd());
            const tempDir = path.join(baseDir, '.temp_lock_gen');
            const safePackageName = packageName.replace(/\//g, '-');
            const targetOutputDir = path.join(baseDir, `${safePackageName}-tgzs`);

            // 1. Create Temp Directory
            if (!fs.existsSync(tempDir)) {
                await fs.promises.mkdir(tempDir, { recursive: true });
            }

            // 2. Generate Lockfile
            const installSpinner = ora(`Generating lockfile for ${packageName}...`).start();
            try {
                // Initialize a dummy package.json to avoid warnings and ensure structure
                await fs.promises.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ name: "temp-pkg", version: "1.0.0" }));
                
                await execAsync(`npm install ${packageName} --package-lock-only`, { cwd: tempDir });
                installSpinner.succeed(`Generated lockfile for ${packageName}.`);
            } catch (installError: any) {
                installSpinner.fail(`Failed to generate lockfile: ${installError.message}`);
                // Cleanup even on fail
                await fs.promises.rm(tempDir, { recursive: true, force: true });
                process.exit(1);
            }

            // 3. Parse Lockfile
            const lockfilePath = path.join(tempDir, 'package-lock.json');
            const parseSpinner = ora(`Parsing generated lockfile...`).start();
            let artifacts: DependencyArtifact[] = [];
            
            try {
                const parser = new PackageLockParser();
                artifacts = await parser.parse(lockfilePath);
                parseSpinner.succeed(`Found ${artifacts.length} unique artifacts.`);
            } catch (parseError: any) {
                parseSpinner.fail(`Parsing failed: ${parseError.message}`);
                 await fs.promises.rm(tempDir, { recursive: true, force: true });
                process.exit(1);
            }

            // 4. Download Artifacts
            const downloadSpinner = ora(`Downloading to ${targetOutputDir} with concurrency ${options.concurrency}...`).start();
            try {
                const downloader = new Downloader(parseInt(options.concurrency));
                await downloader.downloadArtifacts(artifacts, targetOutputDir, (completed, total) => {
                    downloadSpinner.text = `Downloading... (${completed}/${total})`;
                });
                downloadSpinner.succeed('Download complete.');
            } catch (downloadError: any) {
                downloadSpinner.fail(`Download failed: ${downloadError.message}`);
                 await fs.promises.rm(tempDir, { recursive: true, force: true });
                process.exit(1);
            }

            // 5. Cleanup
            const cleanupSpinner = ora('Cleaning up temporary files...').start();
            try {
                await fs.promises.rm(tempDir, { recursive: true, force: true });
                cleanupSpinner.succeed('Cleanup complete.');
            } catch (cleanupError: any) {
                cleanupSpinner.warn(`Failed to clean up temp dir: ${cleanupError.message}`);
            }

        } catch (error: any) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    });

program.parse();

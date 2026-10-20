import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const vaultPath = process.argv[2];
if (!vaultPath) {
	console.error('Usage: npm run install-vault -- <vault-path>');
	process.exit(1);
}

const pluginDir = join(vaultPath, '.obsidian', 'plugins', 'princelists');
mkdirSync(pluginDir, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css']) {
	copyFileSync(file, join(pluginDir, file));
}
console.log(`Installed PrinceLists into ${pluginDir}`);

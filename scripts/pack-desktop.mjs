// Bundles the desktop main + inlines deps into a single dist/main.js,
// then packages a portable Electron exe with electron-builder.
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const appDir = path.join(root, 'apps', 'desktop');

async function main() {
  // 0. Contracts must be built first (workspace resolution target).
  execSync('npm run build -w packages/contracts', { cwd: root, stdio: 'inherit' });

  // 1. Bundle main (CommonJS) with all deps inlined (contracts, socket.io-client, ws, zod).
  console.log('[pack] esbuild main.js');
  await build({
    entryPoints: [path.join(appDir, 'src', 'main', 'index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: path.join(appDir, 'dist', 'main.js'),
    // Native/hosted modules must stay external: @roamhq/wrtc loads a platform
    // .node binary at runtime (asarUnpack'd), koffi likewise, and bundling the
    // wrtc metapackage would inline JS that then fails to find its binary.
    external: ['electron', 'koffi', '@roamhq/wrtc', '@roamhq/wrtc-win32-x64'],
    define: { 'process.env.NODE_ENV': '"production"' },
    legalComments: 'none',
  });

  // 1b. Bundle the game-data runtime (mock Valorant source) as a standalone
  //     node script the packaged app spawns with ELECTRON_RUN_AS_NODE=1.
  console.log('[pack] esbuild runtime-server.cjs');
  await build({
    entryPoints: [path.join(root, 'services', 'game-data-runtime', 'src', 'server.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: path.join(appDir, 'dist', 'runtime-server.cjs'),
    // Overwolf's SDK is a native/hosted module resolved at runtime only when the
    // OW app is present; keep it external so the mock path works everywhere and
    // real-GEP resolves on machines where Overwolf is installed.
    external: ['@overwolf/ow-electron'],
    define: { 'process.env.NODE_ENV': '"production"' },
    legalComments: 'none',
  });

  // 1c. Stage the Overwolf GEP pieces so electron-builder ships them as
  //     extraResources: ow-electron's electron.exe (the fork that hosts the GEP
  //     package) and the gep-provider child app (declares overwolf.packages).
  console.log('[pack] staging ow-electron + gep-provider');
  const owSrc = path.join(root, 'node_modules', '@overwolf', 'ow-electron');
  const owOut = path.join(appDir, 'dist', 'ow-electron');
  if (existsSync(owSrc)) {
    // robocopy exit codes 0-7 are success; >= 8 are failures.
    execSync('cmd /c robocopy "' + owSrc + '" "' + owOut + '" /E /NFL /NDL /NJH /NJS || exit /b 0', { stdio: 'ignore' });
  } else {
    console.warn('[pack] @overwolf/ow-electron not installed — GEP capture will be unavailable');
  }
  const gepSrc = path.join(root, 'services', 'game-data-runtime', 'gep-provider');
  const gepOut = path.join(appDir, 'dist', 'gep-provider');
  execSync('cmd /c xcopy /E /I /Y "' + gepSrc + '" "' + gepOut + '"', { stdio: 'inherit' });

  // 2. Copy HUD static assets into the package resources dir.
  const hudSrc = path.join(root, 'apps', 'hud', 'public');
  const hudOut = path.join(appDir, 'dist', 'hud-public');
  console.log('[pack] hud assets ->', hudOut);
  mkdirSync(hudOut, { recursive: true });
  execSync('cmd /c xcopy /E /I /Y "' + hudSrc + '" "' + hudOut + '"', { stdio: 'inherit' });

  // 3. Place a starting config for the user to edit.
  const cfgPath = path.join(appDir, 'havoc-unleash.config.example.json');
  if (!existsSync(cfgPath)) {
    const cfg = JSON.stringify(
      {
        appBase: 'https://<your-vercel>.vercel.app',
        bridgeOrigin: 'https://<your-bridge>.onrender.com',
        roomId: '<serverCode>',
      },
      null,
      2,
    );
    writeFileSync(cfgPath, cfg + '\n');
    console.log('[pack] wrote', cfgPath);
  }

  // 4. electron-builder: unpacked dir (stable exe we register protocols to)
  //    first, then the portable single-file exe as a convenience.
  console.log('[pack] packaging win-unpacked (stable exe)...');
  execSync('npx electron-builder --win dir -c.directories.output=release-fresh', { cwd: appDir, stdio: 'inherit', env: { ...process.env } });
  console.log('[pack] DONE. win-unpacked at apps/desktop/release-fresh/win-unpacked/Havoc Unleash.exe');
}

main().catch((e) => { console.error(e); process.exit(1); });
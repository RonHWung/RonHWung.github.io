import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const outputRoot = path.resolve('dist');

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  }));
  return nested.flat();
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function localTargets(html) {
  const targets = [];
  const attributes = /(?:href|src|srcset)=(?:"([^"]+)"|'([^']+)')/g;
  for (const match of html.matchAll(attributes)) {
    const value = match[1] ?? match[2];
    if (match[0].startsWith('srcset')) {
      targets.push(...value.split(',').map((item) => item.trim().split(/\s+/)[0]));
    } else {
      targets.push(value);
    }
  }
  return targets.filter((target) => (
    target
    && !target.startsWith('#')
    && !target.startsWith('//')
    && !/^[a-z][a-z\d+.-]*:/i.test(target)
  ));
}

async function resolvesFrom(htmlFile, rawTarget) {
  const cleanTarget = decodeURIComponent(rawTarget.split(/[?#]/, 1)[0]);
  if (!cleanTarget) return true;

  const candidate = cleanTarget.startsWith('/')
    ? path.join(outputRoot, cleanTarget.slice(1))
    : path.resolve(path.dirname(htmlFile), cleanTarget);

  if (await exists(candidate)) return true;
  return exists(path.join(candidate, 'index.html'));
}

const files = await walk(outputRoot);
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const problems = [];

for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, 'utf8');
  const page = path.relative(outputRoot, htmlFile);

  if (!/<html\s[^>]*lang="zh-CN"/i.test(html)) problems.push(`${page} -> missing zh-CN language`);
  if (!/<title>[^<]+<\/title>/i.test(html)) problems.push(`${page} -> missing page title`);
  if (!/<meta\s[^>]*name="description"[^>]*content="[^"]+"/i.test(html)) {
    problems.push(`${page} -> missing meta description`);
  }
  for (const imageTag of html.matchAll(/<img\b[^>]*>/gi)) {
    // Empty alt is valid for decorative images; the attribute itself is required.
    if (!/\salt(?:\s|=|>)/i.test(imageTag[0])) problems.push(`${page} -> image missing alt attribute`);
  }

  for (const target of localTargets(html)) {
    if (!(await resolvesFrom(htmlFile, target))) {
      problems.push(`${page} -> missing ${target}`);
    }
  }
}

if (problems.length > 0) {
  console.error('Build validation problems:\n' + problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Validated ${htmlFiles.length} HTML pages: metadata, image alternatives, local links and media.`);
}

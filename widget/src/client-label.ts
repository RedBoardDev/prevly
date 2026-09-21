// A raw user agent string fingerprints the reviewer's exact browser, OS build
// and device. The report only needs enough to reproduce a rendering problem, so
// nothing more specific than "browser major version on OS" ever leaves the page.
const BROWSERS: Array<[RegExp, string]> = [
  [/Edg\/(\d+)/, 'Edge'],
  [/OPR\/(\d+)/, 'Opera'],
  [/Firefox\/(\d+)/, 'Firefox'],
  [/Chrome\/(\d+)/, 'Chrome'],
  [/Version\/(\d+).*Safari/, 'Safari'],
];

const PLATFORMS: Array<[RegExp, string]> = [
  [/Windows NT/, 'Windows'],
  [/Android/, 'Android'],
  [/(iPhone|iPad|iPod)/, 'iOS'],
  [/Mac OS X/, 'macOS'],
  [/(Linux|X11)/, 'Linux'],
];

export function clientLabel(userAgent: string): string {
  let browser = '';
  for (const [pattern, name] of BROWSERS) {
    const match = pattern.exec(userAgent);
    if (match) {
      browser = `${name} ${match[1]}`;
      break;
    }
  }
  let platform = '';
  for (const [pattern, name] of PLATFORMS) {
    if (pattern.test(userAgent)) {
      platform = name;
      break;
    }
  }
  if (browser && platform) return `${browser} on ${platform}`;
  return browser || platform;
}

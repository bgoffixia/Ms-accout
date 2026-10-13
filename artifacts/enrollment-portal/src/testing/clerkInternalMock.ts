export function publishableKeyFromHost(_host?: string, fallback?: string) {
  return fallback || 'pk_test_playwright_mock';
}

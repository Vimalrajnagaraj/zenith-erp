// Disposable CI only: authenticate once, then let every browser request use the same cookie.
// Moqui creates a new session for every Basic login; persistent headers race with Quasar requests.
export async function establishSession(page, base, username, password) {
  const endpoint = new URL(base);
  if (endpoint.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(endpoint.hostname) || endpoint.port !== '8080') {
    throw new Error('CI browser sessions require the disposable loopback port 8080');
  }
  const response = await fetch(base + '/apps/zenith', {
    headers: { Authorization: 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64') },
    redirect: 'manual',
  });
  const cookie = response.headers.getSetCookie().find(value => value.startsWith('JSESSIONID='));
  await response.text();
  if (response.status !== 200 || !cookie) throw new Error('One-shot CI login failed to establish an authenticated session');
  const value = cookie.split(';')[0].slice('JSESSIONID='.length);
  if (!value) throw new Error('One-shot CI login returned an empty session cookie');
  await page.setCookie({ name: 'JSESSIONID', value, url: base, path: '/', httpOnly: true });
  console.log('One-shot authenticated browser session established');
}

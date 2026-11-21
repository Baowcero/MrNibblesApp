/**
 * Browsers send an Origin header on requests that change things. If it names another site, someone is trying to
 * use a logged-in person's browser from a different page (CSRF). The cookies are already SameSite=Lax; this is the second lock.
 * Requests with no Origin (curl, server to server) are not browser requests and are left alone.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const crossSiteBlocked = () =>
  Response.json({ error: { code: 'cross_site', message: 'This request came from another site and was blocked.' } }, { status: 403 });

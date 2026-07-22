import { NextResponse } from 'next/server'

// The full client app is too heavy for in-app browsers (Instagram/Facebook on
// Android), where it renders and then crashes: "This page couldn't load".
// Serve those visitors the lightweight, server-rendered /start page instead, so
// the existing bio link works without anyone changing it. Real browsers are
// untouched and still get the full app.
//
// Deliberately narrow: only Android in-app browsers. iOS in-app browsers handle
// the full app fine, so they must keep getting it — rewriting them would be a
// downgrade. Only the root path is matched.
const IN_APP_BROWSER = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|Snapchat|Pinterest/i
const ANDROID = /Android/i

export function middleware(request) {
  const ua = request.headers.get('user-agent') || ''

  // Escape hatch: /?full=1 always forces the real app, even in an in-app browser.
  if (request.nextUrl.searchParams.has('full')) return NextResponse.next()

  if (IN_APP_BROWSER.test(ua) && ANDROID.test(ua)) {
    const url = request.nextUrl.clone()
    url.pathname = '/start'
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

// Only run on the root path — never on assets, API routes, or other pages.
export const config = {
  matcher: '/',
}

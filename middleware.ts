const BOT_UA = /facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|WhatsApp|Discordbot|Googlebot/i;

export const config = {
    matcher: '/share/:path*',
};

export default async function middleware(request: Request) {
    const ua = request.headers.get('user-agent') ?? '';
    if (!BOT_UA.test(ua)) return;

    const url = new URL(request.url);
    const token = url.pathname.replace(/^\/share\//, '').split('/')[0];
    if (!token) return;

    const apiBase = process.env.PRODUCTION_API_URL ?? 'https://api-osqb5umzra-uc.a.run.app';

    try {
        const crawlerRes = await fetch(`${apiBase}/share/crawler?token=${encodeURIComponent(token)}`);
        return new Response(crawlerRes.body, {
            status: crawlerRes.status,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    } catch {
        return;
    }
}

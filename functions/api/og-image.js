// Cloudflare Pages Function — fetches og:image from a recipe URL
// Usage: POST /api/og-image with { url: "https://..." }

export async function onRequestPost(context) {
  try {
    const { url } = await context.request.json();
    if (!url) {
      return new Response(JSON.stringify({ error: 'No URL provided' }), { status: 400 });
    }

    const res = await fetch(url);
    const html = await res.text();

    // Look for og:image meta tag
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    const imageUrl = match ? match[1] : null;

    return new Response(JSON.stringify({ image: imageUrl }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

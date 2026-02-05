// Cloudflare Pages Function — searches Unsplash for a food photo
// Usage: GET /api/food-image?q=recipe+name
// Set UNSPLASH_ACCESS_KEY as an environment variable in CF Pages dashboard.

export async function onRequestGet(context) {
  try {
    const query = context.url.searchParams.get('q');
    if (!query) {
      return new Response(JSON.stringify({ error: 'No query provided' }), { status: 400 });
    }

    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query + ' food')}&count=1&orientation=squarish`,
      {
        headers: {
          'Authorization': `Client-ID ${context.env.UNSPLASH_ACCESS_KEY}`,
        }
      }
    );

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Unsplash error ${res.status}` }), { status: res.status });
    }

    const data = await res.json();
    // data is an array with 1 item
    const image = data[0]?.urls?.small || null;

    return new Response(JSON.stringify({ image }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

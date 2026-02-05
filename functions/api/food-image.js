// Cloudflare Pages Function — searches Unsplash for a food photo
// Usage: GET /api/food-image?q=recipe+name
// Set UNSPLASH_ACCESS_KEY as an environment variable in CF Pages dashboard.

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const query = url.searchParams.get('q');
    if (!query) {
      return new Response(JSON.stringify({ error: 'No query provided' }), { status: 400 });
    }

    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query + ' recipe')}&per_page=3&orientation=squarish`,
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
    const results = data.results || [];

    // Score each result: how many words from the recipe name appear in alt_description
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const scored = results.map((r, i) => {
      const alt = (r.alt_description || '').toLowerCase();
      const matches = queryWords.filter(w => alt.includes(w)).length;
      return { index: i, score: matches, alt: r.alt_description, url: r.urls?.small || null };
    });
    scored.sort((a, b) => b.score - a.score || a.index - b.index); // best score first, tie-break by original order

    const best = scored[0] || null;
    const image = best ? best.url : null;

    // If ?debug=1, return all candidates for inspection
    const debug = url.searchParams.get('debug');
    if (debug === '1') {
      return new Response(JSON.stringify({
        query: query + ' recipe',
        picked: best,
        candidates: scored
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ image }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

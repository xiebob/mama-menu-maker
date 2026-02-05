// Cloudflare Pages Function — searches Unsplash for a food photo
// Usage: GET /api/food-image?q=recipe+name
// Set UNSPLASH_ACCESS_KEY as an environment variable in CF Pages dashboard.

// Strip noise from recipe names so Unsplash finds the actual dish
function simplifyQuery(name) {
  let q = name.trim();
  // Remove nested/parenthetical notes like "(easy)" or "(the not-for-Passover version)"
  // Run twice to catch nested parens like "(or Duckling (or Dumpling))"
  q = q.replace(/\([^()]*\)/g, '');
  q = q.replace(/\([^()]*\)/g, '');
  // Remove underscores and everything after (e.g. "Hot Chocolate_Cocoa Mix" → "Hot Chocolate")
  q = q.replace(/_.*/, '');
  // Strip prefix noise FIRST so "with" rule sees the real dish name word count
  // Remove possessive names at the start: "Colin's ...", "Dre's ...", "Mom's ..."
  q = q.replace(/^\w+'s\s+/i, '');
  // Remove personal/brand names at the start
  q = q.replace(/^(isa|mama|mamadama|dre|robertsonmeyer|xie|coral|asher)\s+/i, '');
  // Remove cooking-method prefixes: "Slow Cooker", "Instant Pot", "Oven-Roasted"
  q = q.replace(/^(slow\s*cooker|instant\s*pot|oven-?roasted)\s+/i, '');
  // Remove filler/style adjectives at the start (repeat to catch stacks)
  q = q.replace(/^(easy|simple|simplest|best|awesome|killer|zesty|crispy|quick|giant|gourmet|basic|tiny|huge|doubled)\s+/i, '');
  q = q.replace(/^(easy|simple|simplest|best|awesome|killer|zesty|crispy|quick|giant|gourmet|basic|tiny|huge|doubled)\s+/i, '');
  // NOW strip "with ..." — only when the core dish before "with" is 2+ words
  // (keeps "Beef with Snow Peas", "Tofu with Broccoli" but strips "Fish Tacos with Best Fish Taco Sauce")
  q = q.replace(/^(\S+\s+\S+.*?)\s+with\s+.*/i, '$1');
  // Remove everything after " - " or " – " (e.g. "Pad Krapow Gai - Thai Basil Stir Fry")
  q = q.replace(/\s+[-–]\s+.*/g, '');
  // Remove "Non-" prefix
  q = q.replace(/^non-/i, '');
  // Remove "Passover -" or "Passover" prefix
  q = q.replace(/^passover\s*-?\s*/i, '');
  // Clean up trailing commas/punctuation and collapse whitespace
  q = q.replace(/[,\s]+$/, '').replace(/\s+/g, ' ').trim();
  // If nothing useful is left, fall back to original
  return q || name.trim();
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const query = url.searchParams.get('q');
    if (!query) {
      return new Response(JSON.stringify({ error: 'No query provided' }), { status: 400 });
    }

    const simplified = simplifyQuery(query);

    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(simplified + ' recipe')}&per_page=3&orientation=squarish`,
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

    // Score each result: how many words from the simplified name appear in alt_description
    const queryWords = simplified.toLowerCase().split(/\s+/).filter(w => w.length > 2);
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
        original: query,
        simplified: simplified,
        searchQuery: simplified + ' recipe',
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

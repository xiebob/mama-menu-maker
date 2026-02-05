// Cloudflare Pages Function — handles POST /api/chat
// Set GROQ_API_KEY as an environment variable in the CF Pages dashboard.

export async function onRequestPost(context) {
  try {
    const { messages, systemPrompt } = await context.request.json();

    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(msg => ({ role: msg.role, content: msg.content }))
    ];

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${context.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
        stream: true,
        max_tokens: 2048,
      })
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      return new Response(
        `data: ${JSON.stringify({ error: `Groq API error ${groqResponse.status}: ${errorText}` })}\n\n`,
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
      );
    }

    // Pipe Groq's stream through, injecting progress events
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const groqReader = groqResponse.body.getReader();
    const decoder = new TextDecoder();

    // Process in the background — don't await, let the stream flow
    (async () => {
      let fullResponse = '';
      let tokenCount = 0;
      const startTime = Date.now();

      while (true) {
        const { done, value } = await groqReader.read();

        if (done) {
          await writer.write(new TextEncoder().encode(
            `data: ${JSON.stringify({
              content: [{ type: 'text', text: fullResponse }],
              done: true
            })}\n\n`
          ));
          await writer.close();
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.substring(6);
          if (data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;

            if (content) {
              fullResponse += content;
              tokenCount++;

              if (tokenCount % 5 === 0) {
                const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
                await writer.write(new TextEncoder().encode(
                  `data: ${JSON.stringify({
                    type: 'progress',
                    tokens: tokenCount,
                    elapsed: elapsedSeconds,
                    preview: fullResponse.substring(0, 100)
                  })}\n\n`
                ));
              }
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      }
    });

  } catch (error) {
    return new Response(
      `data: ${JSON.stringify({ error: error.message })}\n\n`,
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
    );
  }
}

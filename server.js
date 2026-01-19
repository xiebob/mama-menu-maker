const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, systemPrompt } = req.body;

    // Convert messages to Ollama format
    const conversationHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Enable streaming for better progress feedback
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          ...conversationHistory
        ],
        stream: true // Enable streaming
      })
    });

    // Set headers for SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullResponse = '';
    let tokenCount = 0;
    const startTime = Date.now();

    // Stream the response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Send final complete response
        const result = {
          content: [
            {
              type: 'text',
              text: fullResponse
            }
          ],
          done: true
        };
        res.write(`data: ${JSON.stringify(result)}\n\n`);
        res.end();
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const json = JSON.parse(line);

          if (json.message && json.message.content) {
            fullResponse += json.message.content;
            tokenCount++;

            // Send progress updates every 5 tokens
            if (tokenCount % 5 === 0) {
              const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
              res.write(`data: ${JSON.stringify({
                type: 'progress',
                tokens: tokenCount,
                elapsed: elapsedSeconds,
                preview: fullResponse.substring(0, 100)
              })}\n\n`);
            }
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend proxy running on port ${PORT}`);
  console.log(`Make sure Ollama is running on localhost:11434`);
});
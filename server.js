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
        stream: false
      })
    });

    const data = await response.json();
    
    // Convert Ollama response to Anthropic-like format for compatibility
    const result = {
      content: [
        {
          type: 'text',
          text: data.message.content
        }
      ]
    };

    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend proxy running on port ${PORT}`);
  console.log(`Make sure Ollama is running on localhost:11434`);
});
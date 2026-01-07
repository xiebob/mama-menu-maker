import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const MealPlannerChat = () => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I\'m your meal planning assistant. I can help you plan meals from your recipe collection, create shopping lists, and generate a calendar. What would you like to do today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [selectedMeals, setSelectedMeals] = useState([]);
  const messagesEndRef = useRef(null);

  // Load recipes on mount
  useEffect(() => {
    fetch('/recipes.json')
      .then(res => res.json())
      .then(data => {
        setRecipes(data);
        console.log('Loaded', data.length, 'recipes');
      })
      .catch(err => console.error('Error loading recipes:', err));
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
  e.preventDefault();
  if (!input.trim()) return;

  const userMessage = input;
  setInput('');
  setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
  setLoading(true);

  try {
    const recipesContext = recipes.map(r => 
      `- ${r.name}: ${r.ingredients.join(', ')} (${r.totalTime}m total, ${r.notes})`
    ).join('\n');

    const systemPrompt = `You are a meal planning assistant. Your job is to help plan meals based on the user's preferences and available recipes.

Here are all available recipes:
${recipesContext}

Your responsibilities:
1. Suggest meals that include a protein and vegetable (or a side dish)
2. Typically plan 3 meals per week unless asked otherwise
3. Always tell the user which recipes you're suggesting
4. Let them approve, swap, or request modifications
5. Ask about any ingredients they want to use up
6. When they're ready, help create a shopping list and calendar file
7. When generating meals, format them clearly with recipe names and any special shopping notes

Be conversational and helpful. Ask clarifying questions if needed.`;

    const response = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })).concat([{
          role: 'user',
          content: userMessage
        }]),
        systemPrompt: systemPrompt
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    const assistantMessage = data.content[0].text;
    setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);

    if (userMessage.toLowerCase().includes('yes') || userMessage.toLowerCase().includes('approve')) {
      const mealMatches = assistantMessage.match(/(?:for meal|suggest|try|how about).*?([A-Z][^.!?]*)/g);
      if (mealMatches) {
        const mealNames = mealMatches.map(m => m.replace(/(?:for meal|suggest|try|how about)/, '').trim());
        setSelectedMeals(mealNames);
      }
    }
  } catch (error) {
    console.error('API Error:', error);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `Sorry, I encountered an error: ${error.message}. Make sure the backend is running on port 3001.`
    }]);
  } finally {
    setLoading(false);
  }
};

  const downloadCalendar = () => {
    const selectedRecipes = recipes.filter(r => 
      selectedMeals.some(meal => r.name.toLowerCase().includes(meal.toLowerCase()))
    );

    if (selectedRecipes.length === 0) {
      alert('No meals selected yet. Please discuss meal selections with the assistant first.');
      return;
    }

    let ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Meal Planner//EN\n';

    selectedRecipes.forEach((meal, idx) => {
      const date = new Date();
      date.setDate(date.getDate() + (idx * 2));
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = year + month + day;

      const description = `Prep: ${meal.prepTime}m | Cook: ${meal.cookTime}m\n${meal.notes}\n\nIngredients: ${meal.ingredients.join(', ')}\n\nRecipe: ${meal.url}`;
      const eventUid = `${meal.name.replace(/\s+/g, '-')}-${idx}@meal-planner`;

      ics += `BEGIN:VEVENT\nUID:${eventUid}\nDTSTART:${dateStr}T180000\nDTEND:${dateStr}T190000\nSUMMARY:${meal.name}\nDESCRIPTION:${description}\nURL:${meal.url}\nEND:VEVENT\n`;
    });

    ics += 'END:VCALENDAR';

    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meals.ics';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-container">
      <div className="app-header">
        <div className="header-content">
          <div className="header-title">
            <span className="header-icon">🍽️</span>
            <div>
              <h1>Meal Planner</h1>
              <p>Chat with Claude to plan your meals</p>
            </div>
          </div>
        </div>
      </div>

      <div className="messages-container">
        <div className="messages-wrapper">
          {messages.map((msg, i) => (
            <div key={i} className={`message message-${msg.role}`}>
              <div className="message-bubble">
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="message message-assistant">
              <div className="message-bubble">
                <div className="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="input-container">
        <div className="input-wrapper">
          <form onSubmit={sendMessage} className="input-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What meals would you like to plan?"
              disabled={loading}
              className="message-input"
            />
            <button
              type="submit"
              disabled={loading}
              className="send-button"
            >
              Send
            </button>
          </form>
          
{selectedMeals.length > 0 && (
  <button
    onClick={downloadCalendar}
    className="download-button"
  >
    📥 Download Calendar (ICS)
  </button>
)}        </div>
      </div>
    </div>
  );
};

export default MealPlannerChat;
import React, { useState, useEffect, useRef } from 'react';
import { Send, Download, ChefHat } from 'lucide-react';

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

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-opus-4-1-20250805',
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })).concat([{
            role: 'user',
            content: userMessage
          }])
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      const assistantMessage = data.content[0].text;
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);

      // Parse if user mentioned selecting meals
      if (userMessage.toLowerCase().includes('yes') || userMessage.toLowerCase().includes('approve')) {
        // Extract meal names from assistant response
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
        content: `Sorry, I encountered an error: ${error.message}. Please check your API key is set correctly in the .env file.`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const downloadCalendar = () => {
    // Parse selected meals from the conversation
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
      date.setDate(date.getDate() + (idx * 2)); // Space meals 2 days apart
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
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <ChefHat className="text-emerald-600" size={32} />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Meal Planner</h1>
            <p className="text-slate-500 text-sm">Chat with Claude to plan your meals</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-2xl px-4 py-3 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-900 border border-slate-200 shadow-sm'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white text-slate-900 border border-slate-200 shadow-sm px-4 py-3 rounded-lg">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-200 p-6 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={sendMessage} className="flex gap-2 mb-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What meals would you like to plan?"
              disabled={loading}
              className="flex-1 border border-slate-300 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-slate-50"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <Send size={18} />
            </button>
          </form>
          
          <button
            onClick={downloadCalendar}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Download Calendar (ICS)
          </button>
        </div>
      </div>
    </div>
  );
};

export default MealPlannerChat;
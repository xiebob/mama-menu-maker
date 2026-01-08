import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const MealPlannerChat = () => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I\'m Mama\'s Menu Maker. I\'m ready to plan your dinners! Are there any ingredients you want to use up?'
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

const systemPrompt = `You are a meal planning assistant specializing in DINNER meals only.

Here are all available recipes:
${recipesContext}

INSTRUCTIONS - READ CAREFULLY:
- Each meal = EXACTLY ONE recipe from the list
- Do NOT suggest desserts, breakfasts, or side dishes as main meals
- Do NOT suggest multiple recipes per meal
- Each meal has: ONE recipe name, cooking time, and shopping list

Your responsibilities:
1. Plan 3 DINNER meals per week ONLY (exclude: desserts, breakfasts, appetizers)
2. For EACH meal, pick ONE recipe from the list that is appropriate for dinner
3. NO MORE than 2 meals per week contain meat (beef, pork, lamb, chicken, fish)
4. At least 1 meal must be vegetarian
5. ONLY suggest a side if needed:
   - If recipe has PROTEIN + VEGETABLES already → NO SIDE NEEDED
   - If recipe has PROTEIN but NO vegetables → add ONE simple VEGETABLE (roasted asparagus, steamed broccoli, green salad - NOT a recipe)
   - If recipe lacks PROTEIN → add ONE simple PROTEIN (grilled chicken breast, NOT a recipe)
6. CRITICAL: If you suggest a side, you MUST include ALL side ingredients in the shopping list. For example:
   - If you suggest "Roasted Asparagus" side → MUST add "asparagus" to the To buy list
   - If you suggest "Steamed broccoli" side → MUST add "broccoli" to the To buy list
   - If you suggest "Grilled chicken breast" side → MUST add "chicken breast" to the To buy list
7. List non-stock ingredients as BULLET POINTS
   - For the "To buy" list, ONLY include non-stock ingredients. 
   - REMOVE and DO NOT LIST common stock items even if they appear in the recipe, such as salt, pepper, oil, butter, water, garlic, onion, vinegar, soy sauce, sugar, flour, eggs, milk, spices)
8. Format:
   - Recipe name: [SINGLE RECIPE NAME]
   - Cooking time: X min
   - Side: [only if needed - simple item, not a full recipe]
   - To buy:
     • ingredient 1
     • ingredient 2
     • [side ingredients if applicable]

You can add an icon for each meal if you want (e.g., 🍝, 🥗, 🍲, etc.)
Be helpful and friendly.`;

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

      // Auto-inject correct recipe URLs by matching recipe names in the message
let enhancedMessage = assistantMessage;
recipes.forEach(recipe => {
  const recipeName = recipe.name;
  if (enhancedMessage.includes(`Recipe name: ${recipeName}`)) {
    const pattern = `Recipe name: ${recipeName}`;
    const replacement = `Recipe name: ${recipeName}\n- Recipe link: <a href="${recipe.url}" target="_blank" style="color: #2E5FF3; text-decoration: underline;">${recipe.url}</a>`;
    enhancedMessage = enhancedMessage.replace(pattern, replacement);
  }
});
      setMessages(prev => [...prev, { role: 'assistant', content: enhancedMessage }]);

      if (userMessage.toLowerCase().includes('yes') || userMessage.toLowerCase().includes('approve')) {
        const mealMatches = assistantMessage.match(/Recipe name: ([^(\n]+)/g);
        if (mealMatches) {
          const mealNames = mealMatches.map(m => m.replace('Recipe name: ', '').trim());
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
            <img src="/mamas_menu_maker_icon.png" alt="Mama's Menu Maker" style={{width: 60, height: 60}} />
            <div>
              <h1>Mama's Menu Maker</h1>
              <p>AI dinner planning made easy</p>
            </div>
          </div>
        </div>
      </div>

      <div className="messages-container">
        <div className="messages-wrapper">
          {messages.map((msg, i) => (
            <div key={i} className={`message message-${msg.role}`}>
              <div className="message-bubble">
{msg.role === 'assistant' ? (
  <div dangerouslySetInnerHTML={{
    __html: msg.content
      .replace(/Recipe name:\s*([^\n]+)/g, 'Recipe name: <strong>$1</strong>')
  }} />
) : (
  msg.content
)}
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
              placeholder="Type your message..."
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
          )}
        </div>
      </div>
    </div>
  );
};

export default MealPlannerChat;
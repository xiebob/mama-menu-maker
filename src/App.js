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
        // Add unique IDs to recipes if they don't have them
        const recipesWithIds = data.map(recipe => ({
          ...recipe,
          id: recipe.id || recipe.name.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '') // Remove special chars
            .replace(/\s+/g, '_') // Use underscores to match AI output
            .trim()
        }));
        setRecipes(recipesWithIds);
        console.log('✅ Loaded', recipesWithIds.length, 'recipes with IDs:', recipesWithIds.slice(0, 3).map(r => `${r.name} -> ${r.id}`));
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
// Shuffle recipes so different ones appear first
const shuffledRecipes = [...recipes].sort(() => Math.random() - 0.5);
console.log('Sending', shuffledRecipes.length, 'recipes to AI prompt');

const recipesContext = shuffledRecipes.map(r => 
  `ID: ${r.id} | ${r.name}: ${r.ingredients.join(', ')} (${r.totalTime}m total, ${r.notes})`
).join('\n');

const systemPrompt = `You are a meal planning assistant. 

🧠 CONVERSATION CONTEXT:
- If this is the first message, create a new 3-meal plan
- If I'm giving feedback on an existing plan, MODIFY that plan (don't start over!)
- Examples of feedback: "swap meal 2", "replace the lasagna", "add more protein to meal 1"
- When modifying, keep the meals I didn't ask to change

🍽️ COMPLETE MEAL RULES:
Every dinner must have ALL THREE components:
- PROTEIN (e.g. meat, tofu, beans, eggs, cheese)
- VEGETABLES (fresh, cooked, roasted, or salad)  
- CARBS (e.g. rice, pasta, bread, potatoes, grains)

If a recipe is missing components, ADD simple items to complete it:

EXAMPLES:
- "Basic Chard" (just vegetables) → Add "grilled chicken breast" + "rice"
- "Tabouleh" (just grain) → Add "grilled chicken breast" 
- "Stir-fry" → Add "jasmine rice"
- "Pasta" dish → Add "green salad" if no vegetables

Here are all available recipes:
${recipesContext}

INSTRUCTIONS - READ CAREFULLY:
- Each meal = EXACTLY ONE recipe from the list (reference by ID)
- Do NOT suggest desserts, breakfasts, or side dishes as main meals
- Do NOT suggest multiple recipes per meal
- Each meal has: ONE one recipe ID, recipe name, cooking time, and shopping list

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
8. Format to report to user:
MEAL [number]
- Recipe ID: [exact ID]
- Cooking time: X min
- Add to complete meal: [rice, chicken breast, etc. - only if needed]
- Needed ingredients:
  • [ingredients for recipe AND ingredients for any suggested added components]

Focus on making every meal satisfying and complete!

CALENDAR WORKFLOW:
After the user approves a meal plan, ask them:
"Would you like me to create a calendar for these meals? Please provide 3 specific dates (e.g., January 15, January 17, January 20)"

When they provide dates, PREVIEW the calendar events first:
"Here's what I'll add to your calendar:

EVENT 1: [Date] 6:30-7:30 PM
Title: [Recipe Name + any added components]
Description: 
- Cook time: X minutes
- Key ingredients: [bullet list of main ingredients, no stock items]

EVENT 2: [Date] 6:30-7:30 PM
..." 

Ask for confirmation: "Does this look right? Say 'create calendar' and I'll generate the ICS file."

ICS FILE FORMAT:
When user says "create calendar", generate this exact format:

BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Mama's Menu Maker//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:meal-1-{timestamp}@meal-planner
DTSTART:{YYYYMMDD}T183000Z
DTEND:{YYYYMMDD}T193000Z
SUMMARY:{Recipe Name + any added components}
DESCRIPTION:Cook time: {X} minutes\\nKey ingredients:\\n• {ingredient1}\\n• {ingredient2}
URL:{recipe URL if available}
END:VEVENT
BEGIN:VEVENT
...repeat for each meal...
END:VEVENT
END:VCALENDAR

Tell user: "Copy this text and save it as 'meals.ics' to import into your calendar."`;

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

// Auto-inject recipe URLs and names by matching recipe IDs in the message
let enhancedMessage = assistantMessage;
console.log('🔍 Starting recipe ID replacement...');

recipes.forEach(recipe => {
  // Try exact match first
  const exactPattern = `Recipe ID: ${recipe.id}`;
  
  if (enhancedMessage.includes(exactPattern)) {
    console.log('✅ Exact match found:', recipe.name, '→', recipe.id);
    const replacement = `**${recipe.name}** (${recipe.totalTime}m)
📖 <a href="${recipe.url}" target="_blank" style="color: #2E5FF3; text-decoration: underline;">${recipe.url}</a>`;
    enhancedMessage = enhancedMessage.replace(exactPattern, replacement);
  } else {
    // Check if recipe ID appears anywhere in the message (for debugging)
    if (enhancedMessage.includes(recipe.id)) {
      console.log('⚠️ Partial match found but pattern failed:', recipe.name, '→', recipe.id);
      console.log('Expected pattern:', exactPattern);
      console.log('Message contains:', enhancedMessage.substring(enhancedMessage.indexOf(recipe.id) - 20, enhancedMessage.indexOf(recipe.id) + recipe.id.length + 20));
      
      // Try fuzzy matching for slight variations
      const fuzzyPattern = new RegExp(`Recipe ID:\\s*${recipe.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
      if (fuzzyPattern.test(enhancedMessage)) {
        console.log('✅ Fuzzy match worked for:', recipe.name);
        const replacement = `**${recipe.name}** (${recipe.totalTime}m)
📖 <a href="${recipe.url}" target="_blank" style="color: #2E5FF3; text-decoration: underline;">View Recipe</a>`;
        enhancedMessage = enhancedMessage.replace(fuzzyPattern, replacement);
      } else {
        console.log('❌ Fuzzy match also failed for:', recipe.name);
      }
    }
  }
});

// Check for any remaining unmatched Recipe IDs
const remainingIds = enhancedMessage.match(/Recipe ID: [^\n\r]+/g);
if (remainingIds) {
  console.log('❌ Unmatched Recipe IDs found:', remainingIds);
  console.log('Available recipe IDs:', recipes.slice(0, 5).map(r => r.id)); // Show first 5 for comparison
}

// Fallback: Hide any remaining raw Recipe IDs that didn't get replaced
enhancedMessage = enhancedMessage.replace(/Recipe ID: [^\n\r]+/g, '');
setMessages(prev => [...prev, { role: 'assistant', content: enhancedMessage }]);

      if (userMessage.toLowerCase().includes('yes') || userMessage.toLowerCase().includes('approve')) {
        // Extract recipe IDs from the AI's response
        const recipeIdMatches = assistantMessage.match(/Recipe ID: ([^\n\s]+)/g);
        if (recipeIdMatches) {
          const selectedRecipeIds = recipeIdMatches.map(m => m.replace('Recipe ID: ', '').trim());
          // Convert IDs back to recipe names for calendar generation
          const selectedRecipeNames = selectedRecipeIds.map(id => {
            const recipe = recipes.find(r => r.id === id);
            return recipe ? recipe.name : id;
          }).filter(name => name);
          setSelectedMeals(selectedRecipeNames);
          console.log('Selected meals:', selectedRecipeNames);
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
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // Convert **text** to <strong>
      .replace(/Recipe ID: ([^\n\s]+)/g, 'Recipe ID: <code>$1</code>') // Style recipe IDs
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
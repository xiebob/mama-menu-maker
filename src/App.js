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
const [loadingStatus, setLoadingStatus] = useState(''); // ADD THIS LINE
const [recipes, setRecipes] = useState([]);
const [selectedMeals, setSelectedMeals] = useState([]);
const [pendingCalendar, setPendingCalendar] = useState(null); // ADD THIS LINE
const [lastAssistantMessage, setLastAssistantMessage] = useState(null);
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

const extractMealsFromMessage = (text) => {
  const meals = [];
  const mealBlocks = text.match(/MEAL \d[\s\S]*?(?=MEAL \d|$)/g) || [];
  
  mealBlocks.forEach(block => {
    const nameMatch = block.match(/\*\*([^*]+)\*\*/);
    const addMatch = block.match(/Add to complete meal:\s*([^\n]+)/);
    
    meals.push({
      name: nameMatch ? nameMatch[1].trim() : 'Unknown meal',
      addedComponents: addMatch ? addMatch[1].trim() : ''
    });
  });
  
  return meals.length > 0 ? meals : [];
};

const downloadICSFile = (icsContent) => {
  const blob = new Blob([icsContent], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'meals.ics';
  a.click();
  URL.revokeObjectURL(url);
};

const generateICS = (meals, dates) => {
  let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Mama's Menu Maker//EN
CALSCALE:GREGORIAN`;

  // Helper function goes INSIDE generateICS
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}00`; // No Z = local time
  };

  // The forEach loop goes here
  meals.forEach((meal, i) => {
    const date = new Date(dates[i] + ' 6:30 PM');
    const endDate = new Date(dates[i] + ' 7:30 PM');
    
    // Find the recipe object to get details
    const recipeObj = recipes.find(r => r.name === meal.name);
    const cookTime = recipeObj?.totalTime || 'Unknown';
    const ingredients = recipeObj?.ingredients || [];
    const recipeUrl = recipeObj?.url || '';
    
    // Create title with added components
    const title = meal.addedComponents ? 
      `${meal.name} + ${meal.addedComponents}` : 
      meal.name;
    
    // Create description
    const keyIngredients = ingredients.slice(0, 5);
    const ingredientsList = keyIngredients.map(ing => `• ${ing}`).join('\\n');
    const description = `Cook time: ${cookTime} minutes\\n\\nKey ingredients:\\n${ingredientsList}\\n\\nRecipe: ${recipeUrl}`;
    
    ics += `
BEGIN:VEVENT
UID:meal-${i}-${Date.now()}@meal-planner
DTSTART:${formatDate(date)}
DTEND:${formatDate(endDate)}
SUMMARY:${title}
DESCRIPTION:${description}
URL:${recipeUrl}
END:VEVENT`;
  });

  ics += '\nEND:VCALENDAR';
  return ics;
};

const generateCalendarFromMessage = (userMessage) => {
  
  const dates = parseDatesFromMessage(userMessage);
  const meals = extractMealsFromMessage(lastAssistantMessage?.content || '');
  
  if (dates.length === 0 || meals.length === 0) {
setMessages(prev => [...prev, { 
  role: 'assistant', 
  content: `Here's your calendar file content:\n\n\`\`\`\n${icsContent}\n\`\`\`\n\nClick the "📅 Download ICS File" button below to save it, or copy the text above and save as 'meals.ics'.` 
}]);    return;
  }

  // Generate the actual ICS content
  const icsContent = generateICS(meals, dates);
  
  setMessages(prev => [...prev, { 
    role: 'assistant', 
    content: `Here's your calendar file content. Copy this and save as 'meals.ics':\n\n\`\`\`\n${icsContent}\n\`\`\`\n\nOr say "download calendar" and I'll create a downloadable file.` 
  }]);
  
  setPendingCalendar({ meals, dates, icsContent });
console.log('Set pendingCalendar:', { meals, dates, icsContent }); // ADD THIS
};


const parseDatesFromMessage = (message) => {
  // Extract dates like "jan 18, 19, 20" or "January 18, 19, and 20"
  const dateMatches = message.match(/\b(jan|january)\s*(\d{1,2})(?:\s*,?\s*(?:and\s*)?(\d{1,2}))?(?:\s*,?\s*(?:and\s*)?(\d{1,2}))?/i);
  
  if (!dateMatches) return [];
  
  const month = dateMatches[1].toLowerCase().startsWith('jan') ? 'January' : dateMatches[1];
  const dates = [dateMatches[2], dateMatches[3], dateMatches[4]].filter(Boolean);
  
  return dates.map(day => `${month} ${day}, 2026`);
};

  const downloadCalendar = () => {
    if (!pendingCalendar) return;
    const icsContent = generateICS(pendingCalendar.meals, pendingCalendar.dates);
    downloadICSFile(icsContent);
    setPendingCalendar(null);
  };

const sendMessage = async (e) => {
  e.preventDefault();
  if (!input.trim()) return;

const userMessage = input;
setInput('');
setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

// In your sendMessage function, add this check before the calendar detection:
if (userMessage.toLowerCase().includes('create calendar') && pendingCalendar) {
  // Generate and download ICS file
  const icsContent = generateICS(pendingCalendar.meals, pendingCalendar.dates);
  downloadICSFile(icsContent);
  setPendingCalendar(null); // Clear pending state
  
  setMessages(prev => [...prev, { 
    role: 'assistant', 
    content: 'Calendar created! The ICS file should download automatically. You can import it into any calendar app.' 
  }]);
  return;
}

// Check if user is providing calendar dates
const isCalendarRequest = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2})\s*(\d{1,2}|january|february|march|april|may|june|july|august|september|october|november|december)/i.test(userMessage);

if (isCalendarRequest) {
  // Handle calendar generation with JavaScript instead of AI
  generateCalendarFromMessage(userMessage);
  return;
}

setLoading(true);

  try {
    setLoadingStatus('🍰 Filtering out desserts from recipe collection...');
    
    // Filter desserts
    const dinnerRecipes = recipes.filter(recipe => {
      const name = recipe.name.toLowerCase();
      const dessertPatterns = [
        'cookie', 'cake', 'cupcake', 'brownie', 'pie', 'tart', 
        'ice cream', 'dessert', 'frosting', 'icing', 'cinnamon roll'
      ];
      return !dessertPatterns.some(pattern => name.includes(pattern));
    });

    setLoadingStatus('🎲 Shuffling your dinner recipes...');
    const shuffledRecipes = [...dinnerRecipes].sort(() => Math.random() - 0.5);
    console.log(`✅ Filtered from ${recipes.length} to ${dinnerRecipes.length} recipes`);

    setLoadingStatus(`🧠 Sending ${shuffledRecipes.length} recipes to AI for meal selection...`);
    
    const recipesContext = shuffledRecipes.map(r => 
      `ID: ${r.id} | ${r.name}: ${r.ingredients.join(', ')} (${r.totalTime}m total, ${r.notes})`
    ).join('\n');

    setLoadingStatus('⏳ AI analyzing recipes and selecting 3 dinners...');
    const systemPrompt = `You are a meal planning assistant.

🧠 CONVERSATION CONTEXT:
- If this is the first message, create a new 3-meal plan
- If I'm giving feedback on an existing plan, MODIFY that plan (don't start over!)
- Examples of feedback: "swap meal 2", "replace the lasagna", "add more protein to meal 1"
- When modifying, keep the meals I didn't ask to change

🍽️ COMPLETE MEAL RULES - CRITICAL:
Every dinner MUST have ALL THREE components:
1. PROTEIN: meat (beef, pork, lamb, chicken, fish), tofu, tempeh, beans, lentils, chickpeas, eggs, cheese
2. VEGETABLES: leafy greens, broccoli, carrots, peppers, mushrooms, tomatoes, etc. (NOT just onions/garlic)
3. CARBS: rice, pasta, bread, potatoes, quinoa, couscous, grains

⚠️ ANALYZE EACH RECIPE'S INGREDIENTS CAREFULLY:
Before selecting a recipe, CHECK what it contains:
- Look at the ingredient list to identify what's actually in the recipe
- Determine what's MISSING (protein, vegetables, or carbs)
- ADD simple sides to complete the meal

PROTEIN VARIETY - IMPORTANT:
When adding protein sides, VARY the proteins across meals:
- Meal 1: chicken breast OR tofu OR salmon
- Meal 2: chickpeas OR black beans OR eggs
- Meal 3: tempeh OR pork OR firm tofu
DO NOT default to chicken breast for everything!

EXAMPLES OF ANALYSIS:
- "Basic Chard" ingredients: chard, onion, oil, vinegar
  → Has: vegetables (chard)
  → Missing: PROTEIN + CARBS
  → Add: "baked tofu + quinoa"
  → Shopping list MUST include: firm tofu, quinoa (in addition to recipe ingredients)

- "Escarole and Beans" ingredients: escarole, beans, bacon, garlic, broth
  → Has: vegetables (escarole), protein (beans + bacon)
  → Missing: CARBS
  → Add: "rice" OR "crusty bread"
  → Shopping list MUST include: rice OR bread (in addition to recipe ingredients)

- "Pasta Primavera" ingredients: pasta, mixed vegetables, parmesan
  → Has: carbs (pasta), vegetables (mixed veg), protein (parmesan cheese)
  → Missing: NOTHING - complete meal!

- "Spinach and Orzo Salad" ingredients: orzo, spinach, goat cheese, pine nuts
  → Has: carbs (orzo), vegetables (spinach), protein (goat cheese)
  → Missing: NOTHING - complete meal!

🥗 SALADS AS MAIN MEALS:
Salads CAN be great main meals! But make sure they're substantial:
- Check if they have protein, carbs, and vegetables
- If missing components, add them (e.g., add crusty bread, or grilled chicken)
- Examples: "Great Green Salad + quinoa", "Caesar Salad + grilled chicken"

⚠️ DO NOT select:
- Desserts (cookies, cakes, brownies, pies, sweet treats)

✅ SIDES CAN BE SELECTED - Just pair them properly:
- "Pico de Gallo" → pair with grilled chicken breast or cheese nachos + black beans
- "Guacamole" → pair with cheese quesadillas or fish tacos
- "Focaccia" or bread → pair with a protein and vegetables
- Side recipes are GREAT - just make sure the complete meal has protein + vegetables + carbs

EXAMPLES of using side recipes:
- Recipe: "Pico de Gallo"
  → Add to complete meal: "grilled chicken breast + rice + tortilla chips"
  → This creates a complete dinner with the Pico as a component

- Recipe: "Focaccia"
  → Add to complete meal: "grilled salmon + roasted vegetables"
  → Bread becomes the carb component of a complete meal

✅ GOOD full dinner recipes (need fewer additions):
- Pasta dishes (e.g., "Pad Kee Mao", "Pasta Primavera", "Lasagna")
- Stir-fries with protein and vegetables
- Curries and stews (e.g., "Chana Chardy Saag")
- Hearty grain bowls or salads with protein
- Fish or meat with vegetables and grains

Here are all available recipes:
${recipesContext}

INSTRUCTIONS - READ CAREFULLY:
- Each meal = EXACTLY ONE recipe from the list (reference by ID)
- Do NOT suggest desserts, breakfasts, or side dishes as main meals
- Do NOT suggest multiple recipes per meal
- Each meal has: ONE recipe ID, recipe name, cooking time, and shopping list

Your responsibilities:
1. Plan 3 DINNER meals per week ONLY (exclude: desserts, breakfasts, appetizers)
2. For EACH meal, pick ONE recipe from the list that is appropriate for dinner
3. NO MORE than 2 meals per week contain meat (beef, pork, lamb, chicken, fish)
4. At least 1 meal must be vegetarian
5. ANALYZE each recipe's ingredients and ADD ONLY what's missing:
   - Missing PROTEIN? → Add: tofu, tempeh, beans, chickpeas, eggs, or meat (VARY the proteins!)
   - Missing VEGETABLES? → Add: roasted broccoli, steamed green beans, side salad, sautéed spinach
   - Missing CARBS? → Add: rice, quinoa, couscous, roasted potatoes, crusty bread

   ⚠️ IMPORTANT: Only add sides for MISSING components:
   - If recipe has vegetables (spinach, chard, salad greens, etc.) → DO NOT add more vegetables
   - If recipe has protein (chicken, tofu, beans, cheese, etc.) → DO NOT add more protein
   - If recipe has carbs (pasta, rice, orzo, bread, etc.) → DO NOT add more carbs

   BAD example: "Spinach and Orzo Salad" already has spinach (veg) + orzo (carbs) + cheese (protein)
   → DO NOT add "roasted broccoli" - it already has vegetables! ❌
6. 🚨 CRITICAL - SHOPPING LIST MUST BE COMPLETE:
   When you add sides, you MUST include those ingredients in the shopping list!

   CORRECT examples:
   - Add "roasted broccoli + quinoa" → Shopping list includes: broccoli, quinoa
   - Add "side salad" → Shopping list includes: salad greens, tomatoes, cucumber
   - Add "baked tofu" → Shopping list includes: firm tofu
   - Add "rice" → Shopping list includes: rice

   WRONG examples (missing side ingredients):
   - Add "roasted broccoli" but shopping list doesn't include broccoli ❌
   - Add "quinoa" but shopping list doesn't include quinoa ❌

7. 🚨 SHOPPING LIST - FILTER OUT STOCK ITEMS:
   The "Needed ingredients" list is for SHOPPING, not cooking. Only list what someone needs to BUY.

   ❌ NEVER INCLUDE these stock pantry items (people already have these):
   - ALL seasonings/spices: salt, pepper, Italian seasoning, dried herbs (thyme, basil, oregano), red pepper flakes, bay leaf
   - ALL oils/fats: olive oil, vegetable oil, butter, cooking spray
   - ALL aromatics: garlic (fresh or dried/minced), onion (fresh or dried/minced), bell pepper
   - ALL condiments: vinegar (any type), lemon juice, lime juice, soy sauce, Worcestershire sauce, hot sauce
   - ALL baking basics: flour, sugar, brown sugar, baking soda, baking powder
   - ALL dairy staples: eggs, milk
   - Ground pepper (black, white, any color)

   ✅ DO INCLUDE items people need to buy:
   - Fresh proteins: chicken breast, salmon, tofu, tempeh, ground beef
   - Fresh vegetables: broccoli, salad greens, bell peppers, carrots, chard, escarole
   - Grains/carbs: rice, quinoa, pasta, couscous, bread
   - Specialty items: chickpeas, beans, cannellini beans, nuts, cheese (parmesan, feta)
   - Fresh ingredients: lemon, lime, fresh parsley, fresh ginger

   EXAMPLE - Escarole and Beans recipe:
   Recipe ingredients: bacon, olive oil, escarole, garlic, chicken broth, cannellini beans, red pepper flakes, parmesan
   ✅ Shopping list should be: bacon, escarole, chicken broth, cannellini beans, parmesan
   ❌ DO NOT include: olive oil, garlic, red pepper flakes (these are pantry staples)

8. ⚠️ BEFORE WRITING EACH MEAL - FINAL REVIEW:
   Go through your shopping list and DELETE any of these items:
   - salt, pepper, any spices, Italian seasoning, herbs, bay leaf
   - olive oil, vegetable oil, butter
   - garlic, onion, bell pepper (unless it's a main ingredient like stuffed peppers)
   - lemon juice, lime juice, vinegar
   - dried minced anything (garlic, onion)

9. 🚨 REQUIRED FORMAT - Follow this EXACTLY:
MEAL [number]
- Recipe ID: [exact recipe ID from the list]
- Cooking time: X min
- Add to complete meal: [only if needed - e.g., "rice" or "roasted broccoli + quinoa"]
- Needed ingredients (to BUY):
  • [ingredient 1 - NO salt/pepper/oil/garlic/onion/spices]
  • [ingredient 2 - NO salt/pepper/oil/garlic/onion/spices]
  • [ingredient 3 - NO salt/pepper/oil/garlic/onion/spices]

FORMATTING RULES:
- DO NOT use comments like /* Broccoli */ or section headers
- FINAL CHECK: Remove salt, pepper, oil, butter, garlic, onion, vinegar, lemon/lime juice, spices, dried seasonings
- Use simple bullet points (•) only
- List ingredients as a flat list, not grouped by sections
- Always include the Recipe ID line

CORRECT FORMAT EXAMPLES:

Example 1 (Complete recipe with one addition):
MEAL 1
- Recipe ID: escarole-and-beans
- Cooking time: 25 min
- Add to complete meal: rice
- Needed ingredients (to BUY):
  • bacon
  • escarole
  • chicken broth
  • cannellini beans
  • parmesan cheese
  • rice

Example 2 (Side recipe built into a meal):
MEAL 2
- Recipe ID: pico-de-gallo
- Cooking time: 15 min
- Add to complete meal: grilled chicken breast + cilantro lime rice + tortilla chips
- Needed ingredients (to BUY):
  • tomatoes
  • lime
  • cilantro
  • jalapeño pepper
  • chicken breast
  • rice
  • tortilla chips

Focus on making every meal satisfying, complete, and VARIED in protein sources!

CALENDAR WORKFLOW - DO NOT CREATE CALENDAR AUTOMATICALLY:
⚠️ IMPORTANT: Only mention the calendar AFTER presenting the meal plan.

Step 1: Present the 3 meal plan
Step 2: STOP and ask: "Would you like me to create a calendar for these meals? If yes, please provide 3 specific dates (e.g., January 15, January 17, January 20)"
Step 3: WAIT for the user to provide dates - DO NOT assume dates or create a preview automatically
Step 4: Only when user provides dates, show the calendar preview
Step 5: Wait for user to say "create calendar" before generating ICS format`;

    // Use EventSource for streaming responses
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

    // Handle streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let assistantMessage = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.substring(6));

          if (data.type === 'progress') {
            // Update status with progress info
            setLoadingStatus(`⏳ AI generating meal plan... (${data.elapsed}s elapsed, ${data.tokens} tokens)`);
          } else if (data.done) {
            // Final response received
            assistantMessage = data.content[0].text;
          } else if (data.error) {
            throw new Error(data.error);
          }
        }
      }
    }

setLoadingStatus('🔗 Adding recipe links and finalizing meal plan...');

      if (!assistantMessage) {
        throw new Error('No response received from AI');
      }

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
    const assistantMsg = { role: 'assistant', content: enhancedMessage };
    setMessages(prev => [...prev, assistantMsg]);
    setLastAssistantMessage(assistantMsg);

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
    setLoadingStatus('');
  }
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
      <div className="loading-container">
        <video
          className="loading-animation-video"
          autoPlay
          loop
          muted
          playsInline
        >
          <source src="/xiebob_a_warm_friendly_icon_for_an_app_called_Mamas_Menu_Make_527582d6-7d36-4405-9136-205bd0eacb3f_1.mp4" type="video/mp4" />
        </video>
        {loadingStatus && (
          <div className="loading-status">
            {loadingStatus}
          </div>
        )}
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

{pendingCalendar && (
  <button
    onClick={() => {
      downloadICSFile(pendingCalendar.icsContent);
      setPendingCalendar(null); // Clear after download
    }}
    className="download-button"
    style={{ marginTop: '8px' }}
  >
    📅 Download ICS File
  </button>
)}        </div>
      </div>
    </div>
  );
};

export default MealPlannerChat;
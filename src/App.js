import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const MealPlannerChat = () => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I\'m Mama\'s Menu Maker. I\'m ready to plan your dinners! Got any spare ingredients you want to use up as sides? List them, or just type "go" to get started!'
    }
  ]);
const [input, setInput] = useState('');
const [loading, setLoading] = useState(false);
const [loadingStatus, setLoadingStatus] = useState(''); // ADD THIS LINE
const [recipes, setRecipes] = useState([]);
const [selectedMeals] = useState([]);
const [pendingCalendar, setPendingCalendar] = useState(null); // ADD THIS LINE
const [, setLastAssistantMessage] = useState(null);
const [currentMealPlan, setCurrentMealPlan] = useState(null); // persists { selectedRecipes, meals }
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

  if (dates.length === 0 || !currentMealPlan) {
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: !currentMealPlan
        ? `No meal plan yet! Hit Send to get one first.`
        : `I need 3 dates to make a calendar. Try something like "Jan 10, 12, 14".`
    }]);
    return;
  }

  // Build meals array from currentMealPlan for ICS generation
  const meals = currentMealPlan.selectedRecipes.map((recipe, i) => ({
    name: recipe.name,
    addedComponents: currentMealPlan.meals[i]?.sides || ''
  }));

  const icsContent = generateICS(meals, dates);
  setPendingCalendar({ meals, dates, icsContent });

  setMessages(prev => [...prev, {
    role: 'assistant',
    content: `Got it! Say "download calendar" and I'll save the ICS file for you.`
  }]);
};


const parseDatesFromMessage = (message) => {
  const monthMap = {
    jan: 'January', january: 'January',
    feb: 'February', february: 'February',
    mar: 'March', march: 'March',
    apr: 'April', april: 'April',
    may: 'May',
    jun: 'June', june: 'June',
    jul: 'July', july: 'July',
    aug: 'August', august: 'August',
    sep: 'September', september: 'September',
    oct: 'October', october: 'October',
    nov: 'November', november: 'November',
    dec: 'December', december: 'December',
  };

  // Match month followed by up to 3 numbers separated by commas/and
  const dateMatches = message.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{1,2})(?:\s*,?\s*(?:and\s*)?(\d{1,2}))?(?:\s*,?\s*(?:and\s*)?(\d{1,2}))?/i);

  if (!dateMatches) return [];

  const month = monthMap[dateMatches[1].toLowerCase()] || dateMatches[1];
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

const userMessage = input.trim() || 'go';
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

// Detect "calendar me" / "make a calendar" without dates → prompt for dates
const isCalendarIntent = /\bcalendar\b/i.test(userMessage);
if (isCalendarIntent && currentMealPlan) {
  setMessages(prev => [...prev, {
    role: 'assistant',
    content: `Sure! What 3 dates should I put these meals on? (e.g. "Jan 10, 12, 14")`
  }]);
  return;
}

// Detect "swap meal N" or "new meal N" → re-roll just that one
const swapMatch = userMessage.match(/\b(?:swap|change|new|replace)\s+meal\s*(\d)/i);
if (swapMatch && currentMealPlan) {
  const swapIndex = parseInt(swapMatch[1]) - 1;
  if (swapIndex >= 0 && swapIndex < currentMealPlan.selectedRecipes.length) {
    setLoading(true);
    setLoadingStatus(`🔄 Swapping meal ${swapIndex + 1}...`);
    try {
      // Pick a new recipe that isn't already in the plan
      const currentIds = currentMealPlan.selectedRecipes.map(r => r.id);
      const pool = recipes.filter(r => !currentIds.includes(r.id));
      const newRecipe = pool[Math.floor(Math.random() * pool.length)];
      const newSelectedRecipes = [...currentMealPlan.selectedRecipes];
      newSelectedRecipes[swapIndex] = newRecipe;
      // Re-run AI with the updated recipe set
      await runMealPlan(newSelectedRecipes, []);
    } catch (error) {
      console.error('Swap error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, error swapping: ${error.message}` }]);
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
    return;
  }
}

// If a plan already exists and this isn't a "new"/"start over" request, treat as a tweak
const isNewRequest = /\b(new|start over|again|redo|re-do|fresh)\b/i.test(userMessage) || !currentMealPlan;
if (!isNewRequest && currentMealPlan) {
  // Send to AI with the SAME recipes, letting it know what the user wants tweaked
  setLoading(true);
  setLoadingStatus('🧠 Tweaking your meal plan...');
  try {
    await runMealPlan(currentMealPlan.selectedRecipes, userMessage.split(/[,/]|and\b/i).map(t => t.trim()).filter(t => t.length > 1));
  } catch (error) {
    console.error('Tweak error:', error);
    setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, error: ${error.message}` }]);
  } finally {
    setLoading(false);
    setLoadingStatus('');
  }
  return;
}

setLoading(true);

  try {
    // Fresh roll: parse user's spare ingredients
    const userTerms = userMessage.trim()
      ? userMessage.split(/[,/]|and\b/i)
          .map(t => t.replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, '').trim())
          .filter(t => t.length > 1)
      : [];

    // Fisher-Yates shuffle for uniform randomness
    const shuffled = [...recipes];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selectedRecipes = shuffled.slice(0, 3);

    setLoadingStatus(`🎲 Picked 3 random recipes...`);
    await runMealPlan(selectedRecipes, userTerms);
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

  const runMealPlan = async (selectedRecipes, userTerms) => {
    const recipesContext = selectedRecipes.map((r, i) =>
      `MEAL ${i + 1}: ${r.name}
Ingredients: ${r.ingredients.join(', ')}
Cook time: ${r.cookTime} min
Total time: ${r.totalTime} min
URL: ${r.url}
Recipe ID: ${r.id}`
    ).join('\n\n');

    setLoadingStatus('🧠 AI analyzing ingredients and suggesting sides...');
    const systemPrompt = `You are a meal planning assistant. I've already selected 3 random recipes for this week's dinners. Your job is to:

1. ANALYZE each recipe's ingredients
2. DETERMINE what's missing to make a complete meal
3. SUGGEST simple sides to add

🍽️ COMPLETE MEAL RULES - CRITICAL:
Every dinner MUST have ALL THREE components:
1. PROTEIN: meat (beef, pork, lamb, chicken, fish), tofu, tempeh, beans, lentils, chickpeas, eggs, cheese
2. VEGETABLES: leafy greens, broccoli, carrots, peppers, mushrooms, tomatoes, etc. (NOT just onions/garlic)
3. CARBS: rice, pasta, bread, potatoes, quinoa, couscous, grains

⚠️ ANALYZE EACH RECIPE'S INGREDIENTS CAREFULLY:
Check what it contains:
- Look at the ingredient list to identify what's actually in the recipe
- Determine what's MISSING (protein, vegetables, or carbs)
- ADD simple sides to complete the meal

PROTEIN VARIETY - IMPORTANT:
When adding protein sides, VARY the proteins across meals:
- Meal 1: chicken breast OR tofu OR salmon
- Meal 2: chickpeas OR black beans OR eggs
- Meal 3: tempeh OR pork OR firm tofu
DO NOT default to chicken breast for everything!

⚠️ VEGETABLES RULE - BE STRICT:
Onions, garlic, and peppers used as base aromatics do NOT count as a vegetable component.
A meal needs a real veggie: leafy greens, broccoli, carrots, green beans, a salad, roasted veggies, etc.
If a recipe is a stew or sauce-based dish with only aromatics, it NEEDS a veggie side.

⚠️ PROTEIN RULE - BE PRACTICAL:
Cheese-heavy dishes (mac and cheese, lasagna, pizza) already have enough protein.
Do NOT add chickpeas or beans to mac and cheese. Just add a veggie side.

EXAMPLES OF ANALYSIS:
- "Basic Chard" ingredients: chard, onion, oil, vinegar
  → Has: vegetables (chard)
  → Missing: PROTEIN + CARBS
  → Add: "baked tofu + quinoa"

- "Escarole and Beans" ingredients: escarole, beans, bacon, garlic, broth
  → Has: vegetables (escarole), protein (beans + bacon)
  → Missing: CARBS
  → Add: "rice" OR "crusty bread"

- "Pasta Primavera" ingredients: pasta, mixed vegetables, parmesan
  → Has: carbs (pasta), vegetables (mixed veg), protein (parmesan cheese)
  → Missing: NOTHING - complete meal!

- "Hungarian Goulash" ingredients: beef, onion, paprika, egg noodles, broth
  → Has: protein (beef), carbs (egg noodles)
  → Onion is just an aromatic, does NOT count as vegetable
  → Missing: VEGETABLES
  → Add: "steamed green beans" OR "side salad"

- "Mac and Cheese" ingredients: pasta, cheddar, gruyere, butter, milk
  → Has: carbs (pasta), protein (cheese is plenty)
  → Missing: VEGETABLES only
  → Add: "steamed broccoli" or "side salad"
  → Do NOT add chickpeas or beans — cheese is enough protein

Here are the 3 recipes I've selected:
${recipesContext}
${userTerms.length > 0 ? `\nThe user wants to use up or incorporate these ingredients: ${userTerms.join(', ')}.\nWhen suggesting sides to complete a meal, PRIORITIZE these ingredients over generic defaults.` : ''}

Your responsibilities:
1. ANALYZE each recipe's ingredients and ADD ONLY what's missing:
   - Missing PROTEIN? → Add: tofu, tempeh, beans, chickpeas, eggs, or meat (VARY the proteins!)
   - Missing VEGETABLES? → Add: roasted broccoli, steamed green beans, side salad, sautéed spinach
   - Missing CARBS? → Add: rice, quinoa, couscous, roasted potatoes, crusty bread

   ⚠️ IMPORTANT: Only add sides for MISSING components:
   - If recipe has vegetables (spinach, chard, salad greens, etc.) → DO NOT add more vegetables
   - If recipe has protein (chicken, tofu, beans, cheese, etc.) → DO NOT add more protein
   - If recipe has carbs (pasta, rice, orzo, bread, etc.) → DO NOT add more carbs

2. 🚨 CRITICAL - SHOPPING LIST MUST BE COMPLETE:
   When you add sides, you MUST include those ingredients in the shopping list!

   CORRECT examples:
   - Add "roasted broccoli + quinoa" → Shopping list includes: broccoli, quinoa
   - Add "side salad" → Shopping list includes: salad greens, tomatoes, cucumber
   - Add "baked tofu" → Shopping list includes: firm tofu
   - Add "rice" → Shopping list includes: rice

3. 🚨 SHOPPING LIST - FILTER OUT STOCK ITEMS:
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

4. ⚠️ BEFORE WRITING EACH MEAL - FINAL REVIEW:
   Go through your shopping list and DELETE any of these items:
   - salt, pepper, any spices, Italian seasoning, herbs, bay leaf
   - olive oil, vegetable oil, butter
   - garlic, onion, bell pepper (unless it's a main ingredient like stuffed peppers)
   - lemon juice, lime juice, vinegar
   - dried minced anything (garlic, onion)

🚨 REQUIRED FORMAT - Follow this EXACTLY:
MEAL [number]
- Recipe ID: [exact recipe ID from above]
- Cooking time: X min
- Add to complete meal: [only if needed - simple ingredient names like "rice" or "roasted broccoli"]
- Shopping list:
  • [ingredient 1 - NO salt/pepper/oil/garlic/onion/spices]
  • [ingredient 2 - NO salt/pepper/oil/garlic/onion/spices]
  • [ingredient 3 - NO salt/pepper/oil/garlic/onion/spices]

FORMATTING RULES:
- Recipe ID = The exact ID from above (already provided to you)
- Add to complete meal = simple ingredients to add (e.g., "rice" or "crusty bread")
- FINAL CHECK: Remove salt, pepper, oil, butter, garlic, onion, vinegar, lemon/lime juice, spices, dried seasonings
- Use simple bullet points (•) only
- List ingredients as a flat list, not grouped by sections

EXAMPLE:
MEAL 1
- Recipe ID: escarole-and-beans
- Cooking time: 25 min
- Add to complete meal: rice
- Shopping list:
  • bacon
  • escarole
  • chicken broth
  • cannellini beans
  • parmesan cheese
  • rice

Focus on making every meal satisfying, complete, and VARIED in protein sources!

CALENDAR WORKFLOW - DO NOT CREATE CALENDAR AUTOMATICALLY:
⚠️ IMPORTANT: Only mention the calendar AFTER presenting the meal plan.

Step 1: Present the 3 meal plan
Step 2: STOP and ask: "Would you like me to create a calendar for these meals? If yes, please provide 3 specific dates (e.g., January 15, January 17, January 20)"
Step 3: WAIT for the user to provide dates - DO NOT assume dates or create a preview automatically
Step 4: Only when user provides dates, show the calendar preview
Step 5: Wait for user to say "create calendar" before generating ICS format`;

    // Use EventSource for streaming responses
    const response = await fetch('/api/chat', {
      method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Please analyze these recipes and create the meal plan.' }],
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

// Rebuild meals with correct data from recipes.json
const sideIngredients = {
  'tempeh': 'tempeh',
  'tofu': 'firm tofu',
  'baked tofu': 'firm tofu',
  'chicken breast': 'chicken breast',
  'grilled chicken': 'chicken breast',
  'salmon': 'salmon fillet',
  'rice': 'rice',
  'basmati rice': 'basmati rice',
  'jasmine rice': 'jasmine rice',
  'quinoa': 'quinoa',
  'broccoli': 'broccoli florets',
  'roasted broccoli': 'broccoli florets',
  'steamed broccoli': 'broccoli florets',
  'chickpeas': 'canned chickpeas',
  'black beans': 'canned black beans',
  'crusty bread': 'crusty bread'
};

function extractSideIngredients(sidesText) {
  const ingredients = [];
  Object.keys(sideIngredients).forEach(side => {
    if (sidesText.toLowerCase().includes(side)) {
      ingredients.push(sideIngredients[side]);
    }
  });
  return ingredients;
}

// Parse meals and extract structure from AI response
const lines = assistantMessage.split('\n');
console.log('Total lines in AI response:', lines.length);
console.log('First 10 lines:', lines.slice(0, 10));
const meals = [];
let currentMeal = null;
const otherLines = [];

// Match meals with selectedRecipes by order
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.match(/^\s*MEAL\s*(\d+)/)) {
    const mealNum = parseInt(line.match(/^\s*MEAL\s*(\d+)/)[1]);
    console.log('Found meal header at line', i, ':', line);
    if (currentMeal) meals.push(currentMeal);

    // Use the recipe we already selected (by index)
    const recipe = selectedRecipes[mealNum - 1];
    console.log(`Meal ${mealNum} selectedRecipes array:`, selectedRecipes);
    console.log(`Looking for recipe at index ${mealNum - 1}:`, recipe);
    currentMeal = {
      mealNum: line,
      recipeId: recipe?.id,
      sides: null,
      recipe: recipe
    };
    console.log(`Meal ${mealNum} -> ${recipe?.name} (${recipe?.id})`);
  } else if (currentMeal && line.includes('Recipe ID:')) {
    // Skip - we already have the recipe from selectedRecipes
  } else if (currentMeal && line.includes('Add to complete meal:')) {
    currentMeal.sides = line.substring(line.indexOf(':') + 1).trim();
  } else if (currentMeal && line.includes('Cooking time:')) {
    // Skip - we'll use recipe data
  } else if (currentMeal && (line.includes('Needed ingredients') || line.includes('Shopping list'))) {
    // Skip the shopping list header - we'll rebuild from recipe data
  } else if (currentMeal && line.trim().startsWith('•')) {
    // Skip ingredient bullets - we'll rebuild from recipe data
  } else if (!currentMeal) {
    // Lines before first meal (like intro text)
    otherLines.push(line);
  }
}

// Don't forget the last meal
if (currentMeal) meals.push(currentMeal);

// Now rebuild each meal with complete data from recipes.json
const finalMessage = [...otherLines];

// Fetch Unsplash images for each meal in parallel
const foodImages = await Promise.all(meals.map(async (mealData) => {
  try {
    if (!mealData.recipe?.name) return null;
    const res = await fetch(`/api/food-image?q=${encodeURIComponent(mealData.recipe.name)}`);
    const data = await res.json();
    return data.image || null;
  } catch (e) {
    return null;
  }
}));

console.log('Processing meals:', meals.length);
console.log('All meals data:', meals);
meals.forEach((mealData, index) => {
  console.log(`Meal ${index + 1} full data:`, mealData);
  console.log(`Meal ${index + 1} recipe:`, mealData.recipe);

  if (index > 0) finalMessage.push(''); // Add spacing

  // Build complete meal section
  finalMessage.push(mealData.mealNum); // MEAL X

  if (mealData.recipe) {
    // Recipe name and URL from recipes.json
    finalMessage.push(`- **${mealData.recipe.name}** (${mealData.recipe.totalTime}m)`);
    if (foodImages[index]) {
      finalMessage.push(`<img src="${foodImages[index]}" alt="${mealData.recipe.name}" style="width: 150px; height: 150px; object-fit: cover; border-radius: 8px; margin: 4px 0;" />`);
    }
    finalMessage.push(`📖 <a href="${mealData.recipe.url}" target="_blank" style="color: #2E5FF3; text-decoration: underline;">View Recipe</a>`);

    // Cooking time from recipes.json
    finalMessage.push(`- Cooking time: ${mealData.recipe.cookTime} min`);

    // Add to complete meal (if provided by AI)
    if (mealData.sides) {
      finalMessage.push(`- Add to complete meal: **${mealData.sides}**`);
    }

    // Shopping list from recipes.json + sides
    finalMessage.push('- Shopping list:');

    const shoppingList = [];

    // Add recipe ingredients (already cleaned in recipes.json)
    if (mealData.recipe.ingredients) {
      mealData.recipe.ingredients.forEach(ing => {
        shoppingList.push(ing);
      });
    }

    // Add side ingredients
    if (mealData.sides) {
      const sideIngredients = extractSideIngredients(mealData.sides);
      shoppingList.push(...sideIngredients);
    }

    // Output deduplicated shopping list
    const uniqueList = [...new Set(shoppingList)];
    uniqueList.forEach(item => {
      finalMessage.push(`  • ${item}`);
    });
  } else {
    // Recipe not found - show error
    finalMessage.push(`⚠️ Recipe ID "${mealData.recipeId}" not found in database`);
    if (mealData.sides) {
      finalMessage.push(`- Add to complete meal: ${mealData.sides}`);
    }
  }
});

const cleanedMessage = finalMessage.join('\n');

    const assistantMsg = { role: 'assistant', content: cleanedMessage };
    setMessages(prev => [...prev, assistantMsg]);
    setLastAssistantMessage(assistantMsg);
    setCurrentMealPlan({ selectedRecipes, meals });

    // Prompt user with next steps
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `What would you like to do?\n• **Calendar** — give me 3 dates (e.g. "feb 5, 6, 7") and I'll make an ICS file\n• **Swap** — say "swap meal 1" (or 2 or 3) to re-roll one\n• **New** — say "new" to pick 3 fresh recipes`
    }]);
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
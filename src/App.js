import React, { useState, useEffect } from 'react';
import { Download, X, Clock, Flame, ChefHat } from 'lucide-react';

const MealPlanner = () => {
  const [stage, setStage] = useState('loading');
  const [meals, setMeals] = useState([]);
  const [selectedDates, setSelectedDates] = useState({});
  const [fridgeIngredients, setFridgeIngredients] = useState([]);
  const [fridgeInput, setFridgeInput] = useState('');
  const [allRecipes, setAllRecipes] = useState([]);

  useEffect(() => {
    fetch('/recipes.json')
      .then(res => res.json())
      .then(data => {
        setAllRecipes(data);
        setStage('fridge');
      })
      .catch(err => {
        console.error('Error loading recipes:', err);
        setStage('fridge');
      });
  }, []);

  const generateMeals = () => {
    let available = allRecipes;
    
    if (fridgeIngredients.length > 0) {
      available = allRecipes.filter(recipe => 
        recipe.ingredients.some(ing => 
          fridgeIngredients.some(fridge => 
            ing.toLowerCase().includes(fridge) || fridge.includes(ing.toLowerCase())
          )
        )
      );
    }
    
    if (available.length === 0) {
      available = allRecipes;
    }
    
    const shuffled = available.sort(() => Math.random() - 0.5);
    setMeals(shuffled.slice(0, 3).map(r => ({ ...r, id: Math.random().toString(36).substr(2, 9), approved: false })));
    setStage('approving');
  };

  const getTimeComplexity = (t) => {
    if (t <= 30) return { label: 'Quick', color: 'bg-green-100 text-green-700', icon: 'bolt' };
    if (t <= 60) return { label: 'Medium', color: 'bg-blue-100 text-blue-700', icon: 'clock' };
    if (t <= 120) return { label: 'Long', color: 'bg-orange-100 text-orange-700', icon: 'hourglass' };
    return { label: 'Slow cooker', color: 'bg-purple-100 text-purple-700', icon: 'flame' };
  };

  const getShoppingList = (meal) => {
    return meal.ingredients.filter(i => !fridgeIngredients.some(f => i.toLowerCase().includes(f)));
  };

  const createICS = () => {
    let ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Meal Planner//EN\n';
    meals.forEach(meal => {
      const date = selectedDates[meal.id];
      if (!date) return;
      const d = new Date(date);
      const dateStr = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
      ics += `BEGIN:VEVENT\nUID:${meal.id}\nDTSTART:${dateStr}T180000\nDTEND:${dateStr}T190000\nSUMMARY:${meal.name}\nDESCRIPTION:Prep ${meal.prepTime}m Cook ${meal.cookTime}m\\n${meal.notes}\\nShopping: ${getShoppingList(meal).join(', ')}\nURL:${meal.url}\nEND:VEVENT\n`;
    });
    ics += 'END:VCALENDAR';
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meals.ics';
    a.click();
  };

  const allApproved = meals.every(m => m.approved);
  const allDated = meals.every(m => selectedDates[m.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <ChefHat className="text-emerald-600" size={32} />
            <h1 className="text-4xl font-bold text-slate-900">Meal Planner</h1>
          </div>
          <p className="text-slate-500">Plan your week from your Google Drive recipes</p>
        </div>

        {stage === 'loading' && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4"></div>
              <p className="text-slate-600">Loading your recipes...</p>
            </div>
          </div>
        )}

        {stage === 'fridge' && (
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">What ingredients do you have?</h2>
            <p className="text-slate-600 mb-4">Enter ingredients you have on hand to find recipes that use them</p>
            
            <div className="flex gap-2 mb-6">
              <input 
                type="text" 
                value={fridgeInput} 
                onChange={(e) => setFridgeInput(e.target.value)} 
                onKeyPress={(e) => e.key === 'Enter' && fridgeInput.trim() && setFridgeIngredients([...fridgeIngredients, fridgeInput.trim().toLowerCase()]) && setFridgeInput('')}
                placeholder="e.g., garlic, butter, tomatoes..." 
                className="flex-1 border border-slate-300 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <button 
                onClick={() => fridgeInput.trim() && setFridgeIngredients([...fridgeIngredients, fridgeInput.trim().toLowerCase()]) && setFridgeInput('')} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Add
              </button>
            </div>

            {fridgeIngredients.length > 0 && (
              <div className="mb-6">
                <p className="text-slate-600 text-sm mb-3 font-medium">Your pantry:</p>
                <div className="flex flex-wrap gap-2">
                  {fridgeIngredients.map(i => (
                    <span key={i} className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-full text-sm font-medium flex items-center gap-2 border border-emerald-200">
                      {i} 
                      <button 
                        onClick={() => setFridgeIngredients(fridgeIngredients.filter(x => x !== i))}
                        className="hover:text-emerald-900"
                      >
                        <X size={16} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button 
              onClick={() => setStage('index')} 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg"
            >
              Continue — {allRecipes.length} recipes ready
            </button>
          </div>
        )}

        {stage === 'index' && (
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Let's plan your meals</h2>
            <p className="text-slate-600 mb-6">{allRecipes.length} recipes loaded from your Google Drive</p>
            <button 
              onClick={generateMeals} 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg"
            >
              Generate 3 random meals
            </button>
          </div>
        )}

        {stage === 'approving' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Review & approve</h2>
            {meals.map((meal, i) => {
              const c = getTimeComplexity(meal.totalTime);
              const shopping = getShoppingList(meal);
              return (
                <div key={meal.id} className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">Meal {i + 1}: {meal.name}</h3>
                        <div className="flex gap-2 mt-2">
                          <div className={`${c.color} px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1`}>
                            <Clock size={14} /> {meal.prepTime}m prep
                          </div>
                          <div className={`${c.color} px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1`}>
                            <Flame size={14} /> {meal.cookTime}m cook
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setMeals(meals.map(m => m.id === meal.id ? {...m, approved: !m.approved} : m))} 
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            meal.approved 
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {meal.approved ? '✓ Approved' : 'Approve'}
                        </button>
                        <button
                          onClick={() => {
                            const remaining = allRecipes.filter(r => !meals.find(m => m.name === r.name));
                            if (remaining.length > 0) {
                              const newRecipe = remaining[Math.floor(Math.random() * remaining.length)];
                              setMeals(meals.map(m => m.id === meal.id ? {...newRecipe, id: meal.id, approved: false} : m));
                            }
                          }}
                          className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                        >
                          Swap
                        </button>
                      </div>
                    </div>

                    {meal.notes && <p className="text-slate-600 italic text-sm mb-4">{meal.notes}</p>}

                    {shopping.length > 0 && (
                      <div className="mb-4">
                        <p className="text-slate-700 font-semibold text-sm mb-2">Need to buy:</p>
                        <div className="flex flex-wrap gap-2">
                          {shopping.map((ing, j) => (
                            <span key={j} className="bg-red-50 text-red-700 text-xs px-3 py-1 rounded-full border border-red-200">
                              {ing}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <a href={meal.url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 text-sm font-semibold">
                      View recipe →
                    </a>
                  </div>
                </div>
              );
            })}
            <button 
              onClick={() => allApproved && setStage('scheduling')} 
              disabled={!allApproved} 
              className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                allApproved 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg' 
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              }`}
            >
              {allApproved ? 'Next: Schedule meals' : 'Approve all meals first'}
            </button>
          </div>
        )}

        {stage === 'scheduling' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Schedule your meals</h2>
            {meals.map((meal, i) => (
              <div key={meal.id} className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 hover:shadow-lg transition-shadow">
                <h3 className="font-bold text-slate-900 mb-3">Meal {i + 1}: {meal.name}</h3>
                <input 
                  type="date" 
                  value={selectedDates[meal.id] || ''} 
                  onChange={(e) => setSelectedDates({...selectedDates, [meal.id]: e.target.value})} 
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            ))}
            <button 
              onClick={() => allDated && setStage('preview')} 
              disabled={!allDated} 
              className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                allDated 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg' 
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              }`}
            >
              {allDated ? 'Preview calendar' : 'Select all dates first'}
            </button>
          </div>
        )}

        {stage === 'preview' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Your meal calendar</h2>
            {meals.map(meal => {
              const d = new Date(selectedDates[meal.id]);
              const shopping = getShoppingList(meal);
              return (
                <div key={meal.id} className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 border-l-4 border-l-emerald-500 hover:shadow-lg transition-shadow">
                  <h3 className="font-bold text-lg text-slate-900 mb-1">{meal.name}</h3>
                  <p className="text-slate-500 text-sm mb-3">
                    {d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at 6:30 PM
                  </p>
                  
                  <div className="flex gap-4 mb-4 text-sm">
                    <span className="text-slate-600"><Clock size={14} className="inline mr-1" /> {meal.prepTime}m prep</span>
                    <span className="text-slate-600"><Flame size={14} className="inline mr-1" /> {meal.cookTime}m cook</span>
                  </div>

                  {meal.notes && <p className="text-slate-600 italic mb-4">{meal.notes}</p>}

                  {shopping.length > 0 && (
                    <div className="bg-slate-50 rounded-lg p-4 mb-4">
                      <p className="font-semibold text-slate-900 text-sm mb-2">Shopping list:</p>
                      <p className="text-sm text-slate-700">{shopping.join(', ')}</p>
                    </div>
                  )}

                  <a href={meal.url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 text-sm font-semibold">
                    Recipe link →
                  </a>
                </div>
              );
            })}

            <button 
              onClick={createICS} 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <Download size={18} /> Download to calendar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MealPlanner;
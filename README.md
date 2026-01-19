# Meal Planner

A React-based meal planner application that uses Ollama and Mistral for AI-powered meal suggestions.

## Prerequisites

Before getting started, make sure you have:

1. **Ollama running** - The app requires Ollama to be running locally on `localhost:11434`
   - Install Ollama from [ollama.ai](https://ollama.ai)
   - Start the Ollama desktop app
   - Pull the Mistral model: `ollama pull mistral` (run from terminal)

2. **Node.js** - Required to run the development server and backend

## Getting Started

### 1. Start Ollama
Make sure the Ollama desktop app is running before starting the app. It should be listening on `localhost:11434`.

### 2. Start the Backend Server
```bash
node server.js
```
This runs the Express backend proxy on port 3001.

### 3. Start the Frontend
```bash
npm start
```
Runs the app in development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

## Recipe Database

The app uses a `recipes.json` file located in `/public/recipes.json` that contains all available recipes. This file is generated from Google Docs using a Google Apps Script.

The Google Apps Script (`Recipe Index Generator.gscript`) lives in the root of Google Drive and automatically:
- Scans all recipe documents in `Google Drive/food/Recipes/`
- Filters out dessert recipes
- Extracts and cleans ingredient lists (removes quantities, measurements, and stock items)
- Generates unique IDs for each recipe
- Outputs `recipes.json` to the root of Google Drive

### Updating Recipes

To update the recipe database:

1. Open `Recipe Index Generator.gscript` from your Google Drive root (or use [this direct link](https://script.google.com/home/projects/13F0MNZZASxZkkeCF4zw8sIXlo6ZnUPMcA5rT4sshzG40AtGStlmjzWFY/edit))
2. Click the Run button (▶️) to execute the script
3. The script will generate `recipes.json` in your Google Drive root at:
   ```
   /Users/xie/Library/CloudStorage/GoogleDrive-xiebob@gmail.com/My Drive/recipes.json
   ```
4. Copy the file to your local project:
   ```bash
   cp "/Users/xie/Library/CloudStorage/GoogleDrive-xiebob@gmail.com/My Drive/recipes.json" ~/meal-planner/public/
   ```
5. Refresh the app to use the updated recipes

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the React app in development mode (requires backend server running).

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

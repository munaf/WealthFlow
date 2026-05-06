# WealthFlow

WealthFlow is a vibe coded client-side SaaS app for financial scenario modeling. Input all of your income streams, assets, debts, expenses, as well as retirement parameters and it will help you understand your lifetime financial burndown. 

## Limitations

There is no database and the app does not use `localStorage` to save your scenarios (yet). If you want to save your configuration, you must export it as a CSV and later re-import it for future modifications. 

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

# Flow Fashion Vercel Dashboard

Next.js frontend for the Railway Phase 1 backend.

## Environment variables

Set these in Vercel (server-side only):

- `RAILWAY_API_BASE_URL=https://flow-fashion-backend-production.up.railway.app`
- `PHASE1_API_KEY=<same value as Railway>`

Do **not** prefix the API key with `NEXT_PUBLIC_`; the included server-side proxy keeps it out of the browser.

## What this dashboard supports

- backend/provider health display
- batch creation with avatar upload
- batch history/status
- Creator Scanner Queue loading + selected-row import
- manual TikTok Shop product-link import
- live production queue refreshing every 5 seconds
- image approval → video queue
- regenerate image with instruction
- retry failed job / retry failed batch
- final video and Drive links

## Vercel

Framework preset: Next.js
Build command: `npm run build`
Install command: `npm install`

The Railway worker continues processing independently if the Vercel page is closed.

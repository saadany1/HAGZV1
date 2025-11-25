# HagzApp V5 Push Notification Server

This is a clean, fixed version of the HagzApp push notification server.

## Features

- ✅ Fixed property name mismatch in server responses
- ✅ Broadcast notifications to all users
- ✅ Send notifications to specific users
- ✅ Health check endpoint
- ✅ Proper error handling
- ✅ Supabase integration

## Environment Variables

Copy `env.example` to `.env` and fill in your values:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (production/development)

## Endpoints

- `GET /health` - Health check
- `POST /send-broadcast-notification` - Send notification to all users
- `POST /send-user-notification` - Send notification to specific user

## Deployment

This server is configured for Railway deployment with:
- Automatic health checks
- Restart on failure
- Nixpacks builder

## Fix Applied

The main fix was correcting the property names in server responses:
- `result.successCount` → `result.success`
- `result.failureCount` → `result.failed`

This ensures the client receives proper `sentCount` values instead of `undefined`.




















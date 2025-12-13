#!/usr/bin/env bash
# EAS Build Hook: Copy google-services.json from environment variable or project root
# Runs right before the Gradle build starts

set -e

echo "🔧 [EAS Hook] Setting up google-services.json for build..."

# Get the project root (where package.json is)
PROJECT_ROOT="$PWD"
ANDROID_APP_DIR="$PROJECT_ROOT/android/app"

# Check if google-services.json exists in project root
if [ -f "$PROJECT_ROOT/google-services.json" ]; then
  echo "✅ [EAS Hook] Found google-services.json in project root"
  SOURCE_FILE="$PROJECT_ROOT/google-services.json"
else
  # Try to get from environment variable
  if [ -n "$GOOGLE_SERVICES_JSON" ]; then
    echo "✅ [EAS Hook] Found GOOGLE_SERVICES_JSON environment variable"
    # Write to project root first
    echo "$GOOGLE_SERVICES_JSON" > "$PROJECT_ROOT/google-services.json"
    SOURCE_FILE="$PROJECT_ROOT/google-services.json"
    echo "✅ [EAS Hook] Created google-services.json from environment variable"
  else
    echo "❌ [EAS Hook] ERROR: google-services.json not found in project root and GOOGLE_SERVICES_JSON not set"
    echo "❌ [EAS Hook] Please ensure:"
    echo "   1. google-services.json exists in project root, OR"
    echo "   2. GOOGLE_SERVICES_JSON environment variable is set as an EAS secret"
    exit 1
  fi
fi

# Ensure android/app directory exists
mkdir -p "$ANDROID_APP_DIR"

# Copy to primary location (Gradle checks this first)
cp "$SOURCE_FILE" "$ANDROID_APP_DIR/google-services.json"
echo "✅ [EAS Hook] Copied to: $ANDROID_APP_DIR/google-services.json"

# Also copy to variant-specific locations (Gradle searches these)
mkdir -p "$ANDROID_APP_DIR/src/release"
mkdir -p "$ANDROID_APP_DIR/src/Release"
mkdir -p "$ANDROID_APP_DIR/src/main"
mkdir -p "$ANDROID_APP_DIR/src"

cp "$SOURCE_FILE" "$ANDROID_APP_DIR/src/release/google-services.json" 2>/dev/null || true
cp "$SOURCE_FILE" "$ANDROID_APP_DIR/src/Release/google-services.json" 2>/dev/null || true
cp "$SOURCE_FILE" "$ANDROID_APP_DIR/src/main/google-services.json" 2>/dev/null || true
cp "$SOURCE_FILE" "$ANDROID_APP_DIR/src/google-services.json" 2>/dev/null || true

echo "✅ [EAS Hook] google-services.json setup complete - ready for Gradle build"

# Fix expo-modules-core TypeScript issue if present
echo "🔧 [EAS Hook] Checking and fixing expo-modules-core TypeScript issue..."
EXPO_CORE_PATH="$PROJECT_ROOT/node_modules/expo-modules-core"

# Check nested location (expo's dependency)
if [ ! -d "$EXPO_CORE_PATH" ]; then
  EXPO_CORE_PATH="$PROJECT_ROOT/node_modules/expo/node_modules/expo-modules-core"
fi

if [ -d "$EXPO_CORE_PATH" ]; then
  echo "✅ [EAS Hook] Found expo-modules-core at: $EXPO_CORE_PATH"
  
  # Check if package.json exists
  if [ -f "$EXPO_CORE_PATH/package.json" ]; then
    echo "✅ [EAS Hook] expo-modules-core package.json found"
    
    # Run the fix script to update package.json exports
    EXPO_CORE_PATH="$EXPO_CORE_PATH" node "$PROJECT_ROOT/eas-hooks/fix-expo-core.js" || {
      echo "⚠️ [EAS Hook] Could not run fix script, trying inline fix..."
      # Fallback: simple sed replacement if script fails
      if grep -q '\.ts' "$EXPO_CORE_PATH/package.json"; then
        echo "⚠️ [EAS Hook] Found .ts references in package.json, attempting fix..."
        sed -i.bak 's/\.ts"/\.js"/g' "$EXPO_CORE_PATH/package.json" 2>/dev/null || true
        sed -i.bak "s/\.ts'/\.js'/g" "$EXPO_CORE_PATH/package.json" 2>/dev/null || true
        echo "✅ [EAS Hook] Applied fallback fix"
      fi
    }
  fi
else
  echo "⚠️ [EAS Hook] expo-modules-core not found (may be nested dependency)"
fi


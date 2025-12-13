#!/usr/bin/env node
/**
 * Fix expo-modules-core package.json to use .js files instead of .ts
 * This prevents "Unknown file extension .ts" errors during build
 */

const fs = require('fs');
const path = require('path');

// Try multiple possible locations
let expoCorePath = process.env.EXPO_CORE_PATH;
if (!expoCorePath) {
  const possiblePaths = [
    path.join(__dirname, '..', 'node_modules', 'expo-modules-core'),
    path.join(__dirname, '..', 'node_modules', 'expo', 'node_modules', 'expo-modules-core'),
    path.join(process.cwd(), 'node_modules', 'expo-modules-core'),
    path.join(process.cwd(), 'node_modules', 'expo', 'node_modules', 'expo-modules-core'),
  ];
  
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      expoCorePath = possiblePath;
      break;
    }
  }
}

if (!expoCorePath || !fs.existsSync(expoCorePath)) {
  console.log('⚠️ expo-modules-core not found in node_modules');
  process.exit(0);
}

const packageJsonPath = path.join(expoCorePath, 'package.json');

if (!fs.existsSync(packageJsonPath)) {
  console.log('⚠️ expo-modules-core package.json not found');
  process.exit(0);
}

try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  let modified = false;
  
  // Fix exports field to use .js instead of .ts
  if (packageJson.exports) {
    const fixExports = (exports) => {
      if (typeof exports === 'string') {
        return exports.replace(/\.ts$/, '.js');
      } else if (typeof exports === 'object' && exports !== null) {
        const fixed = {};
        for (const [key, value] of Object.entries(exports)) {
          fixed[key] = fixExports(value);
        }
        return fixed;
      }
      return exports;
    };
    
    const originalExports = JSON.stringify(packageJson.exports);
    packageJson.exports = fixExports(packageJson.exports);
    const newExports = JSON.stringify(packageJson.exports);
    
    if (originalExports !== newExports) {
      modified = true;
      console.log('✅ Fixed exports field to use .js files');
    }
  }
  
  // Fix main field if it points to .ts
  if (packageJson.main && packageJson.main.endsWith('.ts')) {
    packageJson.main = packageJson.main.replace(/\.ts$/, '.js');
    modified = true;
    console.log('✅ Fixed main field to use .js file');
  }
  
  // Fix types field if it exists and points to .ts
  if (packageJson.types && packageJson.types.endsWith('.ts')) {
    // Keep types as .ts (that's correct), but ensure main points to .js
    console.log('✅ Types field is correct (.ts is expected for types)');
  }
  
  if (modified) {
    // Create backup
    fs.writeFileSync(packageJsonPath + '.backup', JSON.stringify(JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')), null, 2));
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('✅ Updated expo-modules-core package.json');
  } else {
    console.log('✅ expo-modules-core package.json is already correct');
  }
} catch (error) {
  console.error('❌ Error fixing expo-modules-core:', error.message);
  process.exit(1);
}


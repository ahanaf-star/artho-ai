import fs from 'fs';
import path from 'path';

function runBrandingChecks() {
  console.log('====================================================');
  console.log('   VERIFYING ARTHO AI BRANDING UPDATES');
  console.log('====================================================');

  const landingPagePath = path.resolve(process.cwd(), 'src/components/LandingPage.tsx');
  const landingContent = fs.readFileSync(landingPagePath, 'utf-8');

  // 1. Check that "Dhaka Metro • AI Wealth Engine" is completely removed from LandingPage
  if (landingContent.includes('Dhaka Metro • AI Wealth Engine')) {
    throw new Error('FAILED: "Dhaka Metro • AI Wealth Engine" still present in LandingPage.tsx');
  }
  console.log('✅ Subtitle "Dhaka Metro • AI Wealth Engine" removed from top-left header');

  // 2. Check that "Next-Gen AI Wealth & Savings Engine for Bangladesh" is completely removed
  if (landingContent.includes('Next-Gen AI Wealth &amp; Savings Engine for Bangladesh') ||
      landingContent.includes('Next-Gen AI Wealth & Savings Engine for Bangladesh')) {
    throw new Error('FAILED: Old badge text containing "for Bangladesh" still present in LandingPage.tsx');
  }
  console.log('✅ "for Bangladesh" removed from LandingPage badge');

  // 3. Check that "Next-Gen AI Wealth & Savings Engine" exists in LandingPage
  if (!landingContent.includes('Next-Gen AI Wealth &amp; Savings Engine')) {
    throw new Error('FAILED: Updated badge "Next-Gen AI Wealth &amp; Savings Engine" not found');
  }
  console.log('✅ Badge text correctly updated to "Next-Gen AI Wealth &amp; Savings Engine"');

  // 4. Check that "Powered by Gemini" is still present
  if (!landingContent.includes('Powered by Gemini')) {
    throw new Error('FAILED: "Powered by Gemini" badge is missing');
  }
  console.log('✅ "Powered by Gemini" badge preserved intact');

  // 5. Check brand header structure in LandingPage
  const headerBrandRegex = /<span className="font-title-lg text-base sm:text-lg font-bold text-on-surface tracking-tight leading-tight">\s*Artho AI\s*<\/span>/;
  if (!headerBrandRegex.test(landingContent)) {
    throw new Error('FAILED: "Artho AI" title styling or structure modified unexpectedly');
  }
  console.log('✅ "Artho AI" brand title typography and styling preserved cleanly');

  // 6. Scan entire src directory for any other occurrences of "Dhaka Metro • AI Wealth Engine"
  function scanDir(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...scanDir(fullPath));
      } else if (/\.(tsx?|jsx?|html|css|json)$/.test(entry.name)) {
        const fileContent = fs.readFileSync(fullPath, 'utf-8');
        if (fileContent.includes('Dhaka Metro • AI Wealth Engine')) {
          results.push(fullPath);
        }
      }
    }
    return results;
  }

  const srcDir = path.resolve(process.cwd(), 'src');
  const matches = scanDir(srcDir);
  if (matches.length > 0) {
    throw new Error(`FAILED: Found "Dhaka Metro • AI Wealth Engine" in files: ${matches.join(', ')}`);
  }
  console.log('✅ Verified zero occurrences of "Dhaka Metro • AI Wealth Engine" across src/');

  console.log('====================================================');
  console.log('   🎉 ALL BRANDING VERIFICATION CHECKS PASSED!');
  console.log('====================================================');
}

runBrandingChecks();

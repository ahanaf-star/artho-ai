import fs from 'fs';
import path from 'path';

function runBrandingChecks() {
  console.log('====================================================');
  console.log('   VERIFYING BRANDING & LOCATION LABEL REMOVAL');
  console.log('====================================================');

  const srcDir = path.resolve(process.cwd(), 'src');

  // 1. Check Header.tsx currency selector
  const headerPath = path.join(srcDir, 'components/Header.tsx');
  const headerContent = fs.readFileSync(headerPath, 'utf-8');
  if (headerContent.includes('{user.city || \'Dhaka\'}')) {
    throw new Error('FAILED: Header currency selector still includes {user.city || "Dhaka"}');
  }
  if (headerContent.includes('• Location:')) {
    throw new Error('FAILED: Header currency selector title still includes "• Location:"');
  }
  console.log('✅ Header currency selector displays only currency symbol and code without location/Dhaka');

  // 2. Check Sidebar.tsx footer
  const sidebarPath = path.join(srcDir, 'components/Sidebar.tsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');
  if (sidebarContent.includes('Dhaka Metro')) {
    throw new Error('FAILED: Sidebar footer still contains "Dhaka Metro"');
  }
  console.log('✅ Sidebar footer has "Dhaka Metro" label completely removed');

  // 3. Check LandingPage.tsx
  const landingPath = path.join(srcDir, 'components/LandingPage.tsx');
  const landingContent = fs.readFileSync(landingPath, 'utf-8');
  if (landingContent.includes('(Dhaka Metro)')) {
    throw new Error('FAILED: LandingPage baseline still contains "(Dhaka Metro)"');
  }
  if (landingContent.includes('synthetic Dhaka financial data')) {
    throw new Error('FAILED: LandingPage still contains "synthetic Dhaka financial data"');
  }
  if (landingContent.includes('Dhaka Metro • AI Wealth Engine')) {
    throw new Error('FAILED: LandingPage header still contains "Dhaka Metro • AI Wealth Engine"');
  }
  console.log('✅ Landing page has all Dhaka/Dhaka Metro branding labels removed');

  // 4. Check Dashboard.tsx
  const dashboardPath = path.join(srcDir, 'components/Dashboard.tsx');
  const dashboardContent = fs.readFileSync(dashboardPath, 'utf-8');
  if (dashboardContent.includes('peers in Dhaka')) {
    throw new Error('FAILED: Dashboard still contains "peers in Dhaka"');
  }
  console.log('✅ Dashboard peer benchmark has "peers in Dhaka" removed');

  // 5. Check FinancialHealthView.tsx
  const healthPath = path.join(srcDir, 'components/FinancialHealthView.tsx');
  const healthContent = fs.readFileSync(healthPath, 'utf-8');
  if (healthContent.includes('peers in Dhaka')) {
    throw new Error('FAILED: FinancialHealthView still contains "peers in Dhaka"');
  }
  console.log('✅ FinancialHealthView peer benchmark has "peers in Dhaka" removed');

  // 6. Check AICoach.tsx
  const coachPath = path.join(srcDir, 'components/AICoach.tsx');
  const coachContent = fs.readFileSync(coachPath, 'utf-8');
  if (coachContent.includes('Dhaka lifestyle rules') ||
      coachContent.includes('Based on Dhaka Lifestyle') ||
      coachContent.includes('Sent from Dhaka')) {
    throw new Error('FAILED: AICoach still contains location labels with "Dhaka"');
  }
  console.log('✅ AICoach has all "Dhaka" lifestyle and location labels removed');

  // 7. Check SpendingAnalysis.tsx
  const spendingPath = path.join(srcDir, 'components/SpendingAnalysis.tsx');
  const spendingContent = fs.readFileSync(spendingPath, 'utf-8');
  if (spendingContent.includes('Dhaka merchant signatures')) {
    throw new Error('FAILED: SpendingAnalysis still contains "Dhaka merchant signatures"');
  }
  console.log('✅ SpendingAnalysis reclassify modal has "Dhaka merchant signatures" removed');

  // 8. Verify that NO component in src/components contains "Dhaka Metro"
  const componentsDir = path.join(srcDir, 'components');
  function scanForDhakaMetro(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...scanForDhakaMetro(fullPath));
      } else if (/\.(tsx?)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (content.includes('Dhaka Metro')) {
          results.push(fullPath);
        }
      }
    }
    return results;
  }

  const badFiles = scanForDhakaMetro(componentsDir);
  if (badFiles.length > 0) {
    throw new Error(`FAILED: Found "Dhaka Metro" in components: ${badFiles.join(', ')}`);
  }
  console.log('✅ Verified zero occurrences of "Dhaka Metro" in all UI components');

  console.log('====================================================');
  console.log('   🎉 ALL LOCATION LABEL CHECKS PASSED!');
  console.log('====================================================');
}

runBrandingChecks();

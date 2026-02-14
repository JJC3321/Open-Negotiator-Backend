import { fetchAndPersistContexts } from "../src/fetcher.js";

async function main(): Promise<void> {
  try {
    const contexts = await fetchAndPersistContexts();
    console.log(`Fetched and saved ${contexts.length} company context(s).`);
    for (const ctx of contexts) {
      console.log(`  - ${ctx.id}: ${ctx.company_name} (${ctx.email})`);
    }
  } catch (err) {
    console.error("Fetch failed:", err);
    process.exit(1);
  }
}

main();

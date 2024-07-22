export async function braveSearch(braveApiKey: string, query: string) {
  console.log(`Brave search: ${query}`);

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "X-Subscription-Token": braveApiKey,
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  const results = data?.web?.results;
  console.log(results);

  return results;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const GIPHY_KEY = process.env.GIPHY_KEY || "dc6zaTOxFJmzC";
  const { q } = req.query;

  const url = q
    ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=g`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=24&rating=g`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Errore GIPHY", data: [] });
  }
}

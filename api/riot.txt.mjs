export default function handler(req, res) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).send("da0ec9ef-143e-4aeb-9d08-32581d871958\n");
}

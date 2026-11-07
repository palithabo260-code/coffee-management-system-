require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { createClient } = require("redis");
const crypto = require("crypto");

// 1. Initialize Express first
const app = express();

// 2. Configure and apply CORS middleware immediately after app initialization
app.use(cors({
  origin: [
    'https://coffee-management-system-pearl.vercel.app',
    'http://localhost:5173',
    'http://localhost:5000'
  ],
  credentials: true
}));

app.use(express.json());

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const STAFF_USERNAME = process.env.STAFF_USERNAME;
const STAFF_PASSWORD = process.env.STAFF_PASSWORD;

if (!JWT_SECRET || !STAFF_USERNAME || !STAFF_PASSWORD) {
  console.error("Set JWT_SECRET, STAFF_USERNAME and STAFF_PASSWORD in backend/.env.");
  process.exit(1);
}

// Redis client setup
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379"
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

async function initialiseDatabase() {
  const existingMenu = await redisClient.exists("menu:items");
  if (!existingMenu) {
    
    const defaultMenu = [
    { name: "Espresso", description: "Bold and rich", category: "Coffee", price: 30 },
    { name: "Americano", description: "Smooth and balanced", category: "Coffee", price: 35 },
    { name: "Cappuccino", description: "Espresso, steamed milk, foam", category: "Coffee", price: 40 },
    { name: "Latte", description: "Espresso and steamed milk", category: "Coffee", price: 45 },
    { name: "Mocha", description: "Espresso, chocolate, steamed milk", category: "Coffee", price: 50 },
    { name: "Caramel Macchiato", description: "Espresso, vanilla, caramel, milk", category: "Coffee", price: 55 },
    { name: "English Breakfast Tea", description: "Classic and refreshing", category: "Tea", price: 30 },
    { name: "Green Tea", description: "Light and soothing", category: "Tea", price: 30 },
    { name: "Chai Latte", description: "Spiced and comforting", category: "Tea", price: 45 },
    { name: "Iced Tea", description: "Cool and crisp", category: "Tea", price: 35 },
    { name: "Croissant", description: "Buttery and flaky", category: "Pastries", price: 35 },
    { name: "Chocolate Croissant", description: "Filled with rich chocolate", category: "Pastries", price: 40 },
    { name: "Blueberry Muffin", description: "Fresh and fruity", category: "Pastries", price: 35 },
    { name: "Cinnamon Roll", description: "Warm and sweet", category: "Pastries", price: 45 },
    { name: "Banana Bread", description: "Moist and delicious", category: "Pastries", price: 30 },
    { name: "Extra Shot", description: "Add an extra espresso shot", category: "Extras", price: 10 },
    { name: "Oat Milk", description: "Milk alternative", category: "Extras", price: 15 },
    { name: "Almond Milk", description: "Milk alternative", category: "Extras", price: 15 },
    { name: "Whipped Cream", description: "Creamy topping", category: "Extras", price: 5 },
    { name: "Flavoured Syrup", description: "Vanilla, caramel or hazelnut", category: "Extras", price: 5 }
  ];
    for (const item of defaultMenu) {
      await redisClient.hSet("menu:items", item.id, JSON.stringify(item));
    }
    console.log("Initialized default menu items in Redis.");
  }
}

// Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.get("/api/menu", async (req, res) => {
  try {
    const items = await redisClient.hGetAll("menu:items");
    const menuList = Object.values(items).map(item => JSON.parse(item));
    res.json(menuList);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch menu items" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (username === STAFF_USERNAME && password === STAFF_PASSWORD) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "8h" });
    return res.json({ token, user: { username } });
  }
  res.status(401).json({ error: "Invalid credentials" });
});

async function start() {
  try {
    await redisClient.connect();
    await initialiseDatabase();
    app.listen(PORT, () => console.log(`Aroma Coffee API running on port ${PORT} with Redis NoSQL`));
  } catch (error) {
    console.error("Could not start backend. Check Redis connection settings:", error.message);
    process.exit(1);
  }
}

start();
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
  // Using menu:items:v3 to force seed all 20 items with availability into Redis
  const existingMenu = await redisClient.exists("menu:items:v3");
  if (!existingMenu) {
    const defaultMenu = [
      { id: "1", name: "Espresso", description: "Bold and rich", category: "Coffee", price: 30, available: true },
      { id: "2", name: "Americano", description: "Smooth and balanced", category: "Coffee", price: 35, available: true },
      { id: "3", name: "Cappuccino", description: "Espresso, steamed milk, foam", category: "Coffee", price: 40, available: true },
      { id: "4", name: "Latte", description: "Espresso and steamed milk", category: "Coffee", price: 45, available: true },
      { id: "5", name: "Mocha", description: "Espresso, chocolate, steamed milk", category: "Coffee", price: 50, available: true },
      { id: "6", name: "Caramel Macchiato", description: "Espresso, vanilla, caramel, milk", category: "Coffee", price: 55, available: true },
      { id: "7", name: "English Breakfast Tea", description: "Classic and refreshing", category: "Tea", price: 30, available: true },
      { id: "8", name: "Green Tea", description: "Light and soothing", category: "Tea", price: 30, available: true },
      { id: "9", name: "Chai Latte", description: "Spiced and comforting", category: "Tea", price: 45, available: true },
      { id: "10", name: "Iced Tea", description: "Cool and crisp", category: "Tea", price: 35, available: true },
      { id: "11", name: "Croissant", description: "Buttery and flaky", category: "Pastries", price: 35, available: true },
      { id: "12", name: "Chocolate Croissant", description: "Filled with rich chocolate", category: "Pastries", price: 40, available: true },
      { id: "13", name: "Blueberry Muffin", description: "Fresh and fruity", category: "Pastries", price: 35, available: true },
      { id: "14", name: "Cinnamon Roll", description: "Warm and sweet", category: "Pastries", price: 45, available: true },
      { id: "15", name: "Banana Bread", description: "Moist and delicious", category: "Pastries", price: 30, available: true },
      { id: "16", name: "Extra Shot", description: "Add an extra espresso shot", category: "Extras", price: 10, available: true },
      { id: "17", name: "Oat Milk", description: "Milk alternative", category: "Extras", price: 15, available: true },
      { id: "18", name: "Almond Milk", description: "Milk alternative", category: "Extras", price: 15, available: true },
      { id: "19", name: "Whipped Cream", description: "Creamy topping", category: "Extras", price: 5, available: true },
      { id: "20", name: "Flavoured Syrup", description: "Vanilla, caramel or hazelnut", category: "Extras", price: 5, available: true }
    ];

    for (const item of defaultMenu) {
      await redisClient.hSet("menu:items:v3", item.id, JSON.stringify(item));
    }
    console.log("Initialized 20 default menu items under menu:items:v3 in Redis.");
  }
}

// Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.get("/api/menu", async (req, res) => {
  try {
    const items = await redisClient.hGetAll("menu:items:v3");
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

// Order submission route added here to fix 404
app.post("/api/orders", async (req, res) => {
  try {
    const { customerName, items, total } = req.body;
    const orderId = crypto.randomUUID();
    const order = {
      id: orderId,
      customerName,
      items,
      total,
      status: "Pending",
      createdAt: new Date().toISOString()
    };

    await redisClient.hSet("orders", orderId, JSON.stringify(order));
    res.status(201).json({ message: "Order placed successfully", order });
  } catch (error) {
    console.error("Failed to save order:", error);
    res.status(500).json({ error: "Failed to place order" });
  }
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
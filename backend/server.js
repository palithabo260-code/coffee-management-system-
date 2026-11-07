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

// Middleware to verify JWT token for staff routes
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access token required" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token" });
    req.user = user;
    next();
  });
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

// Staff alias login route
app.post("/api/staff/login", async (req, res) => {
  const { username, password } = req.body;
  if (username === STAFF_USERNAME && password === STAFF_PASSWORD) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "8h" });
    return res.json({ token, user: { username } });
  }
  res.status(401).json({ error: "Invalid credentials" });
});

// Fully populated order submission route
app.post("/api/orders", async (req, res) => {
  try {
    const { customerName, items } = req.body;
    if (!customerName || !items || !items.length) {
      return res.status(400).json({ error: "Customer name and items are required." });
    }

    const menuItemsHash = await redisClient.hGetAll("menu:items:v3");
    let calculatedTotal = 0;
    
    const enrichedItems = items.map((cartItem) => {
      const menuItemJson = menuItemsHash[cartItem.id];
      const menuItem = menuItemJson ? JSON.parse(menuItemJson) : { name: "Item", price: 0 };
      const subtotal = menuItem.price * cartItem.quantity;
      calculatedTotal += subtotal;

      return {
        id: cartItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: cartItem.quantity,
        subtotal: subtotal
      };
    });

    const orderId = crypto.randomUUID();
    const orderNumber = "ORD-" + Math.floor(100000 + Math.random() * 900000);
    
    const order = {
      id: orderId,
      orderId: orderId,
      orderNumber: orderNumber,
      customerName,
      items: enrichedItems,
      total: calculatedTotal,
      status: "Pending",
      createdAt: new Date().toISOString()
    };

    await redisClient.hSet("orders", orderId, JSON.stringify(order));
    
    res.status(201).json({ 
      message: "Order placed successfully", 
      id: orderId,
      orderId: orderId,
      orderNumber: orderNumber, 
      order 
    });
  } catch (error) {
    console.error("Failed to save order:", error);
    res.status(500).json({ error: "Failed to place order" });
  }
});

// Get all orders (Staff)
app.get("/api/orders", authenticateToken, async (req, res) => {
  try {
    const ordersHash = await redisClient.hGetAll("orders");
    const ordersList = Object.values(ordersHash)
      .map(o => JSON.parse(o))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(ordersList);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Update order status (Staff)
app.patch("/api/orders/:id/status", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const orderJson = await redisClient.hGet("orders", id);
    if (!orderJson) return res.status(404).json({ error: "Order not found" });

    const order = JSON.parse(orderJson);
    order.status = status;
    await redisClient.hSet("orders", id, JSON.stringify(order));
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// Staff summary / analytics
app.get("/api/staff/summary", authenticateToken, async (req, res) => {
  try {
    const ordersHash = await redisClient.hGetAll("orders");
    const orders = Object.values(ordersHash).map(o => JSON.parse(o));

    const today = new Date().toDateString();
    const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === today);

    const orderCount = todayOrders.length;
    const orderValue = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const collectedValue = todayOrders
      .filter(o => o.status === "Collected")
      .reduce((sum, o) => sum + (o.total || 0), 0);

    const statusCounts = { Pending: 0, Preparing: 0, Ready: 0, Collected: 0 };
    todayOrders.forEach(o => {
      if (statusCounts[o.status] !== undefined) statusCounts[o.status]++;
    });

    res.json({ orderCount, orderValue, collectedValue, statusCounts });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// Add menu item (Staff)
app.post("/api/menu", authenticateToken, async (req, res) => {
  try {
    const { name, description, category, price, available } = req.body;
    const id = crypto.randomUUID();
    const newItem = { id, name, description, category, price: Number(price), available: Boolean(available) };
    
    await redisClient.hSet("menu:items:v3", id, JSON.stringify(newItem));
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ error: "Failed to create menu item" });
  }
});

// Update menu item (Staff)
app.put("/api/menu/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, price, available } = req.body;
    const item = { id, name, description, category, price: Number(price), available: Boolean(available) };

    await redisClient.hSet("menu:items:v3", id, JSON.stringify(item));
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: "Failed to update menu item" });
  }
});

// Delete menu item (Staff)
app.delete("/api/menu/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await redisClient.hDel("menu:items:v3", id);
    res.json({ message: "Menu item deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete menu item" });
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
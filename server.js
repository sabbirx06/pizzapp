const express = require("express");
const path = require("path");
const db = require("./db");
const session = require("express-session");

const app = express();
const PORT = 3000;

/* =========================
   BASIC MIDDLEWARE SETUP
   ========================= */

// Parses form data (HTML forms)
app.use(express.urlencoded({ extended: true }));

// Parses JSON requests (API calls from frontend JS)
app.use(express.json());

// Serves static files like CSS, JS, images from /public folder
app.use(express.static(path.join(__dirname, "public")));

// Sets EJS as template engine (for rendering dynamic pages)
app.set("view engine", "ejs");

/* =========================
   SESSION MANAGEMENT
   =========================
   - Stores logged-in user data in browser session
   - Keeps user logged in across pages
*/
app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: true,
  }),
);

/* =========================
   AUTHORIZATION HELPERS
   ========================= */

/*
  requireRole(role)
  - Protects routes based on user role
  - Example: admin page only accessible to admin users
*/
function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect("/login");
    if (req.session.user.role !== role) return res.redirect("/menu");
    next();
  };
}

/*
  requireLogin
  - Ensures user is logged in before accessing page/API
*/
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

/* =========================
   BASIC ROUTES (PAGES)
   ========================= */

// Home page
app.get("/", (req, res) => res.render("index"));

// Authentication pages
app.get("/login", (req, res) => res.render("login"));
app.get("/signup", (req, res) => res.render("signup"));

/*
  ROLE-BASED DASHBOARDS
  - Each role gets a different dashboard UI
*/

// Admin dashboard page
app.get("/admin", requireRole("admin"), (req, res) => {
  res.render("admin", { page: "admin", role: req.session.user.role });
});

// Driver dashboard page
app.get("/driver", requireRole("driver"), (req, res) => {
  res.render("driver", { page: "driver", role: req.session.user.role });
});

/* =========================
   AUTH LOGIC
   ========================= */

// Logout clears session (logs user out)
app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

/*
  LOGIN FLOW (ROLE BASED)
  - Check email in DB
  - Validate password
  - Store user in session
  - Redirect based on role
*/
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM Users WHERE email=?", [email], (err, result) => {
    if (!result.length) return res.redirect("/login");

    const user = result[0];

    if (user.password_hash !== password) {
      return res.redirect("/login");
    }

    // Save user in session (important for authentication)
    req.session.user = user;

    // Role-based routing after login
    if (user.role === "admin") return res.redirect("/admin");
    if (user.role === "driver") return res.redirect("/driver");

    return res.redirect("/menu");
  });
});

/* Duplicate login route (safe but redundant) */
// Keeps same logic but simpler redirect
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM Users WHERE email=?", [email], (err, result) => {
    if (!result.length) return res.redirect("/login");

    const user = result[0];
    if (user.password_hash !== password) return res.redirect("/login");

    req.session.user = user;
    res.redirect("/menu");
  });
});

/* =========================
   SIGNUP FLOW (ROLE INSERTION)
   =========================
   - Creates user in Users table
   - Also inserts into role-specific table
   - Example: Customer / Admin / Driver
*/
app.post("/signup", (req, res) => {
  const { username, email, password, role } = req.body;

  db.query(
    "INSERT INTO Users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
    [username, email, password, role],
    (err, result) => {
      if (err) return res.redirect("/signup?error=Signup+failed");

      const user_id = result.insertId;

      // Role-based table insertion (normalization of database)
      if (role === "customer") {
        db.query(
          "INSERT INTO Customer (customer_id, full_name) VALUES (?, ?)",
          [user_id, username],
          () => res.redirect("/login?success=Account+created"),
        );
      } else if (role === "admin") {
        db.query(
          "INSERT INTO Admin (admin_id, full_name) VALUES (?, ?)",
          [user_id, username],
          () => res.redirect("/login?success=Account+created"),
        );
      } else if (role === "driver") {
        db.query(
          "INSERT INTO Driver (driver_id, full_name) VALUES (?, ?)",
          [user_id, username],
          () => res.redirect("/login?success=Account+created"),
        );
      } else {
        res.redirect("/signup?error=Invalid+role");
      }
    },
  );
});

/* =========================
   VIEWS (PAGE RENDERING)
   ========================= */

// Customer menu page
app.get("/menu", requireLogin, (req, res) =>
  res.render("menu", { page: "menu", role: req.session.user.role }),
);

// Cart page (session-based cart system)
app.get("/cart", requireLogin, (req, res) =>
  res.render("cart", { page: "cart", role: req.session.user.role }),
);

/* =========================
   DATA APIs (FRONTEND USE)
   ========================= */

// Fetch pizzas from database
app.get("/get-pizzas", requireLogin, (req, res) => {
  db.query("SELECT * FROM Pizza", (err, result) => res.json(result));
});

// Fetch crust options
app.get("/get-crusts", requireLogin, (req, res) => {
  db.query("SELECT * FROM Crust", (err, result) => res.json(result));
});

// Fetch toppings
app.get("/get-toppings", requireLogin, (req, res) => {
  db.query("SELECT * FROM Toppings", (err, result) => res.json(result));
});

/* =========================
   DISCOUNT ENGINE (LOGIC CORE)
   =========================
   - Calculates best discount based on:
     1. total orders
     2. total spending
*/
app.get("/get-discount", requireLogin, (req, res) => {
  const user = req.session.user;
  const cart = req.session.cart || [];

  let total = 0;

  // Calculate cart total
  cart.forEach((item) => {
    total += Number(item.price) * Number(item.quantity);
  });

  // Get customer stats
  db.query(
    "SELECT total_orders, total_spending FROM Customer WHERE customer_id=?",
    [user.user_id],
    (err, customerRes) => {
      if (err) return res.json({ discount: null, finalTotal: total });

      const customer = customerRes[0];
      const total_orders = (customer.total_orders || 0) + 1;
      const total_spending = (customer.total_spending || 0) + total;

      // Fetch all discounts and choose best match
      db.query("SELECT * FROM Discounts", (err2, discounts) => {
        if (err2) return res.json({ discount: null, finalTotal: total });

        let bestDiscount = null;

        discounts.forEach((d) => {
          let valid = true;

          if (d.min_orders && total_orders < d.min_orders) valid = false;
          if (d.min_spending && total_spending < d.min_spending) valid = false;

          if (valid && (!bestDiscount || d.discount_percent > bestDiscount.discount_percent)) {
            bestDiscount = d;
          }
        });

        // Apply discount
        let discountAmount = 0;
        let finalTotal = total;

        if (bestDiscount) {
          discountAmount = (total * bestDiscount.discount_percent) / 100;
          finalTotal = total - discountAmount;
        }

        res.json({
          discount: bestDiscount,
          discountAmount,
          finalTotal,
          subtotal: total,
          items: cart,
        });
      });
    },
  );
});

/* =========================
   CART SYSTEM (SESSION BASED)
   ========================= */

// Initialize cart if not exists
function getCart(req) {
  if (!req.session.cart) req.session.cart = [];
  return req.session.cart;
}

// Get cart items
app.get("/get-cart", requireLogin, (req, res) => {
  res.json(getCart(req));
});

// Add item to cart
app.post("/add-to-cart", requireLogin, (req, res) => {
  const cart = getCart(req);
  cart.push(req.body);
  res.json({ success: true });
});

// Remove item from cart
app.post("/remove-from-cart", requireLogin, (req, res) => {
  const { index } = req.body;
  const cart = getCart(req);
  cart.splice(index, 1);
  res.json({ success: true });
});

/* =========================
   ORDER PLACEMENT ENGINE
   =========================
   BIG FEATURE:
   - Calculates order total
   - Applies discount
   - Inserts order + items + toppings
   - Creates delivery entry
   - Updates customer stats
   - Clears cart
*/
app.post("/place-order", requireLogin, (req, res) => {
  const user = req.session.user;
  const cart = req.session.cart || [];

  if (!cart.length) return res.redirect("/cart");

  let total = 0;

  // Step 1: Calculate total
  cart.forEach((item) => {
    total += Number(item.price) * Number(item.quantity);
  });

  // Step 2: Get customer stats + discounts
  db.query(
    "SELECT total_orders, total_spending FROM Customer WHERE customer_id=?",
    [user.user_id],
    (err, customerRes) => {
      const customer = customerRes[0];
      const total_orders = (customer.total_orders || 0) + 1;
      const total_spending = (customer.total_spending || 0) + total;

      db.query("SELECT * FROM Discounts", (err2, discounts) => {
        let bestDiscount = null;

        discounts.forEach((d) => {
          let valid = true;

          if (d.min_orders && total_orders < d.min_orders) valid = false;
          if (d.min_spending && total_spending < d.min_spending) valid = false;

          if (valid && (!bestDiscount || d.discount_percent > bestDiscount.discount_percent)) {
            bestDiscount = d;
          }
        });

        let finalTotal = total;
        let discount_id = null;

        if (bestDiscount) {
          discount_id = bestDiscount.discount_id;
          finalTotal = total - (total * bestDiscount.discount_percent) / 100;
        }

        // Step 3: Insert order
        db.query(
          "INSERT INTO Orders (customer_id, discount_id, total_amount) VALUES (?, ?, ?)",
          [user.user_id, discount_id, finalTotal],
          (err3, orderRes) => {
            const order_id = orderRes.insertId;

            // Step 4: Insert items + toppings
            cart.forEach((item) => {
              db.query(
                "INSERT INTO Order_Items (order_id, pizza_id, crust_id, quantity, item_price) VALUES (?, ?, ?, ?, ?)",
                [order_id, item.pizza_id, item.crust_id, item.quantity, item.price],
                (err4, itemRes) => {
                  const item_id = itemRes.insertId;

                  item.toppings.forEach((t) => {
                    db.query(
                      "INSERT INTO Order_Toppings (item_id, topping_id) VALUES (?, ?)",
                      [item_id, t.id],
                    );
                  });
                },
              );
            });

            // Step 5: Delivery setup (ETA = 30 min)
            const estimatedTime = new Date(Date.now() + 30 * 60000);

            db.query(
              "INSERT INTO Delivery (order_id, delivery_status, estimated_time) VALUES (?, 'pending', ?)",
              [order_id, estimatedTime],
            );

            // Step 6: Update customer stats
            db.query(
              `UPDATE Customer 
               SET total_orders = total_orders + 1,
                   total_spending = total_spending + ?
               WHERE customer_id=?`,
              [finalTotal, user.user_id],
            );

            // Step 7: Clear cart after successful order
            req.session.cart = [];

            // Redirect to confirmation page
            res.redirect(`/order-confirmation/${order_id}`);
          },
        );
      });
    },
  );
});

/* =========================
   CART SUMMARY API
   ========================= */
app.get("/cart-data", (req, res) => {
  const cart = req.session.cart || [];

  let subtotal = 0;

  cart.forEach((item) => {
    subtotal += Number(item.price) * Number(item.quantity);
  });

  let discount = 0;
  if (subtotal > 2000) discount = subtotal * 0.1;

  const finalTotal = subtotal - discount;

  res.json({ items: cart, subtotal, discount, finalTotal });
});

/* =========================
   ORDER CONFIRMATION PAGE
   ========================= */
app.get("/order-confirmation/:id", requireRole("customer"), (req, res) => {
  const orderId = req.params.id;

  db.query(
    "SELECT o.order_id, o.total_amount, o.created_at FROM Orders o WHERE o.order_id=?",
    [orderId],
    (err, result) => {
      res.render("confirmation", { order: result[0] });
    },
  );
});

/* =========================
   HISTORY PAGE (CUSTOMER)
   ========================= */
app.get("/history", requireRole("customer"), (req, res) => {
  res.render("history", { page: "history", role: req.session.user.role });
});

/* GROUPED ORDER HISTORY API */
app.get("/history-data", requireRole("customer"), (req, res) => {
  db.query(
    `SELECT o.order_id, o.total_amount, o.created_at, d.delivery_status,
            oi.item_id, oi.quantity, p.name AS pizza_name, c.crust_name
     FROM Orders o
     LEFT JOIN Delivery d ON o.order_id = d.order_id
     LEFT JOIN Order_Items oi ON o.order_id = oi.order_id
     LEFT JOIN Pizza p ON oi.pizza_id = p.pizza_id
     LEFT JOIN Crust c ON oi.crust_id = c.crust_id
     WHERE o.customer_id=?
     ORDER BY o.order_id DESC`,
    [req.session.user.user_id],
    (err, rows) => {

      // Group items under each order (important data structuring step)
      const orders = {};

      rows.forEach((r) => {
        if (!orders[r.order_id]) {
          orders[r.order_id] = {
            order_id: r.order_id,
            total_amount: r.total_amount,
            created_at: r.created_at,
            delivery_status: r.delivery_status,
            items: [],
          };
        }

        if (r.item_id) {
          orders[r.order_id].items.push({
            pizza_name: r.pizza_name,
            crust_name: r.crust_name,
            quantity: r.quantity,
          });
        }
      });

      res.json(Object.values(orders));
    },
  );
});

/* =========================
   ADMIN ORDER CONTROL
   ========================= */
app.get("/admin/orders", requireRole("admin"), (req, res) => {
  db.query(
    `SELECT o.order_id, o.status, o.total_amount, d.delivery_status, d.driver_id
     FROM Orders o
     LEFT JOIN Delivery d ON o.order_id = d.order_id
     ORDER BY o.created_at DESC`,
    (err, orders) => {
      db.query("SELECT driver_id, full_name FROM Driver", (err2, drivers) => {
        res.json({ orders, drivers });
      });
    },
  );
});

/* Assign driver to order */
app.post("/admin/assign-driver", requireRole("admin"), (req, res) => {
  const { order_id, driver_id } = req.body;

  db.query(
    `UPDATE Delivery 
     SET driver_id=?, delivery_status='assigned', assigned_at=NOW()
     WHERE order_id=?`,
    [driver_id, order_id],
    () => res.json({ success: true }),
  );
});

/* =========================
   DRIVER FEATURES
   ========================= */

// Get assigned orders
app.get("/driver/orders", requireRole("driver"), (req, res) => {
  const driver_id = req.session.user.user_id;

  db.query(
    `SELECT d.*, o.total_amount 
     FROM Delivery d
     JOIN Orders o ON d.order_id = o.order_id
     WHERE d.driver_id=?`,
    [driver_id],
    (err, result) => res.json(result),
  );
});

// Update delivery status
app.post("/driver/update-status", requireRole("driver"), (req, res) => {
  const { order_id, status } = req.body;

  db.query(
    `UPDATE Delivery 
     SET delivery_status=?,
         delivered_at = IF(?='delivered', NOW(), delivered_at)
     WHERE order_id=?`,
    [status, status, order_id],
    () => res.json({ success: true }),
  );
});

/* =========================
   CUSTOMER ORDER APIs
   ========================= */

// Full order history with items + toppings
app.get("/orders/data", requireRole("customer"), (req, res) => {
  const customer_id = req.session.user.user_id;

  db.query(
    `SELECT * FROM Orders WHERE customer_id=? ORDER BY created_at DESC`,
    [customer_id],
    (err, orders) => {
      if (!orders.length) return res.json([]);

      const orderIds = orders.map((o) => o.order_id);

      db.query(
        `SELECT oi.*, p.name AS pizza_name, c.crust_name
         FROM Order_Items oi
         JOIN Pizza p ON oi.pizza_id = p.pizza_id
         JOIN Crust c ON oi.crust_id = c.crust_id
         WHERE oi.order_id IN (?)`,
        [orderIds],
        (err2, items) => {

          db.query(
            `SELECT ot.item_id, t.topping_name
             FROM Order_Toppings ot
             JOIN Toppings t ON ot.topping_id = t.topping_id`,
            (err3, toppings) => {
              res.json({ orders, items, toppings });
            },
          );
        },
      );
    },
  );
});

// Orders page
app.get("/orders", requireRole("customer"), (req, res) => {
  res.render("orders", { page: "orders", role: req.session.user.role });
});

/* =========================
   LIVE ORDER TRACKING
   ========================= */
app.get("/orders/status", requireRole("customer"), (req, res) => {
  const customer_id = req.session.user.user_id;

  db.query(
    `SELECT o.order_id, o.created_at, o.total_amount,
            d.delivery_status, d.estimated_time,
            dr.full_name AS driver_name, dr.phone AS driver_phone,
            oi.item_id, oi.quantity, p.name AS pizza_name, c.crust_name
     FROM Orders o
     LEFT JOIN Delivery d ON o.order_id = d.order_id
     LEFT JOIN Driver dr ON d.driver_id = dr.driver_id
     LEFT JOIN Order_Items oi ON o.order_id = oi.order_id
     LEFT JOIN Pizza p ON oi.pizza_id = p.pizza_id
     LEFT JOIN Crust c ON oi.crust_id = c.crust_id
     WHERE o.customer_id=?
     ORDER BY o.order_id DESC`,
    [customer_id],
    (err, rows) => {

      const orders = {};

      rows.forEach((r) => {
        if (!orders[r.order_id]) {
          orders[r.order_id] = {
            order_id: r.order_id,
            total_amount: r.total_amount,
            created_at: r.created_at,
            delivery_status: r.delivery_status,
            estimated_time: r.estimated_time,
            driver_name: r.driver_name,
            driver_phone: r.driver_phone,
            items: [],
          };
        }

        if (r.item_id) {
          orders[r.order_id].items.push({
            pizza_name: r.pizza_name,
            crust_name: r.crust_name,
            quantity: r.quantity,
          });
        }
      });

      res.json(Object.values(orders));
    },
  );
});

/* =========================
   DASHBOARDS (SUMMARY STATS)
   ========================= */

// Customer dashboard stats
app.get("/user-dashboard", requireRole("customer"), (req, res) => {
  const userId = req.session.user.user_id;

  db.query(
    "SELECT total_orders, total_spending FROM Customer WHERE customer_id=?",
    [userId],
    (err, result) => {
      res.render("user-dashboard", {
        page: "user-dashboard",
        role: req.session.user.role,
        stats: result[0] || { total_orders: 0, total_spending: 0 },
      });
    },
  );
});

// Admin dashboard stats
app.get("/admin-dashboard", requireRole("admin"), (req, res) => {
  db.query(
    "SELECT COUNT(*) AS total_orders, SUM(total_amount) AS revenue FROM Orders",
    (err, result) => {
      res.render("admin-dashboard", {
        page: "admin-dashboard",
        role: req.session.user.role,
        stats: result[0] || { total_orders: 0, revenue: 0 },
      });
    },
  );
});

// Driver dashboard stats
app.get("/driver-dashboard", requireRole("driver"), (req, res) => {
  const driverId = req.session.user.user_id;

  db.query(
    "SELECT COUNT(*) AS delivered FROM Delivery WHERE driver_id=? AND delivery_status='delivered'",
    [driverId],
    (err, result) => {
      res.render("driver-dashboard", {
        page: "driver-dashboard",
        role: req.session.user.role,
        stats: result[0] || { delivered: 0 },
      });
    },
  );
});

/* =========================
   SERVER START
   ========================= */
app.listen(PORT, () => console.log("Server running on port", PORT));
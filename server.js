const express = require("express");
const path = require("path");
const db = require("./db");
const session = require("express-session");

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");

app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: true,
  }),
);

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect("/login");
    if (req.session.user.role !== role) return res.redirect("/menu");
    next();
  };
}

// ===== AUTH =====
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// ===== BASIC ROUTES =====
app.get("/", (req, res) => res.render("index"));

app.get("/login", (req, res) => res.render("login"));
app.get("/signup", (req, res) => res.render("signup"));
// ADMIN
app.get("/admin", requireRole("admin"), (req, res) => {
  res.render("admin");
});

// DRIVER
app.get("/driver", requireRole("driver"), (req, res) => {
  res.render("driver");
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM Users WHERE email=?", [email], (err, result) => {
    if (!result.length) return res.redirect("/login");

    const user = result[0];

    if (user.password_hash !== password) {
      return res.redirect("/login");
    }

    req.session.user = user;

    // 🔥 ROLE-BASED REDIRECT
    if (user.role === "admin") return res.redirect("/admin");
    if (user.role === "driver") return res.redirect("/driver");

    return res.redirect("/menu");
  });
});

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

app.post("/signup", (req, res) => {
  const { username, email, password, role } = req.body;

  db.query(
    "INSERT INTO Users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
    [username, email, password, role],
    (err, result) => {
      if (err) return res.redirect("/signup?error=Signup+failed");

      const user_id = result.insertId;

      if (role === "customer") {
        db.query(
          "INSERT INTO Customer (customer_id, full_name) VALUES (?, ?)",
          [user_id, username],
          (err) => {
            if (err) return res.redirect("/signup?error=Signup+failed");
            res.redirect("/login?success=Account+created");
          },
        );
      } else if (role === "admin") {
        db.query(
          "INSERT INTO Admin (admin_id, full_name) VALUES (?, ?)",
          [user_id, username],
          (err) => {
            if (err) return res.redirect("/signup?error=Signup+failed");
            res.redirect("/login?success=Account+created");
          },
        );
      } else if (role === "driver") {
        db.query(
          "INSERT INTO Driver (driver_id, full_name) VALUES (?, ?)",
          [user_id, username],
          (err) => {
            if (err) return res.redirect("/signup?error=Signup+failed");
            res.redirect("/login?success=Account+created");
          },
        );
      } else {
        res.redirect("/signup?error=Invalid+role");
      }
    },
  );
});

// ===== VIEWS =====
app.get("/menu", requireLogin, (req, res) => res.render("menu"));
app.get("/cart", requireLogin, (req, res) => res.render("cart"));

// ===== DATA APIs =====
app.get("/get-pizzas", requireLogin, (req, res) => {
  db.query("SELECT * FROM Pizza", (err, result) => res.json(result));
});

app.get("/get-crusts", requireLogin, (req, res) => {
  db.query("SELECT * FROM Crust", (err, result) => res.json(result));
});

app.get("/get-toppings", requireLogin, (req, res) => {
  db.query("SELECT * FROM Toppings", (err, result) => res.json(result));
});

// ===== CART =====
function getCart(req) {
  if (!req.session.cart) req.session.cart = [];
  return req.session.cart;
}

app.get("/get-cart", requireLogin, (req, res) => {
  res.json(getCart(req));
});

app.post("/add-to-cart", requireLogin, (req, res) => {
  const cart = getCart(req);
  cart.push(req.body);
  res.json({ success: true });
});

app.post("/remove-from-cart", requireLogin, (req, res) => {
  const { index } = req.body;
  const cart = getCart(req);
  cart.splice(index, 1);
  res.json({ success: true });
});

// ===== PLACE ORDER =====
app.post("/place-order", requireLogin, (req, res) => {
  const user = req.session.user;
  const cart = req.session.cart || [];

  if (!cart.length) return res.redirect("/cart");

  db.query(
    "INSERT INTO Orders (customer_id, total_amount) VALUES (?, ?)",
    [user.user_id, 0],
    (err, orderRes) => {
      if (err) return res.send("Order error");

      const order_id = orderRes.insertId;
      let total = 0;

      cart.forEach((item) => {
        total += item.price * item.quantity;

        db.query(
          "INSERT INTO Order_Items (order_id, pizza_id, crust_id, quantity, item_price) VALUES (?, ?, ?, ?, ?)",
          [order_id, item.pizza_id, item.crust_id, item.quantity, item.price],
          (err, itemRes) => {
            if (err) return;

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

      // ✅ Update total
      db.query("UPDATE Orders SET total_amount=? WHERE order_id=?", [
        total,
        order_id,
      ]);

      // 🔥 NEW: Create delivery record
      db.query(
        "INSERT INTO Delivery (order_id, delivery_status) VALUES (?, 'pending')",
        [order_id],
        (err) => {
          if (err) console.log("Delivery insert error:", err);
        },
      );

      // Clear cart
      req.session.cart = [];

      res.redirect("/menu");
    },
  );
});

// ==========================
// ADMIN: GET ALL ORDERS + DRIVERS
// ==========================
app.get("/admin/orders", requireRole("admin"), (req, res) => {
  db.query(
    `
    SELECT o.order_id, o.status, o.total_amount, d.delivery_status, d.driver_id
    FROM Orders o
    LEFT JOIN Delivery d ON o.order_id = d.order_id
    ORDER BY o.created_at DESC
  `,
    (err, orders) => {
      db.query("SELECT driver_id, full_name FROM Driver", (err2, drivers) => {
        res.json({ orders, drivers });
      });
    },
  );
});

// ==========================
// ADMIN: ASSIGN DRIVER
// ==========================
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

// ==========================
// DRIVER: GET ASSIGNED ORDERS
// ==========================
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

// ==========================
// DRIVER: UPDATE STATUS
// ==========================
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

// ==========================
// CUSTOMER ORDER HISTORY
// ==========================
app.get("/orders/data", requireRole("customer"), (req, res) => {
  const customer_id = req.session.user.user_id;

  db.query(
    `SELECT * FROM Orders 
     WHERE customer_id=? 
     ORDER BY created_at DESC`,
    [customer_id],
    (err, orders) => {
      if (err) return res.json([]);

      if (!orders.length) return res.json([]);

      const orderIds = orders.map((o) => o.order_id);

      db.query(
        `SELECT 
            oi.item_id,
            oi.order_id,
            oi.quantity,
            oi.item_price,
            p.name AS pizza_name,
            c.crust_name
         FROM Order_Items oi
         JOIN Pizza p ON oi.pizza_id = p.pizza_id
         JOIN Crust c ON oi.crust_id = c.crust_id
         WHERE oi.order_id IN (?)`,
        [orderIds],
        (err2, items) => {
          db.query(
            `SELECT 
                ot.item_id,
                t.topping_name
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

app.get("/orders", requireRole("customer"), (req, res) => {
  res.render("orders");
});

// ==========================
// CUSTOMER: LIVE TRACKING
// ==========================
app.get("/orders/status", requireRole("customer"), (req, res) => {
  const customer_id = req.session.user.user_id;

  db.query(
    `SELECT 
        o.order_id,
        o.status,
        d.delivery_status,
        d.driver_id
     FROM Orders o
     LEFT JOIN Delivery d ON o.order_id = d.order_id
     WHERE o.customer_id=?
     ORDER BY o.created_at DESC`,
    [customer_id],
    (err, result) => {
      res.json(result);
    },
  );
});

app.listen(PORT, () => console.log("Server running on port", PORT));

const express = require("express");
const path = require("path");
const db = require("./db");
const session = require("express-session"); //checks whether the user is logged in or not

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // javascript object notation
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
  res.render("admin", {
    page: "admin",
    role: req.session.user.role,
    user: req.session.user,
  });
});

// DRIVER
app.get("/driver", requireRole("driver"), (req, res) => {
  res.render("driver", {
    page: "driver",
    role: req.session.user.role,
    user: req.session.user,
  });
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

    //using the session to make the user logged in
    req.session.user = user;

    // 🔥 ROLE-BASED REDIRECT
    if (user.role === "admin") return res.redirect("/admin");
    if (user.role === "driver") return res.redirect("/driver");

    return res.redirect("/menu");
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
app.get("/menu", requireLogin, (req, res) =>
  res.render("menu", {
    page: "menu",
    role: req.session.user.role,
    user: req.session.user,
  }),
);
app.get("/cart", requireLogin, (req, res) =>
  res.render("cart", {
    page: "cart",
    role: req.session.user.role,
    user: req.session.user,
  }),
);

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

// GET_DISCOUNT
// MUSKAAN's PART
app.get("/get-discount", requireLogin, (req, res) => {
  const user = req.session.user;
  const cart = req.session.cart || [];
  let total = 0;
  cart.forEach((item) => {
    total += Number(item.price) * Number(item.quantity);
  });

  // Step 1: Look at the Customer's History in the database
  db.query(
    "SELECT total_orders, total_spending FROM Customer WHERE customer_id=?",
    [user.user_id],
    (err, customerRes) => {
      if (err) return res.json({ discount: null, finalTotal: total });

      const customer = customerRes[0];

      // Calculate what their stats will be AFTER they complete this current order
      const predictedTotalOrders = (customer.total_orders || 0) + 1;
      const predictedTotalSpending = (customer.total_spending || 0) + total;

      // Step 2: Grab the Coupon Book (all available discounts)
      db.query("SELECT * FROM Discounts", (err2, discounts) => {
        if (err2) return res.json({ discount: null, finalTotal: total });

        let bestDiscount = null; // Start with no discount

        // Step 3: Flip Through Every Coupon
        discounts.forEach((discount) => {
          let isCouponValid = true; // Assume the coupon works until proven otherwise

          // Step 4: Check the rules on the coupon
          // Rule 1: Do they have enough past orders?
          if (
            discount.min_orders !== null &&
            predictedTotalOrders < discount.min_orders
          ) {
            isCouponValid = false; // Not enough orders, cross it out
          }

          // Rule 2: Have they spent enough money in the past?
          if (
            discount.min_spending !== null &&
            predictedTotalSpending < discount.min_spending
          ) {
            isCouponValid = false; // Haven't spent enough, cross it out
          }

          // Step 5: Keep the coupon that gives the biggest percentage off
          if (isCouponValid) {
            // If we don't have a best discount yet, OR if this new one is bigger than our current best
            if (
              !bestDiscount ||
              Number(discount.discount_percent) >
                Number(bestDiscount.discount_percent)
            ) {
              bestDiscount = discount; // This is our new best coupon!
            }
          }
        });

        // Step 6: Do the Math at the Register
        let finalTotal = total;
        let discountAmount = 0;

        if (bestDiscount) {
          // Calculate the money saved: (Original Price * Discount Percentage) / 100
          discountAmount = (total * bestDiscount.discount_percent) / 100;
          // Subtract the saved money from the original price
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
// ===== MUSKAAN's PART ====
app.post("/place-order", requireLogin, (req, res) => {
  const user = req.session.user;
  const cart = req.session.cart || [];

  if (!cart.length) return res.redirect("/cart");

  // 🔹 Step 1: Calculate total
  let total = 0;
  cart.forEach((item) => {
    total += Number(item.price) * Number(item.quantity);
  });

  // 🔹 Step 2: Look at the Customer's History in the database
  db.query(
    "SELECT total_orders, total_spending FROM Customer WHERE customer_id=?",
    [user.user_id],
    (err, customerRes) => {
      const customer = customerRes[0];

      // Calculate what their stats will be AFTER they complete this current order
      const predictedTotalOrders = (customer.total_orders || 0) + 1;
      const predictedTotalSpending = (customer.total_spending || 0) + total;

      // 🔹 Step 3: Grab the Coupon Book (all available discounts)
      db.query("SELECT * FROM Discounts", (err2, discounts) => {
        let bestDiscount = null; // Start with no discount

        // Flip Through Every Coupon
        discounts.forEach((discount) => {
          let isCouponValid = true; // Assume the coupon works until proven otherwise

          // Check the rules on the coupon
          // Rule 1: Do they have enough past orders?
          if (
            discount.min_orders !== null &&
            predictedTotalOrders < discount.min_orders
          ) {
            isCouponValid = false; // Not enough orders, cross it out
          }

          // Rule 2: Have they spent enough money in the past? .
          if (
            discount.min_spending !== null &&
            predictedTotalSpending < discount.min_spending
          ) {
            isCouponValid = false; // Haven't spent enough, cross it out
          }

          // Keep the coupon that gives the biggest percentage off
          if (isCouponValid) {
            // If we don't have a best discount yet, OR if this new one is bigger than our current best
            if (
              !bestDiscount ||
              Number(discount.discount_percent) >
                Number(bestDiscount.discount_percent)
            ) {
              bestDiscount = discount; // This is our new best coupon!
            }
          }
        });

        // Do the Math at the Register
        let finalTotal = total;
        let discount_id = null;

        if (bestDiscount) {
          discount_id = bestDiscount.discount_id; // Write down the coupon ID for the receipt

          // Calculate the final price: Original Price - (Original Price * Discount Percentage) / 100
          finalTotal = total - (total * bestDiscount.discount_percent) / 100;
        }

        // 🔹 Step 4: Insert order
        db.query(
          "INSERT INTO Orders (customer_id, discount_id, total_amount) VALUES (?, ?, ?)",
          [user.user_id, discount_id, finalTotal],
          (err3, orderRes) => {
            const order_id = orderRes.insertId;

            // 🔹 Step 5: Insert items
            cart.forEach((item) => {
              db.query(
                "INSERT INTO Order_Items (order_id, pizza_id, crust_id, quantity, item_price) VALUES (?, ?, ?, ?, ?)",
                [
                  order_id,
                  item.pizza_id,
                  item.crust_id,
                  item.quantity,
                  item.price,
                ],
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

            // 🔥 Step 6: ETA (30 mins from now)
            const estimatedTime = new Date(Date.now() + 30 * 60000);

            // 🔹 Step 7: Create delivery
            db.query(
              "INSERT INTO Delivery (order_id, delivery_status, estimated_time) VALUES (?, 'pending', ?)",
              [order_id, estimatedTime],
            );

            // 🔹 Step 8: Update customer stats
            db.query(
              `UPDATE Customer 
               SET total_orders = total_orders + 1,
                   total_spending = total_spending + ?
               WHERE customer_id=?`,
              [finalTotal, user.user_id],
            );

            // 🔹 Step 9: Clear cart
            req.session.cart = [];

            // ✅ FINAL REDIRECT (THIS IS THE IMPORTANT CHANGE)
            res.redirect(`/order-confirmation/${order_id}`);
          },
        );
      });
    },
  );
});

app.get("/order-confirmation/:id", requireRole("customer"), (req, res) => {
  const orderId = req.params.id;

  db.query(
    `SELECT o.order_id, o.total_amount, o.created_at
     FROM Orders o
     WHERE o.order_id=?`,
    [orderId],
    (err, result) => {
      res.render("confirmation", { order: result[0] });
    },
  );
});

app.get("/history", requireRole("customer"), (req, res) => {
  res.render("history", {
    page: "history",
    role: req.session.user.role,
    user: req.session.user,
  });
});

app.get("/history-data", requireRole("customer"), (req, res) => {
  db.query(
    `SELECT 
      o.order_id,
      o.total_amount,
      o.created_at,
      d.delivery_status,
      oi.item_id,
      oi.quantity,
      p.name AS pizza_name,
      c.crust_name
    FROM Orders o
    LEFT JOIN Delivery d ON o.order_id = d.order_id
    LEFT JOIN Order_Items oi ON o.order_id = oi.order_id
    LEFT JOIN Pizza p ON oi.pizza_id = p.pizza_id
    LEFT JOIN Crust c ON oi.crust_id = c.crust_id
    WHERE o.customer_id=?
    ORDER BY o.order_id DESC`,
    [req.session.user.user_id],
    (err, rows) => {
      // 🔥 GROUP DATA BY ORDER
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
  res.render("orders", {
    page: "orders",
    role: req.session.user.role,
    user: req.session.user,
  });
});

// ==========================
// CUSTOMER: LIVE TRACKING
// ==========================
app.get("/orders/status", requireRole("customer"), (req, res) => {
  const customer_id = req.session.user.user_id;

  db.query(
    `SELECT 
      o.order_id,
      o.created_at,
      o.total_amount,
      d.delivery_status,
      d.estimated_time,
      d.driver_id,
      dr.full_name AS driver_name,
      dr.phone AS driver_phone,
      oi.item_id,
      oi.quantity,
      p.name AS pizza_name,
      c.crust_name
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
      if (err) return res.json([]);

      const orders = {};

      rows.forEach((r) => {
        if (!orders[r.order_id]) {
          orders[r.order_id] = {
            order_id: r.order_id,
            total_amount: r.total_amount,
            created_at: r.created_at,
            delivery_status: r.delivery_status,

            // 🔥 FIXES
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

// USER DASHBOARD
app.get("/user-dashboard", requireRole("customer"), (req, res) => {
  const userId = req.session.user.user_id;

  db.query(
    "SELECT total_orders, total_spending FROM Customer WHERE customer_id=?",
    [userId],
    (err, result) => {
      res.render("user-dashboard", {
        page: "user-dashboard",
        role: req.session.user.role,
        user: req.session.user,
        stats: result[0] || { total_orders: 0, total_spending: 0 },
      });
    },
  );
});

// ADMIN DASHBOARD
app.get("/admin-dashboard", requireRole("admin"), (req, res) => {
  db.query(
    "SELECT COUNT(*) AS total_orders, SUM(total_amount) AS revenue FROM Orders",
    (err, result) => {
      res.render("admin-dashboard", {
        page: "admin-dashboard",
        role: req.session.user.role,
        user: req.session.user,
        stats: result[0] || { total_orders: 0, revenue: 0 },
      });
    },
  );
});

// DRIVER DASHBOARD
app.get("/driver-dashboard", requireRole("driver"), (req, res) => {
  const driverId = req.session.user.user_id;

  db.query(
    "SELECT COUNT(*) AS delivered FROM Delivery WHERE driver_id=? AND delivery_status='delivered'",
    [driverId],
    (err, result) => {
      res.render("driver-dashboard", {
        page: "driver-dashboard",
        role: req.session.user.role,
        user: req.session.user,
        stats: result[0] || { delivered: 0 },
      });
    },
  );
});

app.listen(PORT, () => console.log("Server running on port", PORT));

<?php
session_start();
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'customer') {
    header('Location: login.php'); exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PizzApp – Order</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
<?php include 'navbar.php'; ?>
<div class="container">
  <h2>Build Your Order</h2>
  <div id="menu"></div>
  <div id="cart">
    <h3>🛒 Your Cart</h3>
    <ul id="cartList"></ul>
    <p>Total: $<span id="cartTotal">0.00</span></p>
    <button onclick="placeOrder()">Place Order</button>
  </div>
  <div id="orderMsg"></div>
</div>
<script>
let cart = [];
fetch('../backend/orders/get_pizzas.php')
  .then(r => r.json())
  .then(data => renderMenu(data));

function renderMenu(data) {
  const div = document.getElementById('menu');
  data.pizzas.forEach(p => {
    div.innerHTML += `
      <div class="pizza-card">
        <h3>${p.name} (${p.size}) – $${p.base_price}</h3>
        <p>${p.description}</p>
        <label>Crust:
          <select id="crust_${p.pizza_id}">
            ${data.crusts.map(c =>
              `<option value="${c.crust_id}" data-extra="${c.extra_price}">
                ${c.crust_name} (+$${c.extra_price})</option>`).join('')}
          </select>
        </label>
        <label>Toppings:</label>
        ${data.toppings.map(t =>
          `<label><input type="checkbox" class="topping_${p.pizza_id}"
            value="${t.topping_id}" data-extra="${t.extra_price}">
            ${t.topping_name} (+$${t.extra_price})</label>`).join('')}
        <label>Qty: <input type="number" id="qty_${p.pizza_id}" value="1" min="1" style="width:50px"></label>
        <button onclick="addToCart(${p.pizza_id}, '${p.name}', ${p.base_price})">Add to Cart</button>
      </div>`;
  });
}

function addToCart(pizza_id, name, base_price) {
  const crustSel   = document.getElementById(`crust_${pizza_id}`);
  const crust_id   = parseInt(crustSel.value);
  const crust_extra= parseFloat(crustSel.selectedOptions[0].dataset.extra);
  const qty        = parseInt(document.getElementById(`qty_${pizza_id}`).value);
  const boxes      = document.querySelectorAll(`.topping_${pizza_id}:checked`);
  const toppings   = [...boxes].map(t => parseInt(t.value));
  const top_extra  = [...boxes].reduce((s,t) => s + parseFloat(t.dataset.extra), 0);
  const item_price = (parseFloat(base_price) + crust_extra + top_extra) * qty;
  cart.push({ pizza_id, crust_id, quantity: qty, toppings, item_price, name });
  renderCart();
}

function renderCart() {
  document.getElementById('cartList').innerHTML =
    cart.map(c => `<li>${c.name} x${c.quantity} – $${c.item_price.toFixed(2)}</li>`).join('');
  document.getElementById('cartTotal').textContent =
    cart.reduce((s,c) => s + c.item_price, 0).toFixed(2);
}

function placeOrder() {
  if (!cart.length) return alert('Cart is empty!');
  fetch('../backend/orders/create_order.php', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ items: cart })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      document.getElementById('orderMsg').innerHTML =
        `<p class="success">Order #${data.order_id} placed! Total: $${data.total}</p>`;
      cart = []; renderCart();
    } else {
      document.getElementById('orderMsg').innerHTML =
        `<p class="error">${data.error}</p>`;
    }
  });
}
</script>
</body>
</html>
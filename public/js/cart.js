export async function initCart() {
  const res = await fetch("/cart-data");
  const data = await res.json();

  const container = document.getElementById("cart-list");

  // 🔥 HANDLE BOTH STRUCTURES
  const items = data.items || data;

  if (!items.length) {
    container.innerHTML = "<p>Your cart is empty</p>";
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
  <div class="cart-row">

    <div class="cart-left">
      <div class="cart-title">
        ${item.name || item.pizza_name || "Pizza"}
      </div>

      <div class="cart-desc">
        Crust: ${item.crust_name || "N/A"} • 
        Toppings: ${
          item.toppings?.length
            ? item.toppings.map((t) => t.name).join(", ")
            : "None"
        } • 
        Qty: ${item.quantity}
      </div>
    </div>

    <div class="cart-right">
      ৳ ${item.price * item.quantity}
    </div>

  </div>
`,
    )
    .join("");

  // ✅ SUMMARY (safe fallback)
  document.getElementById("total").innerHTML = `
  <div class="summary-right">
    <div>Subtotal: ৳ ${data.subtotal}</div>
    <div>Discount: ৳ ${data.discount}</div>
    <div class="fw-bold">Total: ৳ ${data.finalTotal}</div>
  </div>
`;
}

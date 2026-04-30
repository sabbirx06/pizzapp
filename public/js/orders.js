const statusMap = {
  pending: { text: "🟡 Pending", class: "bg-warning text-dark" },
  assigned: { text: "👨‍🍳 Assigned", class: "bg-info text-dark" },
  out_for_delivery: { text: "🚚 On the way", class: "bg-primary" },
  delivered: { text: "✅ Delivered", class: "bg-success" },
};

export async function initOrders() {
  const container = document.getElementById("orders-container");

  async function loadOrders() {
    const res = await fetch("/orders/status");
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = "<p>No active orders</p>";
      return;
    }

    container.innerHTML = data
      .map((o) => {
        const status = statusMap[o.delivery_status] || statusMap["pending"];

        // 🍕 items (cleaner layout)
        const itemsHTML = o.items
          .map(
            (item) => `
        <div class="order-item">
          🍕 <strong>${item.pizza_name}</strong>
          <span class="qty">(x${item.quantity})</span>
          <div class="sub-text">Crust: ${item.crust_name}</div>
        </div>
      `,
          )
          .join("");

        // 🔥 steps
        const steps = ["pending", "assigned", "out_for_delivery", "delivered"];
        const currentIndex = steps.indexOf(o.delivery_status);

        const stepLabels = {
          pending: "received",
          assigned: "assigned",
          out_for_delivery: "delivery",
          delivered: "done",
        };

        const progressHTML = steps
          .map((step, i) => {
            const active = i <= currentIndex ? "active-step" : "";
            return `<div class="step ${active}">
          ${stepLabels[step]}
        </div>`;
          })
          .join("");

        return `
        <div class="col-md-6 col-lg-4">
          <div class="cart-card order-card">

            <div class="d-flex justify-content-between align-items-center">
              <h5>Order #${o.order_id}</h5>
              <span class="badge rounded-pill ${status.class}">
                ${status.text}
              </span>
              
            </div>

            <div class="tracking-bar">
              ${progressHTML}
            </div>

            <div class="order-items mt-3">
              ${itemsHTML}
            </div>

            <hr>

            <p class="price">৳ ${o.total_amount}</p>
            <p class="date">${new Date(o.created_at).toLocaleString()}</p>
            <p class="sub-text">
  ⏱ ETA: ${
    o.estimated_time
      ? new Date(o.estimated_time).toLocaleTimeString()
      : "Calculating..."
  }
</p>
<p class="sub-text">
  🚗 Driver: ${o.driver_name || "Not assigned"}
  ${o.driver_phone ? `(${o.driver_phone})` : ""}
</p>
           

          </div>
        </div>
      `;
      })
      .join("");
  }

  loadOrders();
  setInterval(loadOrders, 5000);
}

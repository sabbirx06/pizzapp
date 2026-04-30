export async function initOrders() {
  const container = document.getElementById("orders-container");

  async function loadOrders() {
    const res = await fetch("/orders/status");
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = "<p>No orders yet</p>";
      return;
    }

    container.innerHTML = data
      .map((o) => {
        const steps = [
          "received",
          "preparing",
          "baking",
          "out_for_delivery",
          "delivered",
        ];

        const currentIndex = steps.indexOf(o.delivery_status || o.status);

        const progressHTML = steps
          .map((step, i) => {
            const active = i <= currentIndex ? "active-step" : "";
            return `<div class="step ${active}">${step.replaceAll("_", " ")}</div>`;
          })
          .join("");

        return `
        <div class="cart-card mb-4">

          <h5>Order #${o.order_id}</h5>

          <div class="tracking-bar">
            ${progressHTML}
          </div>

          <p class="mt-2">
            Current Status: <strong>${o.delivery_status || o.status}</strong>
          </p>

        </div>
      `;
      })
      .join("");
  }

  // 🔁 AUTO REFRESH every 5 sec
  loadOrders();
  setInterval(loadOrders, 5000);
}

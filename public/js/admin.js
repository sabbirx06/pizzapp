export async function initAdmin() {
  const res = await fetch("/admin/orders");
  const { orders, drivers } = await res.json();

  const container = document.getElementById("admin-orders");

  if (!orders.length) {
    container.innerHTML = "<p>No orders found</p>";
    return;
  }

  container.innerHTML = orders
    .map((o) => {
      return `
      <div class="cart-card mb-3">

        <strong>Order #${o.order_id}</strong><br>
        Total: ৳ ${o.total_amount || 0}<br>
        Status: ${o.delivery_status || "pending"}<br><br>

        <input 
          type="text" 
          class="form-control mb-2 driver-search" 
          placeholder="Search driver..." 
          data-order="${o.order_id}"
        >

        <select class="form-select driver-select" data-order="${o.order_id}">
          <option value="">Select Driver</option>
          ${drivers
            .map(
              (d) => `
            <option value="${d.driver_id}" 
              ${o.driver_id == d.driver_id ? "selected" : ""}>
              ${d.full_name}
            </option>
          `,
            )
            .join("")}
        </select>

      </div>
    `;
    })
    .join("");

  // 🔥 SEARCH FILTER
  document.querySelectorAll(".driver-search").forEach((input) => {
    input.oninput = () => {
      const order_id = input.dataset.order;
      const select = document.querySelector(`select[data-order='${order_id}']`);
      const filter = input.value.toLowerCase();

      [...select.options].forEach((opt) => {
        if (!opt.value) return;
        opt.style.display = opt.text.toLowerCase().includes(filter)
          ? "block"
          : "none";
      });
    };
  });

  // 🔥 AUTO ASSIGN
  document.querySelectorAll(".driver-select").forEach((select) => {
    select.onchange = async () => {
      const order_id = select.dataset.order;
      const driver_id = select.value;

      if (!driver_id) return;

      await fetch("/admin/assign-driver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id, driver_id }),
      });

      location.reload();
    };
  });
}

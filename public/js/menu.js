export async function initMenu() {
  const [pizzas, crusts, toppings] = await Promise.all([
    fetch("/get-pizzas").then((r) => r.json()),
    fetch("/get-crusts").then((r) => r.json()),
    fetch("/get-toppings").then((r) => r.json()),
  ]);

  const container = document.getElementById("pizza-list");

  pizzas.forEach((p) => {
    const col = document.createElement("div");
    col.className = "col-md-4";

    col.innerHTML = `
      <div class="pizza-card">

        <h3 class="pizza-title">${p.name}</h3>
        <p class="pizza-desc">${p.description || ""}</p>

        <div class="price mb-2">৳ ${p.base_price}</div>

        <label>Crust</label>
        <select class="form-select mb-2 crust">
          ${crusts
            .map(
              (c) => `
            <option value="${c.crust_id}" data-price="${c.extra_price}">
              ${c.crust_name} (+${c.extra_price})
            </option>
          `,
            )
            .join("")}
        </select>

        <label>Toppings</label>
        <div class="toppings mb-2">
          ${toppings
            .map(
              (t) => `
            <button 
              class="btn topping-pill" 
              data-id="${t.topping_id}" 
              data-price="${t.extra_price}">
              ${t.topping_name}
            </button>
          `,
            )
            .join("")}
        </div>

        <label>Quantity</label>
        <input type="number" value="1" min="1" class="form-control mb-2 qty">

        <button class="btn btn-primary w-100 add-btn">Add to Cart</button>

      </div>
    `;

    // 🔥 Toggle pill
    const pills = col.querySelectorAll(".topping-pill");
    pills.forEach((pill) => {
      pill.onclick = () => {
        pill.classList.toggle("active-pill");
      };
    });

    col.querySelector(".add-btn").onclick = async () => {
      const crustEl = col.querySelector(".crust");

      const basePrice = Number(p.base_price);
      const crust_price = Number(crustEl.selectedOptions[0].dataset.price);

      const selectedPills = [...col.querySelectorAll(".active-pill")];

      const toppingsData = selectedPills.map((pill) => ({
        id: pill.dataset.id,
        name: pill.innerText,
        price: Number(pill.dataset.price),
      }));

      const topping_price = toppingsData.reduce((s, t) => s + t.price, 0);
      const qty = Number(col.querySelector(".qty").value);

      const price = basePrice + crust_price + topping_price;

      await fetch("/add-to-cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pizza_id: p.pizza_id,
          pizza_name: p.name,
          crust_id: crustEl.value,
          crust_name: crustEl.selectedOptions[0].text,
          toppings: toppingsData,
          quantity: qty,
          price,
        }),
      });

      showToast("Added to cart 🍕");
    };

    container.appendChild(col);
  });
}

function showToast(msg) {
  const toast = document.createElement("div");
  toast.innerText = msg;
  toast.className = "toast-msg";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

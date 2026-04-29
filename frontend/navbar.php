<?php if (!isset($_SESSION)) session_start(); ?>
<nav>
  <span class="nav-brand">🍕 PizzApp</span>
  <div>
    <?php if (isset($_SESSION['role'])): ?>
      <?php if ($_SESSION['role'] === 'customer'): ?>
        <a href="order.php">Order Pizza</a>
        <a href="orders.php">My Orders</a>
      <?php elseif ($_SESSION['role'] === 'driver'): ?>
        <a href="delivery.php">Delivery Dashboard</a>
      <?php elseif ($_SESSION['role'] === 'admin'): ?>
        <a href="admin_panel.php">Admin Panel</a>
        <a href="orders.php">All Orders</a>
        <a href="delivery.php">Deliveries</a>
      <?php endif; ?>
      <span>👤 <?= htmlspecialchars($_SESSION['username']) ?></span>
      <a href="../backend/auth/logout.php">Logout</a>
    <?php else: ?>
      <a href="login.php">Login</a>
      <a href="signup.php">Sign Up</a>
    <?php endif; ?>
  </div>
</nav>
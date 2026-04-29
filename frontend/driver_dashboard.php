<?php
session_start();
require_once '../config/db.php';
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'driver') {
    header('Location: login.html'); exit;
}
$driver_id = $_SESSION['user_id'];

// Get assigned deliveries
$result = mysqli_query($conn,
    "SELECT d.delivery_id, d.order_id, d.delivery_status, d.current_location,
            o.total_amount, o.status as order_status,
            c.full_name as customer_name, c.address
     FROM Delivery d
     JOIN Orders o ON d.order_id = o.order_id
     JOIN Customer c ON o.customer_id = c.customer_id
     WHERE d.driver_id = $driver_id OR d.delivery_status = 'pending'
     ORDER BY d.delivery_id DESC");
$deliveries = mysqli_fetch_all($result, MYSQLI_ASSOC);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PizzApp – Driver</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
<nav>
  <span>🍕 PizzApp Driver</span>
  <span><?= htmlspecialchars($_SESSION['username']) ?></span>
  <a href="../backend/auth/logout.php">Logout</a>
</nav>
<div class="container">
  <h2>My Deliveries</h2>
  <?php foreach ($deliveries as $d): ?>
  <div class="card">
    <p><strong>Order #<?= $d['order_id'] ?></strong> – <?= $d['customer_name'] ?></p>
    <p>Address: <?= htmlspecialchars($d['address']) ?></p>
    <p>Total: $<?= $d['total_amount'] ?> | Status: <?= $d['delivery_status'] ?></p>
    <form action="../backend/delivery/update_delivery.php" method="POST">
      <input type="hidden" name="order_id" value="<?= $d['order_id'] ?>">
      <input type="text" name="current_location" placeholder="Current location" value="<?= htmlspecialchars($d['current_location'] ?? '') ?>">
      <select name="delivery_status">
        <option value="assigned">Assigned</option>
        <option value="out_for_delivery">Out for Delivery</option>
        <option value="delivered">Delivered</option>
      </select>
      <button type="submit">Update</button>
    </form>
  </div>
  <?php endforeach; ?>
</div>
</body>
</html>
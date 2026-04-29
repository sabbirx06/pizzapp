<?php
session_start();
if (!isset($_SESSION['user_id'])) {
    header('Location: login.php'); exit;
}
require_once '../config/db.php';
$role = $_SESSION['role'];
$uid  = $_SESSION['user_id'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PizzApp – Dashboard</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
<?php include 'navbar.php'; ?>
<div class="container">

  <?php if ($role === 'customer'): ?>
    <h2>Welcome, <?= htmlspecialchars($_SESSION['username']) ?>!</h2>
    <?php
    $result = mysqli_query($conn,
        "SELECT o.order_id, o.status, o.total_amount, o.created_at
         FROM Orders o
         WHERE o.customer_id = $uid
         ORDER BY o.created_at DESC LIMIT 5");
    $orders = mysqli_fetch_all($result, MYSQLI_ASSOC);
    ?>
    <h3>Your Recent Orders</h3>
    <?php if (empty($orders)): ?>
      <p>No orders yet. <a href="order.php">Order now!</a></p>
    <?php else: ?>
      <table>
        <tr><th>Order #</th><th>Status</th><th>Total</th><th>Date</th></tr>
        <?php foreach ($orders as $o): ?>
        <tr>
          <td>#<?= $o['order_id'] ?></td>
          <td><?= $o['status'] ?></td>
          <td>$<?= $o['total_amount'] ?></td>
          <td><?= $o['created_at'] ?></td>
        </tr>
        <?php endforeach; ?>
      </table>
    <?php endif; ?>
    <a href="order.php" class="btn">Place New Order</a>

  <?php elseif ($role === 'driver'): ?>
    <h2>Driver Dashboard</h2>
    <?php
    $result = mysqli_query($conn,
        "SELECT d.order_id, d.delivery_status, d.current_location,
                o.total_amount, c.full_name, c.address
         FROM Delivery d
         JOIN Orders o ON d.order_id = o.order_id
         JOIN Customer c ON o.customer_id = c.customer_id
         WHERE d.driver_id = $uid OR d.delivery_status = 'pending'
         ORDER BY d.delivery_id DESC");
    $deliveries = mysqli_fetch_all($result, MYSQLI_ASSOC);
    ?>
    <?php foreach ($deliveries as $d): ?>
    <div class="card">
      <p><strong>Order #<?= $d['order_id'] ?></strong> — <?= htmlspecialchars($d['full_name']) ?></p>
      <p>Address: <?= htmlspecialchars($d['address']) ?></p>
      <p>Status: <?= $d['delivery_status'] ?> | Total: $<?= $d['total_amount'] ?></p>
      <form action="../backend/delivery/update_delivery.php" method="POST">
        <input type="hidden" name="order_id" value="<?= $d['order_id'] ?>">
        <input type="text" name="current_location" placeholder="Current location"
               value="<?= htmlspecialchars($d['current_location'] ?? '') ?>">
        <select name="delivery_status">
          <option value="assigned">Assigned</option>
          <option value="out_for_delivery">Out for Delivery</option>
          <option value="delivered">Delivered</option>
        </select>
        <button type="submit">Update</button>
      </form>
    </div>
    <?php endforeach; ?>

  <?php elseif ($role === 'admin'): ?>
    <h2>Admin Overview</h2>
    <?php
    $orders = mysqli_fetch_all(mysqli_query($conn,
        "SELECT o.order_id, o.status, o.total_amount, o.created_at, c.full_name
         FROM Orders o JOIN Customer c ON o.customer_id = c.customer_id
         ORDER BY o.created_at DESC LIMIT 10"), MYSQLI_ASSOC);
    ?>
    <h3>Recent Orders</h3>
    <table>
      <tr><th>ID</th><th>Customer</th><th>Status</th><th>Total</th><th>Date</th></tr>
      <?php foreach ($orders as $o): ?>
      <tr>
        <td>#<?= $o['order_id'] ?></td>
        <td><?= htmlspecialchars($o['full_name']) ?></td>
        <td><?= $o['status'] ?></td>
        <td>$<?= $o['total_amount'] ?></td>
        <td><?= $o['created_at'] ?></td>
      </tr>
      <?php endforeach; ?>
    </table>
    <a href="admin_panel.php" class="btn">Full Admin Panel</a>
  <?php endif; ?>

</div>
</body>
</html>
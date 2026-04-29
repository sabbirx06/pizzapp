<?php
session_start();
require_once '../config/db.php';
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    header('Location: login.html'); exit;
}

// All orders with customer info
$orders = mysqli_fetch_all(mysqli_query($conn,
    "SELECT o.order_id, o.status, o.total_amount, o.created_at,
            c.full_name, c.total_orders, c.total_spending
     FROM Orders o
     JOIN Customer c ON o.customer_id = c.customer_id
     ORDER BY o.created_at DESC"), MYSQLI_ASSOC);

// All drivers
$drivers = mysqli_fetch_all(mysqli_query($conn,
    "SELECT d.driver_id, d.full_name, d.is_available FROM Driver d"), MYSQLI_ASSOC);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PizzApp – Admin</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-sRIl4kxILFvY47J16cr9ZwB07vP4J8+LH7qKQnuqkuIAvNWLzeN8tE5YBujZqJLB" crossorigin="anonymous">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <!-- <nav class="navbar navbar-expand navbar-dark bg-dark" aria-label="Second navbar example"> <div class="container-fluid"> <a class="navbar-brand" href="#">Always expand</a> <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarsExample02" aria-controls="navbarsExample02" aria-expanded="false" aria-label="Toggle navigation"> <span class="navbar-toggler-icon"></span> </button> <div class="collapse navbar-collapse" id="navbarsExample02"> <ul class="navbar-nav me-auto"> <li class="nav-item"> <a class="nav-link active" aria-current="page" href="customer_dashboard.php">Home</a> </li> <li class="nav-item"> <a class="nav-link" href="#">Link</a> </li> </ul> <form role="search"> <input class="form-control" type="search" placeholder="Search" aria-label="Search"> </form> </div> </div> </nav> -->
<nav>
  <span>🍕 PizzApp Admin</span>
  <a href="../backend/auth/logout.php">Logout</a>
  <!-- <a href="customer_dashboard.php">Customer Dashboard</a> -->
</nav>
<div class="container">
  <h2>All Orders</h2>
  <table>
    <tr><th>ID</th><th>Customer</th><th>Status</th><th>Total</th><th>Orders</th><th>Spending</th><th>Date</th></tr>
    <?php foreach ($orders as $o): ?>
    <tr>
      <td>#<?= $o['order_id'] ?></td>
      <td><?= htmlspecialchars($o['full_name']) ?></td>
      <td><?= $o['status'] ?></td>
      <td>$<?= $o['total_amount'] ?></td>
      <td><?= $o['total_orders'] ?></td>
      <td>$<?= $o['total_spending'] ?></td>
      <td><?= $o['created_at'] ?></td>
    </tr>
    <?php endforeach; ?>
  </table>

  <h2>Drivers</h2>
  <table>
    <tr><th>ID</th><th>Name</th><th>Available</th></tr>
    <?php foreach ($drivers as $d): ?>
    <tr>
      <td><?= $d['driver_id'] ?></td>
      <td><?= htmlspecialchars($d['full_name']) ?></td>
      <td><?= $d['is_available'] ? '✅' : '❌' ?></td>
    </tr>
    <?php endforeach; ?>
  </table>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js" integrity="sha384-FKyoEForCGlyvwx9Hj09JcYn3nv7wiPVlz7YYwJrWVcXK/BmnVDxM+D2scQbITxI" crossorigin="anonymous"></script>   
</body>
</html>
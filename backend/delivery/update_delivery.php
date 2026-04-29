<?php
session_start();
require_once '../../config/db.php';

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'driver') {
    http_response_code(403); exit;
}

$driver_id       = $_SESSION['user_id'];
$order_id        = (int)$_POST['order_id'];
$delivery_status = $_POST['delivery_status'];
$current_location= $_POST['current_location'] ?? '';

// Map delivery status → order status
$order_status_map = [
    'assigned'         => 'preparing',
    'out_for_delivery' => 'out_for_delivery',
    'delivered'        => 'delivered',
];
$order_status = $order_status_map[$delivery_status] ?? 'preparing';

$delivered_at = ($delivery_status === 'delivered') ? 'NOW()' : 'NULL';

$stmt = mysqli_prepare($conn,
    "UPDATE Delivery SET delivery_status=?, current_location=?, driver_id=?
     WHERE order_id=?");
mysqli_stmt_bind_param($stmt, 'ssii', $delivery_status, $current_location, $driver_id, $order_id);
mysqli_stmt_execute($stmt);

$stmt2 = mysqli_prepare($conn, "UPDATE Orders SET status=? WHERE order_id=?");
mysqli_stmt_bind_param($stmt2, 'si', $order_status, $order_id);
mysqli_stmt_execute($stmt2);

header('Location: ../../frontend/driver_dashboard.php?updated=1');
?>
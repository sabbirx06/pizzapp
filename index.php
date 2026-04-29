<?php
session_start();
if (isset($_SESSION['role'])) {
    $map = ['customer' => 'customer_dashboard.php', 'driver' => 'driver_dashboard.php', 'admin' => 'admin_dashboard.php'];
    header('Location: frontend/' . $map[$_SESSION['role']]);
} else {
    header('Location: frontend/login.html');
}
?>
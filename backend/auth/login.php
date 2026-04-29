<?php
session_start();
require_once '../../config/db.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email    = trim($_POST['email']);
    $password = $_POST['password'];

    $stmt = mysqli_prepare($conn, 
        "SELECT * FROM Users WHERE email = ?");
    mysqli_stmt_bind_param($stmt, 's', $email);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);
    $user = mysqli_fetch_assoc($result);

    if ($user && password_verify($password, $user['password_hash'])) {
        $_SESSION['user_id'] = $user['user_id'];
        $_SESSION['role']    = $user['role'];
        $_SESSION['username']= $user['username'];

        // Redirect by role
        if ($user['role'] === 'customer') {
            header('Location: ../../frontend/customer_dashboard.php');
        } elseif ($user['role'] === 'driver') {
            header('Location: ../../frontend/driver_dashboard.php');
        } elseif ($user['role'] === 'admin') {
            header('Location: ../../frontend/admin_dashboard.php');
        }
    } else {
        header('Location: ../../frontend/login.html?error=invalid');
    }
}
?>
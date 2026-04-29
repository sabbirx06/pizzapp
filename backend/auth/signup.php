<?php
session_start();
require_once '../../config/db.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username']);
    $email    = trim($_POST['email']);
    $password = $_POST['password'];
    $role     = $_POST['role']; // customer, driver, admin
    $full_name = trim($_POST['full_name']);
    $phone    = trim($_POST['phone'] ?? '');
    $address  = trim($_POST['address'] ?? '');

    // Hash password
    $hash = password_hash($password, PASSWORD_DEFAULT);

    // Insert into Users
    $stmt = mysqli_prepare($conn, 
        "INSERT INTO Users (username, email, password_hash, role) VALUES (?, ?, ?, ?)");
    mysqli_stmt_bind_param($stmt, 'ssss', $username, $email, $hash, $role);

    if (mysqli_stmt_execute($stmt)) {
        $user_id = mysqli_insert_id($conn);

        // Insert into subtype table
        if ($role === 'customer') {
            $s = mysqli_prepare($conn,
                "INSERT INTO Customer (customer_id, full_name, phone, address) VALUES (?, ?, ?, ?)");
            mysqli_stmt_bind_param($s, 'isss', $user_id, $full_name, $phone, $address);
            mysqli_stmt_execute($s);
        } elseif ($role === 'driver') {
            $license = trim($_POST['license_number'] ?? '');
            $s = mysqli_prepare($conn,
                "INSERT INTO Driver (driver_id, full_name, phone, license_number) VALUES (?, ?, ?, ?)");
            mysqli_stmt_bind_param($s, 'isss', $user_id, $full_name, $phone, $license);
            mysqli_stmt_execute($s);
        } elseif ($role === 'admin') {
            $s = mysqli_prepare($conn,
                "INSERT INTO Admin (admin_id, full_name) VALUES (?, ?)");
            mysqli_stmt_bind_param($s, 'is', $user_id, $full_name);
            mysqli_stmt_execute($s);
        }

        header('Location: ../../frontend/login.html?signup=success');
    } else {
        header('Location: ../../frontend/signup.html?error=exists');
    }
}
?>
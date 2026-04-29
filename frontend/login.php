<?php
session_start();
if (isset($_SESSION['user_id'])) {
    header('Location: dashboard.php'); exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PizzApp – Login</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
<?php include 'navbar.php'; ?>
<div class="auth-box">
  <h1>🍕 PizzApp</h1>
  <h2>Login</h2>
  <?php if (isset($_GET['error'])): ?>
    <p class="error">Invalid email or password.</p>
  <?php endif; ?>
  <?php if (isset($_GET['signup'])): ?>
    <p class="success">Account created! Please login.</p>
  <?php endif; ?>
  <form action="../backend/auth/login.php" method="POST">
    <input type="email" name="email" placeholder="Email" required>
    <input type="password" name="password" placeholder="Password" required>
    <button type="submit">Login</button>
  </form>
  <p>No account? <a href="signup.php">Sign up</a></p>
</div>
</body>
</html>
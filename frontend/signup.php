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
  <title>PizzApp – Sign Up</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
<?php include 'navbar.php'; ?>
<div class="auth-box">
  <h1>🍕 PizzApp</h1>
  <h2>Create Account</h2>
  <?php if (isset($_GET['error'])): ?>
    <p class="error">Username or email already exists.</p>
  <?php endif; ?>
  <form action="../backend/auth/signup.php" method="POST">
    <input type="text" name="full_name" placeholder="Full Name" required>
    <input type="text" name="username" placeholder="Username" required>
    <input type="email" name="email" placeholder="Email" required>
    <input type="password" name="password" placeholder="Password" required>
    <input type="text" name="phone" placeholder="Phone">
    <select name="role" id="roleSelect" onchange="toggleFields(this.value)">
      <option value="customer">Customer</option>
      <option value="driver">Driver</option>
      <option value="admin">Admin</option>
    </select>
    <div id="customerFields">
      <input type="text" name="address" placeholder="Delivery Address">
    </div>
    <div id="driverFields" style="display:none">
      <input type="text" name="license_number" placeholder="License Number">
    </div>
    <button type="submit">Sign Up</button>
  </form>
  <p>Have an account? <a href="login.php">Login</a></p>
</div>
<script>
function toggleFields(role) {
  document.getElementById('customerFields').style.display = role === 'customer' ? 'block' : 'none';
  document.getElementById('driverFields').style.display   = role === 'driver'   ? 'block' : 'none';
}
</script>
</body>
</html>
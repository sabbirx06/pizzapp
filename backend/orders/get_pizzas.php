<?php
require_once '../../config/db.php';
header('Content-Type: application/json');

$pizzas   = mysqli_query($conn, "SELECT * FROM Pizza");
$crusts   = mysqli_query($conn, "SELECT * FROM Crust");
$toppings = mysqli_query($conn, "SELECT * FROM Toppings");

echo json_encode([
    'pizzas'   => mysqli_fetch_all($pizzas, MYSQLI_ASSOC),
    'crusts'   => mysqli_fetch_all($crusts, MYSQLI_ASSOC),
    'toppings' => mysqli_fetch_all($toppings, MYSQLI_ASSOC),
]);
?>
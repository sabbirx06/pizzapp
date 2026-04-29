<?php
session_start();
require_once '../../config/db.php';

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'customer') {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$customer_id = $_SESSION['user_id'];
$data = json_decode(file_get_contents('php://input'), true);
// $data = { items: [{pizza_id, crust_id, quantity, toppings:[topping_id,...]}, ...] }

mysqli_begin_transaction($conn);

try {
    // Check for applicable discount
    $disc_res = mysqli_query($conn,
        "SELECT discount_id FROM Discounts 
         WHERE (min_orders IS NOT NULL AND min_orders <= 
                (SELECT total_orders FROM Customer WHERE customer_id = $customer_id))
            OR (min_spending IS NOT NULL AND min_spending <= 
                (SELECT total_spending FROM Customer WHERE customer_id = $customer_id))
         ORDER BY discount_percent DESC LIMIT 1");
    $disc_row   = mysqli_fetch_assoc($disc_res);
    $discount_id = $disc_row ? $disc_row['discount_id'] : null;

    // Create order
    $stmt = mysqli_prepare($conn,
        "INSERT INTO Orders (customer_id, discount_id, status) VALUES (?, ?, 'received')");
    mysqli_stmt_bind_param($stmt, 'ii', $customer_id, $discount_id);
    mysqli_stmt_execute($stmt);
    $order_id = mysqli_insert_id($conn);

    $total = 0;

    foreach ($data['items'] as $item) {
        $pizza_id  = (int)$item['pizza_id'];
        $crust_id  = (int)$item['crust_id'];
        $quantity  = (int)$item['quantity'];

        // Get pizza base price
        $pr = mysqli_query($conn, "SELECT base_price FROM Pizza WHERE pizza_id = $pizza_id");
        $pizza = mysqli_fetch_assoc($pr);
        $base = $pizza['base_price'];

        // Get crust extra
        $cr = mysqli_query($conn, "SELECT extra_price FROM Crust WHERE crust_id = $crust_id");
        $crust = mysqli_fetch_assoc($cr);
        $crust_extra = $crust['extra_price'];

        // Get toppings extra
        $topping_extra = 0;
        if (!empty($item['toppings'])) {
            $ids = implode(',', array_map('intval', $item['toppings']));
            $tr = mysqli_query($conn, "SELECT SUM(extra_price) as total FROM Toppings WHERE topping_id IN ($ids)");
            $trow = mysqli_fetch_assoc($tr);
            $topping_extra = $trow['total'] ?? 0;
        }

        $item_price = ($base + $crust_extra + $topping_extra) * $quantity;
        $total += $item_price;

        // Insert order item
        $si = mysqli_prepare($conn,
            "INSERT INTO Order_Items (order_id, pizza_id, crust_id, quantity, item_price) VALUES (?,?,?,?,?)");
        mysqli_stmt_bind_param($si, 'iiiid', $order_id, $pizza_id, $crust_id, $quantity, $item_price);
        mysqli_stmt_execute($si);
        $item_id = mysqli_insert_id($conn);

        // Insert toppings
        foreach (($item['toppings'] ?? []) as $topping_id) {
            $st = mysqli_prepare($conn,
                "INSERT INTO Order_Toppings (item_id, topping_id) VALUES (?,?)");
            mysqli_stmt_bind_param($st, 'ii', $item_id, $topping_id);
            mysqli_stmt_execute($st);
        }
    }

    // Apply discount if any
    if ($discount_id) {
        $dr = mysqli_query($conn, "SELECT discount_percent FROM Discounts WHERE discount_id = $discount_id");
        $d  = mysqli_fetch_assoc($dr);
        $total = $total * (1 - $d['discount_percent'] / 100);
    }

    // Update order total
    $su = mysqli_prepare($conn, "UPDATE Orders SET total_amount = ? WHERE order_id = ?");
    mysqli_stmt_bind_param($su, 'di', $total, $order_id);
    mysqli_stmt_execute($su);

    // Update customer stats
    $sc = mysqli_prepare($conn,
        "UPDATE Customer SET total_orders = total_orders + 1, total_spending = total_spending + ? WHERE customer_id = ?");
    mysqli_stmt_bind_param($sc, 'di', $total, $customer_id);
    mysqli_stmt_execute($sc);

    // Create delivery record
    $sd = mysqli_prepare($conn, "INSERT INTO Delivery (order_id) VALUES (?)");
    mysqli_stmt_bind_param($sd, 'i', $order_id);
    mysqli_stmt_execute($sd);

    mysqli_commit($conn);
    echo json_encode(['success' => true, 'order_id' => $order_id, 'total' => round($total, 2)]);

} catch (Exception $e) {
    mysqli_rollback($conn);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
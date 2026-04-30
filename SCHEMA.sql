CREATE DATABASE IF NOT EXISTS pizzapp;
USE pizzapp;

-- USERS (supertype)
CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('customer', 'driver', 'admin') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CUSTOMER subtype
CREATE TABLE Customer (
    customer_id INT PRIMARY KEY,
    full_name VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    total_orders INT DEFAULT 0,
    total_spending DECIMAL(10,2) DEFAULT 0.00,
    FOREIGN KEY (customer_id) REFERENCES Users(user_id)
);

-- DRIVER subtype
CREATE TABLE Driver (
    driver_id INT PRIMARY KEY,
    full_name VARCHAR(100),
    phone VARCHAR(20),
    license_number VARCHAR(50),
    is_available BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (driver_id) REFERENCES Users(user_id)
);

-- ADMIN subtype
CREATE TABLE Admin (
    admin_id INT PRIMARY KEY,
    full_name VARCHAR(100),
    FOREIGN KEY (admin_id) REFERENCES Users(user_id)
);

-- CRUST
CREATE TABLE Crust (
    crust_id INT AUTO_INCREMENT PRIMARY KEY,
    crust_name VARCHAR(50) NOT NULL,
    extra_price DECIMAL(5,2) DEFAULT 0.00
);

-- PIZZA
CREATE TABLE Pizza (
    pizza_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    size ENUM('small', 'medium', 'large') NOT NULL,
    base_price DECIMAL(8,2) NOT NULL,
    description TEXT
);

-- TOPPINGS
CREATE TABLE Toppings (
    topping_id INT AUTO_INCREMENT PRIMARY KEY,
    topping_name VARCHAR(50) NOT NULL,
    extra_price DECIMAL(5,2) DEFAULT 0.00
);

-- DISCOUNTS
CREATE TABLE Discounts (
    discount_id INT AUTO_INCREMENT PRIMARY KEY,
    discount_name VARCHAR(100),
    min_orders INT DEFAULT NULL,
    min_spending DECIMAL(10,2) DEFAULT NULL,
    discount_percent DECIMAL(5,2) NOT NULL
);

-- ORDERS
CREATE TABLE Orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    discount_id INT DEFAULT NULL,
    status ENUM('received','preparing','baking','out_for_delivery','delivered') DEFAULT 'received',
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES Customer(customer_id),
    FOREIGN KEY (discount_id) REFERENCES Discounts(discount_id)
);

-- ORDER_ITEMS (each pizza in an order)
CREATE TABLE Order_Items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    pizza_id INT NOT NULL,
    crust_id INT NOT NULL,
    quantity INT DEFAULT 1,
    item_price DECIMAL(8,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES Orders(order_id),
    FOREIGN KEY (pizza_id) REFERENCES Pizza(pizza_id),
    FOREIGN KEY (crust_id) REFERENCES Crust(crust_id)
);

-- ORDER_TOPPINGS (toppings per pizza per order item)
CREATE TABLE Order_Toppings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    topping_id INT NOT NULL,
    FOREIGN KEY (item_id) REFERENCES Order_Items(item_id),
    FOREIGN KEY (topping_id) REFERENCES Toppings(topping_id)
);

-- DELIVERY
CREATE TABLE Delivery (
    delivery_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT UNIQUE NOT NULL,
    driver_id INT DEFAULT NULL,
    delivery_status ENUM('pending','assigned','out_for_delivery','delivered') DEFAULT 'pending',
    current_location VARCHAR(255) DEFAULT NULL,
    assigned_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    FOREIGN KEY (order_id) REFERENCES Orders(order_id),
    FOREIGN KEY (driver_id) REFERENCES Driver(driver_id)
);

-- Adding estimated_time column
ALTER TABLE Delivery ADD estimated_time DATETIME;

-- SAMPLE DATA
INSERT INTO Crust (crust_name, extra_price) VALUES
('Thin Crust', 0.00), ('Stuffed Crust', 1.50), ('Thick Crust', 0.50), ('Gluten Free', 2.00);

INSERT INTO Pizza (name, size, base_price, description) VALUES
('Margherita', 'medium', 8.99, 'Classic tomato and mozzarella'),
('Pepperoni', 'large', 12.99, 'Loaded with pepperoni'),
('BBQ Chicken', 'medium', 11.99, 'Smoky BBQ with grilled chicken'),
('Veggie Supreme', 'small', 7.99, 'Garden fresh vegetables');

INSERT INTO Toppings (topping_name, extra_price) VALUES
('Extra Cheese', 1.00), ('Mushrooms', 0.75), ('Olives', 0.50),
('Jalapeños', 0.50), ('Chicken', 1.50), ('Pepperoni', 1.25);

INSERT INTO Discounts (discount_name, min_orders, min_spending, discount_percent) VALUES
('First Timer', 0, 0.00, 5.00),
('Loyal Customer', 5, NULL, 10.00),
('Big Spender', NULL, 100.00, 15.00);



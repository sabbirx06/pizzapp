require("dotenv").config();
const mysql = require("mysql2");

// Parse Railway URL safely
const url = new URL(process.env.MYSQL_PUBLIC_URL);

const db = mysql.createConnection({
  host: url.hostname,
  user: url.username,
  password: url.password,
  database: url.pathname.replace("/", ""),
  port: url.port,
});

db.connect((err) => {
  if (err) {
    console.log("Error found in database:", err);
  } else {
    console.log("MYSQL successfully connected");
  }
});

module.exports = db;

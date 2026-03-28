import Database from "better-sqlite3";
const db = new Database("sipsnaps.db");

try {
  console.log("Adding order_link column to daily_drops...");
  db.exec("ALTER TABLE daily_drops ADD COLUMN order_link TEXT");
  console.log("Success!");
} catch (error) {
  if (error.message.includes("duplicate column name")) {
    console.log("Column already exists.");
  } else {
    console.error("Error:", error);
  }
}

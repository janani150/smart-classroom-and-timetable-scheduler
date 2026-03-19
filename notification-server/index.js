const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/collegeDB")
  .then(() => console.log("Notification DB connected"))
  .catch(err => console.log(err));

const NotificationSchema = new mongoose.Schema({
  message: String,
  createdAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model("Notification", NotificationSchema);

app.post("/notifications", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ message: "Message required" });
  }

  await Notification.create({ message });
  res.json({ message: "Notification sent successfully" });
});

app.listen(5000, () => {
  console.log("Notification server running on port 5000");
});

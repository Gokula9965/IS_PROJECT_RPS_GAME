import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const connectionDb = async () => {
  try {
      await mongoose.connect(process.env.MONGO_URI);
    console.log("Database connected");
  } catch (error) {
    console.log("Error in DB connection", error);
    process.exit(1);
  }
};

export default connectionDb;

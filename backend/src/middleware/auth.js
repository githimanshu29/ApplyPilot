import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export const protect = async (req, res, next) => {
  try {
    let token;

    if (
      // this token is send by client ->  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, token missing",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const user = await User.findById(decoded.userId).select(
      "-password -refreshToken",
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "user not found, Invalid Token from auth middleware",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, token invalid or expired from auth middleware",
      error: error.message,
    });
  }
};

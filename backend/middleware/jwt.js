import jwt from "jsonwebtoken";
import User from "../models/User.js";

const secret = process.env.JWT_SECRET;
const TOKEN_EXP = process.env.JWT_EXPIRES_IN || "1";
const COOKIE_MAX_AGE =
  parseInt(process.env.COOKIE_EXPIRES_IN) || 60 * 60 * 1000;

export const generateToken = (payload) => {
  if (typeof payload !== "object") {
    throw new Error("Payload must be an object when using 'expiresIn'!");
  }

  const expiresIn = TOKEN_EXP;
  if (!/^\d+[smhd]?$/.test(expiresIn) && isNaN(Number(expiresIn))) {
    throw new Error("Invalid JWT_EXPIRES_IN value in environment variables.");
  }

  return jwt.sign(payload, secret, {
    expiresIn: TOKEN_EXP,
  });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      console.error("Token is expired:", error.message);
    }
    console.error("Error verifying token:", error.message);
    throw error;
  }
};

export const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (!token)
      return res.status(401).json({ msg: "Not authorized to enter here!" });

    let decoded;

    try {
      decoded = verifyToken(token);
    } catch (error) {
      if (error.code === "TOKEN_EXPIRED") {
        return res.status(401).json({
          msg: "Session expired. Please login again.",
          code: "TOKEN_EXPIRED",
        });
      }
      return res.status(401).json({ msg: "Invalid token!" });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found!" });
    }

    // Token erneuern, wenn er in weniger als 5 Minuten abläuft
    const tokenExp = decoded.exp * 1000;
    const fiveMinutes = 5 * 60 * 1000;

    if (tokenExp - Date.now() < fiveMinutes) {
      const newToken = generateToken({ userId: user._id });
      res.cookie("jwt", newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: COOKIE_MAX_AGE,
      });
    }

    req.user = { id: user._id, role: user.role };
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(403).json({ msg: "Authentication failed!" });
  }
};

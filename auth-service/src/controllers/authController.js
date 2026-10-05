const prisma = require("../config/prisma");

const { hashPassword, comparePassword } = require("../utils/hash");

const { signToken } = require("../utils/token");

async function register(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      return res.status(409).json({
        message: "Email already registered.",
      });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
      },
    });

    const token = signToken({ userId: user.id, role: user.role });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await comparePassword(password, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const token = signToken({ userId: user.id, role: user.role });

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
}

async function verify(req, res) {
  res.status(200).json({
    valid: true,
    user: req.user,
  });
}

module.exports = { register, login, verify };

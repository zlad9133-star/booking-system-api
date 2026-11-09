const app = require('../index');
const mongoose = require('mongoose');

let connectionPromise;

module.exports = async function handler(req, res) {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('Missing MONGO_URI environment variable');
    }

    if (mongoose.connection.readyState !== 1) {
      if (!connectionPromise) {
        connectionPromise = mongoose.connect(process.env.MONGO_URI).catch((error) => {
          connectionPromise = null;
          throw error;
        });
      }
      await connectionPromise;
    }

    return app(req, res);
  } catch (error) {
    console.error('Vercel function initialization failed:', error);
    return res.status(500).json({
      message: 'Backend initialization failed',
      error: process.env.NODE_ENV === 'production' ? 'Check Vercel function logs and environment variables.' : error.message
    });
  }
};

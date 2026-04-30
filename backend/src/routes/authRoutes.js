const express = require('express');
const router = express.Router();
// Memanggil file baru (auth_controller.js)
const authController = require('../controllers/auth_controller');

// Menangani POST /api/login dan /api/auth/login
router.post('/login', authController.login);
router.post('/', authController.login); // Untuk handle redirect dari server.js

// Menangani POST /api/register dan /api/auth/register
router.post('/register', authController.register);


module.exports = router;
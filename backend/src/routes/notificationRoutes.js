const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

router.post('/', notificationController.createNotification);
router.get('/', notificationController.getNotifications);
router.post('/:notification_id/send', notificationController.sendNotification);
router.put('/read', notificationController.markAsRead);
router.delete('/:notification_id', notificationController.deleteNotification);
router.post('/emergency', notificationController.sendEmergencyAlert);

// --- PUSH NOTIFICATION ENDPOINTS ---
router.post('/register-token', notificationController.registerToken);
router.post('/respond', notificationController.respondNotification);

module.exports = router;
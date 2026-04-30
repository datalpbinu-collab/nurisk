const express = require('express');
const router = express.Router();
const volunteerController = require('../controllers/volunteerController');

// --- AUTH ---
router.post('/register', volunteerController.register);
router.post('/login', volunteerController.login);

// --- AVAILABILITY & SCHEDULES ---
router.post('/schedules', volunteerController.setAvailability);
router.get('/schedules', volunteerController.getAvailability);

// --- SKILL MATCHING ---
router.get('/nearby', volunteerController.getNearbyVolunteers);
router.post('/match', volunteerController.matchVolunteers);

// --- CERTIFICATIONS ---
router.post('/certifications', volunteerController.addCertification);
router.get('/certifications/:volunteer_id', volunteerController.getCertifications);

// --- PERFORMANCE ---
router.post('/performance', volunteerController.logPerformance);
router.get('/performance/:volunteer_id', volunteerController.getPerformance);

// --- PROFILE ---
router.put('/profile/:id', volunteerController.updateProfile);
router.post('/checkin', volunteerController.checkIn);

// --- DEPLOYMENTS (Apply Duty from Field Staff/Relawan) ---
router.post('/deployments', volunteerController.applyDuty);
router.get('/deployments/:incident_id', volunteerController.getApplicantsByIncident);
router.put('/deployments/:id', volunteerController.approveDeployment);

// --- LOCATION (Background Geolocation) ---
router.post('/location-sync', volunteerController.syncLocation);
router.post('/location', volunteerController.updateLocation);

// --- EXISTING ENDPOINTS FOR COMPATIBILITY ---
router.post('/', volunteerController.createVolunteerProfile);

module.exports = router;
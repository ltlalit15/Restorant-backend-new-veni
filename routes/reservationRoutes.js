const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const { verifyToken, checkRole, checkPermission } = require('../middleware/auth');
const { validateReservation, handleValidationErrors } = require('../middleware/validation');

// Get all reservations

router.get('/', verifyToken, checkRole(['admin', 'staff']), reservationController.getAllReservations);

// Get user's reservations
router.get('/my-reservations', verifyToken, reservationController.getUserReservations);

// Get reservation by ID
router.get('/:id', verifyToken, reservationController.getReservationById);

router.get('/re/timeslots', reservationController.getTimeSlots);

// Create new reservation
router.post('/', verifyToken, validateReservation, handleValidationErrors, reservationController.createReservation);

// Update reservation
router.put('/:id', verifyToken, reservationController.updateReservation);

// Update reservation status
router.patch('/:id/status', verifyToken, checkRole(['admin', 'staff', 'user']), reservationController.updateReservationStatus);

// Cancel reservation
router.patch('/:id/cancel', verifyToken, reservationController.cancelReservation);

// Delete reservation (Admin only)
router.delete('/:id', verifyToken, checkPermission('manage_reservations'), reservationController.deleteReservation);

// Get reservation statistics
router.get('/stats/overview', verifyToken, checkRole(['admin', 'staff']), reservationController.getReservationStats);

module.exports = router;
const express = require('express');
const router = express.Router();
const shelterController = require('../controllers/shelterController');

router.post('/', shelterController.createShelter);
router.get('/', shelterController.getShelters);
router.get('/:id', shelterController.getShelterById);
router.put('/:id', shelterController.updateShelter);
router.patch('/:id', shelterController.updateShelter);
router.post('/:shelter_id/forms', shelterController.submitForm);
router.delete('/:id', shelterController.deleteShelter);

module.exports = router;
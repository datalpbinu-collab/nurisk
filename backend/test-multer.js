const express = require('express');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const app = express();
app.post('/', upload.single('photo'), (req, res) => {
  res.json({ body: req.body, file: req.file });
});
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});
app.listen(9999, () => console.log('test on 9999'));

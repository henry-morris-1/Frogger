const express = require('express');
const app = express();
const router = express.Router();
const PORT = 80;

// Designate the public folder as serving static resources
router.use(express.static('static'));
router.use(express.urlencoded({extended: true}));

// Designate the html templates folder
const path = require('path');
const html_dir = path.join(__dirname, '../templates/');

// Route the html file
app.get('/', (req, res) => {
    res.sendFile(`${html_dir}/index.html`);
});

// Redirect
router.get('*', (req, res) => {
    res.redirect('/');
});

// Add the routes to the express server
app.use(router);

// Ask our server to listen for incoming connections
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
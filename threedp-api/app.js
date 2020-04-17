var express = require('express');
var app = express();


var swaggerUi = require('swagger-ui-express');
var swaggerDocument = require('./swagger.json');


var threedpController = require('./threedpController');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/threedp', EHRController);

module.exports = app;
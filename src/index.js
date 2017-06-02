const app = require('./app');
const Ship = require('./components/ship');
const DragCamera = require('./components/dragcamera');

app.start();

const frigate = require('./ships/frigate');
const ship = app.add(Ship, { data: frigate });
const dragCamera = app.add(DragCamera);
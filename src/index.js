const app = require('./app');
const Ship = require('./components/ship');
const DragCamera = require('./components/dragcamera');
const Asteroid = require('./components/asteroid');
const Grid = require('./components/grid');

app.start();

const frigate = require('./ships/frigate');
const ship = app.add(Ship, { data: frigate });
// app.add(Asteroid);
const dragCamera = app.add(DragCamera);

app.add(Grid);
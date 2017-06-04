const app = require('./core/app');
const container = require('./container');
const Ship = require('./components/ship');
const DragCamera = require('./components/dragcamera');
const Asteroid = require('./components/asteroid');
const Grid = require('./components/grid');
const Ships = require('./components/ship/ships');
const Fleet = require('./fleet');

app.start();
app.add(Ships);

const frigate = require('./ships/frigate');
const ship = app.add(Ship, { 
	data: frigate, 
	side: '0' });

const fleet = new Fleet({
	ships: [ship]
});
container.fleet = fleet;

const grid = app.add(Grid);

grid.place(fleet.ships);

const dragCamera = app.add(DragCamera);
dragCamera.distance = 200;
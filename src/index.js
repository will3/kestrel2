const app = require('./app');
const Ship = require('./components/ship');
const DragCamera = require('./components/dragcamera');
const Asteroid = require('./components/asteroid');
const Grid = require('./components/grid');
const Ships = require('./components/ship/ships');

app.start();

const frigate = require('./ships/frigate');

app.add(Ships);

const ship = app.add(Ship, { 
	data: frigate, 
	side: '0',
	rotation: new THREE.Euler(0, Math.random() * Math.PI * 2) });
ship.position.x = (Math.random() - 0.5) * 100;
ship.position.z = (Math.random() - 0.5) * 100;

const ship2 = app.add(Ship, { 
	data: frigate, 
	side: '1',
	rotation: new THREE.Euler(0, Math.random() * Math.PI * 2) });
ship2.position.x = (Math.random() - 0.5) * 100;
ship2.position.z = (Math.random() - 0.5) * 100;

// app.add(Asteroid);
const dragCamera = app.add(DragCamera);
dragCamera.distance = 200;

app.add(Grid);
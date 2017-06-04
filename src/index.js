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

const noise = require('perlin').noise;
noise.seed(Math.random());

const asteroids = {};

for (let i = 0; i < grid.width; i++) {
	for (let j = 0; j < grid.height; j++) {
		const coord = grid.hexToCoord(i, j);
		const dis = Math.sqrt(coord[0] * coord[0] + coord[1] * coord[1]);

		let ratio = Math.pow((-dis + 500) / 500, 0.5);
		if (ratio > 1) {
			ratio = 1;
		} else if (ratio < 0) {
			ratio = 0;
		}

		const n1 = noise.simplex2(coord[0] * 0.005, coord[1] * 0.005);
		const n2 = noise.simplex2(coord[0] * 0.1, coord[1] * 0.1) * 0.7;
		const n = (n1 + n2) * ratio;

		if (n > 0.7) {
			const size = n > 0.95 ? 4 : n > 0.9 ? 3 : n > 0.8 ? 2 : 1;

			const id = [i, j].join(',');
			asteroids[id] = {
				size: size,
				position: new THREE.Vector3(coord[0], 0, coord[1]),
				coord: [i, j]
			};
		}
	}
}

const shuffle = require('knuth-shuffle').knuthShuffle;
const ids = shuffle(Object.keys(asteroids));
for (let i = 0; i < ids.length; i++) {
	const asteroid = asteroids[ids[i]];
	if (asteroid.removed) {
		continue;
	}
	if (asteroid.size >= 3) {
		// Remove asteroid around
		const coords = grid.getSurroundingCoords(asteroid.coord);

		for (let j = 0; j < coords.length; j++) {
			const coord = coords[j];
			const id = coord.join(',');
			if (asteroids[id] == null) {
				continue;
			}
			asteroids[id].removed = true;
		}
	}
}

for (let id in asteroids) {
	const asteroid = asteroids[id];
	if (asteroid.removed) {
		continue;
	}
	app.add(Asteroid, {
		position: asteroid.position,
		size: asteroid.size
	});
}

// const ambientLight = new THREE.AmbientLight(0xAAAAAA);
// const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
// directionalLight.position.set(0.5, 1.0, 0.3);

// const scene = app.renderer.scene;

// scene.add(ambientLight);
// scene.add(directionalLight);
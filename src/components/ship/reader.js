const container = require('../../container');
const Engine = require('../engine');
const Turrent = require('./turrent');
const Beam = require('../beam');
const Laser = require('../laser');

const reader = (data, ship) => {
	const lines = data.split('\n');
	const chunks = ship.chunks;
	const engines = ship.engines;

	let line;
	let current;
	let z = 0;
	let char;

	const result = {
		modules: []
	};

	const app = container.app;

	for (let i = 0; i < lines.length; i++) {
		line = lines[i];

		if (line === 'HULL') {
			current = 'HULL';
			z = 0;
		} else if (line === 'MODULES') {
			current = 'MODULES';
			z = 0;
		} else if (current === 'HULL') {
			for (let x = 0; x < line.length; x++) {
				char = line[x];

				if (char === '0') {
					chunks.set(x, 0, z, 1);
					ship.hull.push([x, 0, z, 1]);
				}
			}
			z++;
		} else if (current === 'MODULES') {
			for (let x = 0; x < line.length; x++) {
				char = line[x];
				if (char === 'E') {
					const engine = app.add(Engine, {
						ship: ship,
						coord: [x, 0, z]
					});
					engines.push(engine);
				} else if (char === 'L' || char === 'l') {
					const type = Laser;
					const cooldown = 0.1;
					const reloadTime = 1.0;
					const clip = 5;

					ship.turrents.push(new Turrent({
						coord: [x, 0, z],
						ship: ship,
						type, cooldown, reloadTime, clip
					}));
				}
			}
			z++;
		}
	}

	const center = [ 0, 0, 0 ];
	for (let i = 0; i < ship.hull.length; i++) {
		const v = ship.hull[i];
		center[0] += v[0];
		center[1] += v[1];
		center[2] += v[2];
	}
	center[0] /= ship.hull.length;
	center[1] /= ship.hull.length;
	center[2] /= ship.hull.length;
	
	center[0] += 0.5;
	center[1] += 0.5;
	center[2] += 0.5;

	ship.center.fromArray(center);

	ship.innerObject.position.fromArray(center).multiplyScalar(-1);

	return result;
};

module.exports = reader;
const container = require('../container');
const Engine = require('../components/engine');
const Turrent = require('../components/ship/turrent');

const reader = (data, ship) => {
	const lines = data.split('\n');
	const chunks = ship.chunks;
	const engines = ship.engines;

	let line;
	let current;
	let z = 0;
	let char;

	const result = {
		hull: [],
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
					result.hull.push([x, 0, z, 1]);
				}
			}
			z++;
		} else if (current === 'MODULES') {
			for (let x = 0; x < line.length; x++) {
				char = line[x];
				if (char === 'E') {
					app.add(Engine, {
						ship: ship,
						coord: [x, 0, z]
					});
				} else if (char === 'L') {
					ship.turrents.push(new Turrent({
						coord: [x, 0, z],
						ship: ship,
						type: 'L'
					}));
				}
			}
			z++;
		}
	}

	const center = [ 0, 0, 0 ];
	for (let i = 0; i < result.hull.length; i++) {
		const v = result.hull[i];
		center[0] += v[0];
		center[1] += v[1];
		center[2] += v[2];
	}
	center[0] /= -result.hull.length;
	center[1] /= -result.hull.length;
	center[2] /= -result.hull.length;
	
	center[0] -= 0.5;
	center[1] -= 0.5;
	center[2] -= 0.5;

	result.center = center;

	ship.innerObject.position.fromArray(center);

	return result;
};

module.exports = reader;
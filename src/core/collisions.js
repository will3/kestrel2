const guid = require('./guid');

class Collisions {
	constructor(props) {
		this.map = {};
		this.app = props.app;
	}

	add(body) {
		if (body._id == null) {
			body._id = guid();
		}

		this.map[body._id] = body;
	}

	remove(body) {
		delete this.map[body._id];
	}

	tick() {
		const keys = Object.keys(this.map);

		for (let i = 0; i < keys.length; i++) {
			for (let j = i + 1; j < keys.length; j++) {
				const a = this.map[keys[i]];
				const b = this.map[keys[j]];

				// Resolve a, b				
				if (a.type === 'ray' && b.type === 'mesh') {
					this.hitTestRayMesh(a, b);
				} else if (a.type === 'mesh' && b.type === 'ray') {
					this.hitTestRayMesh(b, a);
				}
			}
		}
	}

	hitTestRayMesh(ray, mesh) {
		const delta = this.app.delta;

		const raycaster = ray.raycaster;
		const results = raycaster.intersectObject(mesh.mesh, true);

		if (results.length === 0) {
			return;
		}

		if (ray.onCollision != null) {
			ray.onCollision({
				results: results,
				body: mesh
			});
		}

		if (mesh.onCollision != null) {
			mesh.onCollision({
				results: results,
				body: ray
			});
		}
	}
};

module.exports = Collisions;
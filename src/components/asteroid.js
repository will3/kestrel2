const container = require('../container');
const randomQuaternion = require('../utils/math').randomQuaternion;
const randomUnitVector = require('../utils/math').randomUnitVector;

class Asteroid {
	constructor(props) {
		props = props || {};
		this.__isAsteroid = true;
		this.size = props.size || 1;
		this.scene = container.scene;
		this.collisions = container.collisions;

		// const geometry = new THREE.IcosahedronGeometry(3.5 * this.size);
		const geometry = props.geometry || new THREE.BoxGeometry(3.5, 3.5, 3.5);
		geometry.computeFlatVertexNormals();
		const material = new THREE.MeshLambertMaterial({
			color: 0x999999
		});
		this.object = new THREE.Mesh(geometry, material);
		this.object.scale.set(this.size, this.size, this.size);
		this.object.quaternion.copy(randomQuaternion());
		if (props.position != null) {
			this.object.position.copy(props.position);
		}

		const speed = Math.random() * 0.03 / this.size / this.size;
		this.rotationSpeed = 
			new THREE.Quaternion().setFromAxisAngle(randomUnitVector(), speed);

		this.body = {
			type: 'mesh',
			onCollision: this.onCollision,
			mesh: this.object,
			entity: this,
			mask: [],
			static: true
		};
	}

	get position() {
		return this.object.position;
	}

	start() {
		this.scene.add(this.object);
		this.collisions.add(this.body);
	}

	tick(dt) {
		this.object.quaternion.multiply(this.rotationSpeed);
	}

	destroy() {
		this.scene.remove(this.object);	
		this.collisions.remove(this.body);
	}
}

module.exports = Asteroid;
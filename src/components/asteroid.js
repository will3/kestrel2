const container = require('../container');
const randomQuaternion = require('../utils/math').randomQuaternion;

class Asteroid {
	constructor(props) {
		this.scene = container.scene;
		const geometry = new THREE.BoxGeometry(10, 10, 10);
		this.object = new THREE.Mesh(geometry);
		this.object.quaternion.copy(randomQuaternion());
	}

	start() {
		this.scene.add(this.object);
	}

	tick(dt) {

	}

	destroy() {
		this.scene.remove(this.object);	
	}
}

module.exports = Asteroid;
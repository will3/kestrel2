const container = require('../container');
const randomQuaternion = require('../utils/math').randomQuaternion;

class Asteroid {
	constructor(props) {
		props = props || {};
		this.size = props.size || 1;
		this.scene = container.scene;
		const geometry = new THREE.IcosahedronGeometry(3.5 * this.size);
		// geometry.computeFlatVertexNormals();
		const material = new THREE.MeshBasicMaterial({
			color: 0xCCCCCC
		});
		this.object = new THREE.Mesh(geometry, material);
		this.object.quaternion.copy(randomQuaternion());
		if (props.position != null) {
			this.object.position.copy(props.position);
		}
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
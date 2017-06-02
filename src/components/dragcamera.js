const container = require('../container');

class DragCamera {
	start() {
		this.rotation = new THREE.Euler(-Math.PI / 4, Math.PI / 4, 0, 'YXZ');
		this.distance = 50;
		this.target = new THREE.Vector3();
		this.camera = container.camera;
		this.up = new THREE.Vector3(0, 1, 0);

		this.onMouseWheel = this.onMouseWheel.bind(this);

		window.addEventListener('mousewheel', this.onMouseWheel);
	}

	onMouseWheel(e) {
		const scale = 1 + e.deltaY / 1000;
		this.distance *= scale;
	}

	tick() {
		const position = this.target.clone()
			.add(new THREE.Vector3(0, 0, 1)
				.applyEuler(this.rotation)
				.multiplyScalar(this.distance));
		this.camera.position.copy(position);
		this.camera.lookAt(this.target, this.up);
	}

	destroy() {
		window.removeEventListener('mousewheel', this.onMouseWheel);
	}
};

module.exports = DragCamera;
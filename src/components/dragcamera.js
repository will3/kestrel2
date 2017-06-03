const container = require('../container');

class DragCamera {
	constructor(props) {
		this.rotation = new THREE.Euler(-Math.PI / 4, Math.PI / 4, 0, 'YXZ');
		this.distance = 50;
		this.target = new THREE.Vector3();
		this.camera = container.camera;
		this.up = new THREE.Vector3(0, 1, 0);
		this.isDrag = false;
		this.lastX = 0;
		this.lastY = 0;
		this.xSpeed = 0.01;
		this.ySpeed = 0.01;

		this.onMouseWheel = this.onMouseWheel.bind(this);
		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseUp = this.onMouseUp.bind(this);
		this.onMouseMove = this.onMouseMove.bind(this);
	}

	start() {
		window.addEventListener('mousewheel', this.onMouseWheel);
		window.addEventListener('mousedown', this.onMouseDown);
		window.addEventListener('mouseup', this.onMouseUp);
		window.addEventListener('mousemove', this.onMouseMove);
	}

	onMouseWheel(e) {
		const scale = 1 + e.deltaY / 1000;
		this.distance *= scale;
	}

	onMouseDown(e) {
		this.isDrag = true;
	}

	onMouseUp(e) {
		this.isDrag = false;
	}

	onMouseMove(e) {
		if (this.isDrag) {
			const diffX = e.clientX - this.lastX;
			const diffY = e.clientY - this.lastY;

			this.rotation.x += diffY * this.ySpeed;
			this.rotation.y += diffX * this.xSpeed;
		}

		this.lastX = e.clientX;
		this.lastY = e.clientY;
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
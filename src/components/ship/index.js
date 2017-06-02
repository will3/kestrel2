const container = require('../../container');
const THREE = require('three');
const Chunks = require('../../voxel/chunks');
const mesher = require('../../voxel/mesher');
const reader = require('../../ships/reader');

class Ship {
	constructor(props) {
		this.props = props;
		this.scene = container.scene;
		this.object = new THREE.Object3D();
		this.object.rotation.order = 'YXZ';
		this.innerObject = new THREE.Object3D();
		this.innerObject.rotation.order = 'YXZ';
		this.object.add(this.innerObject);
		this.chunks = new Chunks();

		this.engines = [];
		this.turrents = [];

		this.turnSpeed = 0;

		this.turnAmount = 0;
		this.forwardAmount = 0;

		this.speed = new THREE.Vector3();
	}

	start() {
		this.material = [ null, new THREE.MeshBasicMaterial({
			color: 0xffffff
		}) ];

		this.scene.add(this.object);
	
		reader(this.props.data, this);
	}

	tick(dt) {
		mesher(this.chunks, this.innerObject, this.material);

		// demo
		this.forward(1);
		this.turn(1);

		for (let i = 0; i < this.turrents.length; i ++) {

		}

		// Step yaw
		const turnAcceleration = 0.1;
		const maxTurnSpeed = 0.01;
		const desiredTurnSpeed = this.turnAmount * maxTurnSpeed;

		if (this.turnSpeed < desiredTurnSpeed) {
			this.turnSpeed += turnAcceleration * dt;
		} else if (this.turnSpeed > desiredTurnSpeed) {
			this.turnSpeed -= turnAcceleration * dt;
		}

		if (this.turnSpeed < -maxTurnSpeed) {
			this.turnSpeed = -maxTurnSpeed;
		} else if (this.turnSpeed > maxTurnSpeed) {
			this.turnSpeed = maxTurnSpeed;
		}

		// Step roll
		this.object.rotation.y += this.turnSpeed;

		const ratio = this.turnSpeed / maxTurnSpeed;

		const maxRollAmount = Math.PI / 8;
		const angle = ratio * maxRollAmount;

		this.object.rotation.z += (angle - this.object.rotation.z) * 0.01;

		this.turnAmount = 0;

		// Step forward
		const power = 1;
		const acc = new THREE.Vector3(0, 0, -1)
			.applyEuler(this.object.rotation)
			.multiplyScalar(this.forwardAmount * power * dt);

		this.speed.add(acc);
		this.object.position.add(this.speed);

		this.speed.multiplyScalar(0.97);

		this.forwardAmount = 0;
	}

	turn(amount) {
		this.turnAmount = amount;
	}

	forward(amount) {
		this.forwardAmount = amount;
	}

	orbit(point) {

	}

	destroy() {

	}
}

module.exports = Ship;
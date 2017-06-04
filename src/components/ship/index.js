const container = require('../../container');
const THREE = require('three');
const Chunks = require('../../voxel/chunks');
const mesher = require('../../voxel/mesher');
const reader = require('./reader');
const normalizeAngle = require('../../utils/math').normalizeAngle;
const clamp = require('../../utils/math').clamp;
const AI = require('./ai');

class Ship {
	constructor(props) {
		this.__isShip = true;

		this.props = props;
		this.scene = container.scene;
		this.app = container.app;
		this.collisions = container.collisions;

		this.object = new THREE.Object3D();
		this.object.rotation.order = 'YXZ';

		if (props.rotation != null) {
			this.object.rotation.copy(props.rotation);
		}

		this.innerObject = new THREE.Object3D();
		this.innerObject.rotation.order = 'YXZ';
		this.object.add(this.innerObject);
		this.chunks = new Chunks();

		this.engines = [];
		this.turrents = [];

		this.turnSpeed = 0;

		this.turnAmount = 0;
		this.forwardAmount = 0;
		this.maxTurnSpeed = 0.03;
		this.power = 6;

		this.velocity = new THREE.Vector3();

		this.friction = 0.5;

		this.hull = [];

		this.ai = new AI({
			ship: this
		});

		this.side = props.side || 0;

		this.hull = [];
		this.center = new THREE.Vector3();

		this.onCollision = this.onCollision.bind(this);
		this.body = {
			type: 'mesh',
			onCollision: this.onCollision,
			mesh: this.innerObject,
			entity: this
		}
	}

	onCollision(collision) {

	}

	get position() {
		return this.object.position;
	}

	get rotation() {
		return this.object.rotation;
	}

	start() {
		this.material = [ null, new THREE.MeshBasicMaterial({
			color: 0xffffff
		}) ];

		this.scene.add(this.object);
	
		const result = reader(this.props.data, this);

		this.ai.start();

		this.collisions.add(this.body);
	}

	destroy() {
		this.scene.remove(this.object);
		this.collisions.remove(this.body);
	}

	tick() {
		const dt = this.app.delta;
		this.ai.tick(dt);
		mesher(this.chunks, this.innerObject, this.material);

		// Step turrents
		for (let i = 0; i < this.turrents.length; i ++) {
			const turrent = this.turrents[i];
			turrent.tick(dt);
		}

		// Step yaw
		const turnAcceleration = 0.1;
		const desiredTurnSpeed = this.turnAmount * this.maxTurnSpeed;

		if (this.turnSpeed < desiredTurnSpeed) {
			this.turnSpeed += turnAcceleration * dt;
		} else if (this.turnSpeed > desiredTurnSpeed) {
			this.turnSpeed -= turnAcceleration * dt;
		}

		if (this.turnSpeed < -this.maxTurnSpeed) {
			this.turnSpeed = -this.maxTurnSpeed;
		} else if (this.turnSpeed > this.maxTurnSpeed) {
			this.turnSpeed = this.maxTurnSpeed;
		}

		// Step roll
		this.object.rotation.y += this.turnSpeed;

		const ratio = this.turnSpeed / this.maxTurnSpeed;

		const maxRollAmount = Math.PI / 4;
		const angle = ratio * maxRollAmount;

		this.object.rotation.z += (angle - this.object.rotation.z) * 0.01;

		// this.turnAmount = 0;

		// Step forward
		const acc = new THREE.Vector3(0, 0, -1)
			.applyEuler(this.object.rotation)
			.multiplyScalar(this.forwardAmount * this.power * dt);

		this.velocity.add(acc);
		this.object.position.add(this.velocity.clone().multiplyScalar(dt));

		this.velocity.multiplyScalar(Math.pow(this.friction, dt));

		this.engines.forEach((engine) => {
			engine.amount = this.forwardAmount;
		});
	}

	ascend(y) {
		const yDiff = y - this.object.position.y;
		const desiredYSpeed = yDiff * 0.1;
		const ySpeedDiff = desiredYSpeed - this.velocity.y;
		const desiredYAcc = ySpeedDiff * 0.1;

		let ratio = desiredYAcc / this.power;
		if (ratio > 1.0) {
			ratio = 1.0;
		} else if (ratio < -1.0) {
			ratio = -1.0;
		}

		let desiredPitch = Math.asin(ratio);

		const maxPitch = 0.3

		if (desiredPitch > maxPitch) {
			desiredPitch = maxPitch;
		} else if (desiredPitch < -maxPitch) {
			desiredPitch = -maxPitch;
		}

		const pitchDiff = desiredPitch - this.rotation.x;

		const desiredPitchSpeed = pitchDiff;

		const maxPitchSpeed = 0.03;


		this.rotation.x += clamp(desiredPitchSpeed, -maxPitchSpeed, maxPitchSpeed);
	}

	turn(amount) {
		this.turnAmount = amount;
	}

	forward(amount) {
		this.forwardAmount = amount;
	}

	align(point) {
		const angleDiff = this.getAngleDiff(point);
		const desiredTurnSpeed = angleDiff;

		let desiredTurnAmount = desiredTurnSpeed / this.maxTurnSpeed;
		if (desiredTurnAmount > 1) {
			desiredTurnAmount = 1;
		} else if (desiredTurnAmount < -1) {
			desiredTurnAmount = -1;
		}

		this.turn(desiredTurnAmount);
	}

	orbit(point, distance) {
		let dis = this.object.position.clone().sub(point);
		dis.y = 0;
		dis = dis.normalize().multiplyScalar(distance);
		const a = point.clone().add(
			dis.clone().applyEuler(new THREE.Euler(0, Math.PI / 3, 0)));
		const b = point.clone().add(
			dis.clone().applyEuler(new THREE.Euler(0, -Math.PI / 3, 0)));

		const diffA = this.getAngleDiff(a);
		const diffB = this.getAngleDiff(b);

		if (Math.abs(diffA) < Math.abs(diffB)) {
			this.align(a);
		} else {
			this.align(b);
		}

		this.forward(1.0);
	}

	getAngleDiff(point) {
		const angle = Math.atan2(point.x - this.object.position.x, point.z - this.object.position.z) - Math.PI;
		const angleDiff = angle - this.object.rotation.y;
		return normalizeAngle(angleDiff);
	}
}

module.exports = Ship;
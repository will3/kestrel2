const container = require('../container');
const linearBillboard = require('../utils/math').linearBillboard;

class Beam {
	constructor(props) {
		this.target = props.target;
		this.turrent = props.turrent;

		this.scene = container.scene;		
		this.camera = container.camera;
		this.app = container.app;

		this.length = 0;
		const height = 0.5;

		this.dir = this.target.position.clone().sub(this.turrent.position).normalize();
		this.quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), this.dir);

		this.geometry = new THREE.Geometry();
		this.geometry.vertices.push(
			new THREE.Vector3(0, -height, 0),
			new THREE.Vector3(0, height, 0),
			new THREE.Vector3(1, height, 0),
			new THREE.Vector3(1, -height, 0)
		);

		this.geometry.faces.push(
			new THREE.Face3(2, 1, 0),
			new THREE.Face3(2, 0, 3)
		);

		this.material = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			side: THREE.DoubleSide
		});

		this.mesh = new THREE.Mesh(this.geometry, this.material);
		
		this.object = new THREE.Object3D();
		this.object.add(this.mesh);

		this.r = Math.random() * Math.PI / 2;

		this.life = 1.0;
		this.counter = 0;

		this.speed = 50;
	}

	start() {
		this.scene.add(this.object);
	}

	tick(dt) {
		this.dir = this.target.position.clone().sub(this.turrent.position).normalize();
		this.quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), this.dir);
		this.length += this.speed;

		linearBillboard(this.camera, this.object, this.dir, this.quaternion);

		const date = new Date().getTime();

		const widthNoise =
	    Math.sin(date / 17 + this.r) * 0.3 +
  	  Math.sin((date + 123 + this.r) / 27) * 0.4 +
    	Math.sin((date + 234 + this.r) / 13) * 0.4;

    const t = this.counter / this.life;
    const width = 2;

		this.mesh.scale.y = Math.sin(t * Math.PI) * width + widthNoise;
		this.mesh.scale.y *= 0.7;
		this.mesh.scale.x = this.length;

		this.object.position.copy(this.turrent.position);

		this.counter += dt;
		if (this.counter > this.life) {
			this.app.destroy(this);
		}
	}

	destroy() {
		this.scene.remove(this.object);	
	}
}	

module.exports = Beam;
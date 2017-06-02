const container = require('../container');
const THREE = require('three');
const Chunks = require('../voxel/chunks');
const mesher = require('../voxel/mesher');
const reader = require('../ships/reader');

class Ship {
	constructor(props) {
		this.props = props;
		this.engines = [];
		this.scene = container.scene;
		this.object = new THREE.Object3D();
		this.innerObject = new THREE.Object3D();
		this.object.add(this.innerObject);
		this.chunks = new Chunks();
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
	}

	destroy() {

	}
}

module.exports = Ship;